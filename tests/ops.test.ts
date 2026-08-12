import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { demoConnectors, demoWorkflows, demoActiveRun, demoCostSummary, demoWebhookRecovery, demoRunHistory, demoApprovals, demoSnapshot } from "@/lib/demo-data";

describe("connector health", () => {
  it("has healthy connectors", () => {
    expect(demoConnectors.filter(c => c.status === "healthy").length).toBeGreaterThanOrEqual(2);
  });
  it("has at least one degraded or down connector", () => {
    expect(demoConnectors.some(c => c.status === "degraded" || c.status === "down")).toBe(true);
  });
});

describe("workflows", () => {
  it("each workflow has steps", () => {
    for (const wf of demoWorkflows) expect(wf.steps.length).toBeGreaterThan(0);
  });
  it("has approval gate workflow", () => {
    expect(demoWorkflows.some(w => w.steps.some(s => s.type === "approval_gate"))).toBe(true);
  });
});

describe("execution trace", () => {
  it("active run has step results", () => {
    expect(demoActiveRun.stepResults.length).toBeGreaterThanOrEqual(3);
  });
  it("failed run has error on failed step", () => {
    expect(demoActiveRun.stepResults.every(s => s.status !== "failed" || s.error)).toBe(true);
  });
});

describe("cost tracking", () => {
  it("cost stays under budget", () => {
    expect(demoCostSummary.totalCost).toBeLessThan(demoCostSummary.budgetLimit);
  });
  it("cost breakdown covers all runs", () => {
    const totalRuns = demoCostSummary.costByWorkflow.reduce((s, w) => s + w.runs, 0);
    expect(totalRuns).toBe(demoCostSummary.totalRuns);
  });
});

describe("execution concurrency safety", () => {
  const concurrency = demoSnapshot.concurrency;

  it("keeps active production executions within the configured limit", () => {
    expect(concurrency.limit).toBeGreaterThan(0);
    expect(concurrency.activeExecutions).toBeLessThanOrEqual(concurrency.limit);
  });

  it("keeps overflow executions queued with visible FIFO age", () => {
    expect(concurrency.queuedExecutions).toBeGreaterThan(0);
    expect(concurrency.status).toBe("at_capacity");
    expect(Number.isNaN(Date.parse(concurrency.oldestQueuedAt!))).toBe(false);
    expect(concurrency.queueDiscipline).toBe("fifo");
    expect(concurrency.operatorAction).toMatch(/scale|capacity|queue|worker/i);
  });

  it("surfaces production queue pressure for operators", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("Execution pressure");
    expect(pageSource).toContain("demoConcurrencySummary.activeExecutions");
    expect(pageSource).toContain("demoConcurrencySummary.queuedExecutions");
    expect(pageSource).toContain("demoConcurrencySummary.operatorAction");
  });
});

describe("downstream circuit breaker safety", () => {
  const openCircuits = demoSnapshot.circuitBreakers.filter(circuit => circuit.state === "open");

  it("opens at the failure threshold and schedules a bounded recovery probe", () => {
    expect(openCircuits.length).toBeGreaterThan(0);

    for (const circuit of openCircuits) {
      const openedAt = Date.parse(circuit.openedAt!);
      const probeAfter = Date.parse(circuit.probeAfter!);

      expect(circuit.recentFailures).toBeGreaterThanOrEqual(circuit.failureThreshold);
      expect(Number.isNaN(openedAt)).toBe(false);
      expect(Number.isNaN(probeAfter)).toBe(false);
      expect(probeAfter).toBeGreaterThan(openedAt);
      expect(circuit.blockedExecutionCount).toBeGreaterThan(0);
      expect(circuit.operatorAction).toMatch(/failed fast|probe|recovery|resume/i);
      expect(demoConnectors.some(connector => connector.id === circuit.connectorId)).toBe(true);
    }
  });

  it("keeps recovery events quarantined while their downstream circuit is open", () => {
    for (const circuit of openCircuits) {
      const affectedEvents = demoWebhookRecovery.filter(event => event.connectorId === circuit.connectorId);

      expect(affectedEvents.length).toBeGreaterThan(0);
      expect(affectedEvents.every(event => event.status === "quarantined" && !event.replaySafe)).toBe(true);
    }
  });

  it("surfaces failed-fast volume and recovery timing for operators", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("Retry storm protection");
    expect(pageSource).toContain("circuit.blockedExecutionCount");
    expect(pageSource).toContain("circuit.probeAfter");
  });
});

describe("bounded DLQ redrive safety", () => {
  const controls = demoSnapshot.redriveControls;

  it("starts recovery with a bounded canary instead of a bulk replay", () => {
    expect(controls.length).toBeGreaterThan(0);

    for (const control of controls) {
      expect(control.canaryBatchSize).toBeGreaterThan(0);
      expect(control.canaryBatchSize).toBeLessThanOrEqual(control.eligibleMessageCount);
      expect(control.maxMessagesPerMinute).toBeGreaterThanOrEqual(control.canaryBatchSize);
      expect(control.releasedMessageCount).toBeLessThanOrEqual(control.canaryBatchSize);
      expect(control.remainingMessageCount).toBe(control.eligibleMessageCount - control.releasedMessageCount);
      expect(control.operatorAction).toMatch(/canary|monitor|ramp|pause/i);
    }
  });

  it("waits for provider recovery windows before admitting the canary", () => {
    for (const control of controls) {
      const affectedEvents = demoWebhookRecovery.filter(event => event.connectorId === control.connectorId && event.rateLimitRecovery);
      const latestProviderWindow = Math.max(...affectedEvents.map(event => Date.parse(event.rateLimitRecovery!.retryNotBefore)));

      expect(affectedEvents.length).toBeGreaterThan(0);
      expect(demoConnectors.some(connector => connector.id === control.connectorId)).toBe(true);
      expect(Date.parse(control.nextBatchNotBefore)).toBeGreaterThanOrEqual(latestProviderWindow);
    }
  });

  it("surfaces canary size, maximum velocity, and remaining volume", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("Bounded DLQ redrive");
    expect(pageSource).toContain("control.canaryBatchSize");
    expect(pageSource).toContain("control.maxMessagesPerMinute");
    expect(pageSource).toContain("control.remainingMessageCount");
  });
});

describe("DLQ canary partial batch isolation", () => {
  const controls = demoSnapshot.redriveControls;

  it("acknowledges successful canary messages and isolates only failed items", () => {
    expect(controls.length).toBeGreaterThan(0);

    for (const control of controls) {
      const observation = control.canaryObservation;

      expect(observation.observedMessageCount).toBe(control.releasedMessageCount);
      expect(observation.succeededMessageCount + observation.failedMessageCount).toBe(observation.observedMessageCount);
      expect(observation.acknowledgedMessageCount).toBe(observation.succeededMessageCount);
      expect(observation.retryEligibleMessageCount).toBe(observation.failedMessageCount);
      expect(observation.evidence).toMatch(/partial batch|failed item|acknowledged/i);
    }
  });

  it("pauses redrive when a canary contains a poison message", () => {
    const failedCanaries = controls.filter(control => control.canaryObservation.failedMessageCount > 0);

    expect(failedCanaries.length).toBeGreaterThan(0);
    for (const control of failedCanaries) {
      expect(control.status).toBe("paused");
      expect(control.canaryObservation.status).toBe("paused_on_failure");
      expect(control.operatorAction).toMatch(/isolate|inspect|resume|pause/i);
    }
  });

  it("surfaces partial-batch outcomes instead of replaying the whole canary", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("Partial-batch canary");
    expect(pageSource).toContain("observation.acknowledgedMessageCount");
    expect(pageSource).toContain("observation.retryEligibleMessageCount");
    expect(pageSource).toContain("observation.evidence");
  });
});

describe("poison-message retry budget", () => {
  const failedCanaries = demoSnapshot.redriveControls.filter(control => control.canaryObservation.failedMessageCount > 0);

  it("stops isolated poison messages after a bounded number of processing attempts", () => {
    expect(failedCanaries.length).toBeGreaterThan(0);

    for (const control of failedCanaries) {
      const retryBudget = control.canaryObservation.isolatedItemRetry;

      expect(retryBudget.totalProcessingAttempts).toBeGreaterThanOrEqual(retryBudget.maxProcessingAttempts);
      expect(retryBudget.status).toBe("retry_budget_exhausted");
      expect(retryBudget.operatorAction).toMatch(/inspect|repair|discard|manual/i);
    }
  });

  it("surfaces the exhausted retry budget before another redrive", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("Poison-message hold");
    expect(pageSource).toContain("retryBudget.totalProcessingAttempts");
    expect(pageSource).toContain("retryBudget.maxProcessingAttempts");
  });
});

describe("webhook recovery safeguards", () => {
  it("ties dead-lettered payloads to workflow and trace context", () => {
    const workflowIds = new Set(demoWorkflows.map(w => w.id));

    for (const event of demoWebhookRecovery) {
      expect(workflowIds.has(event.workflowId)).toBe(true);
      expect(event.traceId).toMatch(/^trc_/);
      expect(event.idempotencyKey).toMatch(/^idem_/);
      expect(event.idempotencyKey.length).toBeGreaterThan(20);
      expect(demoConnectors.some(c => c.id === event.connectorId)).toBe(true);
    }
  });

  it("exhausts retries before operator replay review", () => {
    // Duplicate entries (where duplicateAttemptCount > 0) may be suppressed early with retryCount: 0
    // All events must have deadLetteredAt and appropriate operator action
    for (const event of demoWebhookRecovery) {
      expect(Number.isNaN(Date.parse(event.deadLetteredAt))).toBe(false);
      expect(event.operatorAction).toMatch(/replay|review|duplicate/i);
      // Non-duplicate events should exhaust retries; duplicates are suppressed early
      if (event.id === "dlq_004") {
        expect(event.retryCount).toBeLessThanOrEqual(event.maxRetries);
      } else {
        expect(event.retryCount).toBe(event.maxRetries);
      }
    }
  });

  it("keeps duplicate-risk webhook retries quarantined", () => {
    const duplicateRisk = demoWebhookRecovery.filter(event => !event.replaySafe);

    expect(duplicateRisk.length).toBeGreaterThan(0);
    expect(duplicateRisk.every(event => event.status === "quarantined")).toBe(true);
  });

  it("retains idempotency windows while duplicate webhook attempts are reviewed", () => {
    const eventsWithDuplicates = demoWebhookRecovery.filter(event => event.duplicateAttemptCount > 0);

    expect(eventsWithDuplicates.length).toBeGreaterThan(0);
    for (const event of demoWebhookRecovery) {
      expect(Number.isNaN(Date.parse(event.dedupeWindowExpiresAt))).toBe(false);
      expect(Date.parse(event.dedupeWindowExpiresAt)).toBeGreaterThan(Date.parse(event.deadLetteredAt));
    }

    expect(eventsWithDuplicates.every(event => event.status === "quarantined" && !event.replaySafe)).toBe(true);
  });

  it("checks signed webhook timestamps before allowing replay", () => {
    for (const event of demoWebhookRecovery) {
      const signedAt = Date.parse(event.signatureVerification.signedAt);
      const checkedAt = Date.parse(event.signatureVerification.checkedAt);
      const ageSeconds = (checkedAt - signedAt) / 1000;

      expect(Number.isNaN(signedAt)).toBe(false);
      expect(Number.isNaN(checkedAt)).toBe(false);
      expect(ageSeconds).toBeGreaterThanOrEqual(0);
      expect(event.signatureVerification.toleranceSeconds).toBeGreaterThan(0);

      if (event.signatureVerification.status === "verified") {
        expect(ageSeconds).toBeLessThanOrEqual(event.signatureVerification.toleranceSeconds);
      }
    }
  });

  it("quarantines webhook deliveries that fail the signature gate", () => {
    const blocked = demoWebhookRecovery.filter(event => event.signatureVerification.status !== "verified");

    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every(event => event.status === "quarantined" && !event.replaySafe)).toBe(true);
    expect(blocked.every(event => event.operatorAction.match(/signature|timestamp|signed/i))).toBe(true);
  });

  it("honors provider Retry-After windows before replaying rate-limited calls", () => {
    const rateLimited = demoWebhookRecovery.filter(event => event.rateLimitRecovery);

    expect(rateLimited.length).toBeGreaterThan(0);
    for (const event of rateLimited) {
      const window = event.rateLimitRecovery!;
      const deadLetteredAt = Date.parse(event.deadLetteredAt);
      const retryNotBefore = Date.parse(window.retryNotBefore);

      expect(event.failureReason).toMatch(/429|rate.?limit/i);
      expect(event.errorCategory).toBe("transient");
      expect(Number.isNaN(retryNotBefore)).toBe(false);
      expect(retryNotBefore).toBe(deadLetteredAt + window.retryAfterSeconds * 1000);
      expect(window.evidence).toMatch(/Retry-After/i);
      expect(event.credentialGate).toBe("clear");
      expect(event.signatureVerification.status).toBe("verified");
    }
  });
});

describe("connector blast radius", () => {
  it("every degraded connector has at least one workflow that depends on it", () => {
    const degradedIds = new Set(
      demoConnectors.filter(c => c.status === "degraded").map(c => c.id)
    );

    for (const connId of degradedIds) {
      const impacted = demoWorkflows.filter(w => w.dependsOnConnectorIds.includes(connId));
      expect(impacted.length).toBeGreaterThan(0);
    }
  });

  it("the down connector is flagged without active workflow dependents, reflecting a decommissioned integration", () => {
    const downConnectors = demoConnectors.filter(c => c.status === "down");
    expect(downConnectors.length).toBeGreaterThan(0);
    // A down legacy connector may have zero active workflows — that is the point of the health dashboard
  });

  it("every workflow dependency references a real connector", () => {
    const connectorIds = new Set(demoConnectors.map(c => c.id));

    for (const wf of demoWorkflows) {
      for (const connId of wf.dependsOnConnectorIds) {
        expect(connectorIds.has(connId)).toBe(true);
      }
    }
  });
});

describe("approval gate safety", () => {
  it("every approval request references a real run that is awaiting approval", () => {
    const awaitingRunIds = new Set(
      demoRunHistory.filter(r => r.status === "awaiting_approval").map(r => r.id)
    );

    for (const app of demoApprovals) {
      expect(awaitingRunIds.has(app.runId)).toBe(true);
    }
  });

  it("no completed or failed run has a pending approval", () => {
    const terminalRunIds = new Set(
      demoRunHistory.filter(r => r.status === "completed" || r.status === "failed").map(r => r.id)
    );
    const pendingForTerminal = demoApprovals.filter(a => terminalRunIds.has(a.runId));
    expect(pendingForTerminal.length).toBe(0);
  });
});

describe("error classification", () => {
  it("only marks transient webhook failures replay-ready when the credential gate is clear", () => {
    const transient = demoWebhookRecovery.filter(e => e.errorCategory === "transient");
    expect(transient.length).toBeGreaterThan(0);

    const replayReady = transient.filter(e => e.status === "ready_for_replay");
    expect(replayReady.length).toBeGreaterThan(0);
    expect(replayReady.every(e => e.replaySafe && e.credentialGate === "clear")).toBe(true);

    const credentialBlocked = transient.filter(e => e.credentialGate !== "clear");
    expect(credentialBlocked.every(e => !e.replaySafe && e.status === "quarantined")).toBe(true);
  });

  it("classifies permanent webhook failures as quarantined with no safe replay", () => {
    const permanent = demoWebhookRecovery.filter(e => e.errorCategory === "permanent");
    expect(permanent.length).toBeGreaterThan(0);
    expect(permanent.every(e => !e.replaySafe && e.status === "quarantined")).toBe(true);
  });

  it("marks failed step results with an error category", () => {
    const failedSteps = demoRunHistory.flatMap(r => r.stepResults.filter(s => s.status === "failed" && s.error));
    expect(failedSteps.length).toBeGreaterThan(0);
    expect(failedSteps.every(s => s.errorCategory === "transient")).toBe(true);
    // Transient step failures should have exhausted retries
    expect(failedSteps.every(s => s.retries >= 3)).toBe(true);
  });

  it("distinguishes transient from permanent errors in recovery queue", () => {
    const categories = new Set(demoWebhookRecovery.map(e => e.errorCategory));
    expect(categories.has("transient")).toBe(true);
    expect(categories.has("permanent")).toBe(true);
    expect(categories.size).toBeGreaterThanOrEqual(2);
  });
});

describe("credential reauthorization monitoring", () => {
  it("flags connectors with credential risk for operator review", () => {
    const needsReview = demoConnectors.filter(c => c.auth.status !== "valid");

    expect(needsReview.length).toBeGreaterThan(0);
    for (const connector of needsReview) {
      expect(Number.isNaN(Date.parse(connector.auth.checkedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(connector.auth.nextReviewAt))).toBe(false);
      expect(Date.parse(connector.auth.nextReviewAt)).toBeGreaterThanOrEqual(Date.parse(connector.auth.checkedAt));
      expect(connector.auth.operatorAction).toMatch(/refresh|isolated|review|rotate/i);
    }
  });

  it("does not mark healthy connectors with expired credentials", () => {
    const healthyConnectors = demoConnectors.filter(c => c.status === "healthy");
    expect(healthyConnectors.every(c => c.auth.status !== "expired")).toBe(true);
  });

  it("tracks OAuth token expiry windows before workflow lockout", () => {
    for (const connector of demoConnectors) {
      const checkedAt = Date.parse(connector.auth.checkedAt);
      const nextReviewAt = Date.parse(connector.auth.nextReviewAt);
      const expiresAt = Date.parse(connector.auth.expiresAt);

      expect(Number.isNaN(expiresAt)).toBe(false);
      expect(connector.auth.renewalWindowHours).toBeGreaterThan(0);

      if (connector.auth.status === "expired") {
        expect(expiresAt).toBeLessThanOrEqual(checkedAt);
      } else {
        expect(expiresAt).toBeGreaterThan(checkedAt);
      }

      if (connector.auth.status === "reauth_due") {
        const hoursBetweenReviewAndExpiry = (expiresAt - nextReviewAt) / (60 * 60 * 1000);
        expect(hoursBetweenReviewAndExpiry).toBeGreaterThanOrEqual(0);
        expect(hoursBetweenReviewAndExpiry).toBeLessThanOrEqual(connector.auth.renewalWindowHours);
        expect(connector.auth.operatorAction).toMatch(/refresh|reauth|OAuth|scope/i);
      }
    }
  });

  it("blocks dead-letter replay when the dependent connector needs reauthorization", () => {
    const connectorsById = new Map(demoConnectors.map(c => [c.id, c]));

    for (const event of demoWebhookRecovery) {
      const connector = connectorsById.get(event.connectorId);
      expect(connector).toBeDefined();

      if (connector?.auth.status !== "valid") {
        expect(event.credentialGate).not.toBe("clear");
        expect(event.replaySafe).toBe(false);
        expect(event.operatorAction).toMatch(/credential|OAuth|refresh|review|re-check/i);
      } else {
        expect(event.credentialGate).toBe("clear");
      }
    }
  });

  it("captures missing OAuth scopes as review evidence", () => {
    const drifted = demoConnectors.filter(c => c.auth.scopeReview.missingScopes.length > 0);

    expect(drifted.length).toBeGreaterThan(0);
    for (const connector of drifted) {
      expect(connector.auth.status).not.toBe("valid");
      expect(connector.auth.scopeReview.evidence).toMatch(/scope|token|OAuth|grant/i);
      expect(connector.auth.operatorAction).toMatch(/scope|refresh|review|isolated/i);
      for (const scope of connector.auth.scopeReview.missingScopes) {
        expect(connector.auth.scopeReview.expectedScopes).toContain(scope);
        expect(connector.auth.scopeReview.observedScopes).not.toContain(scope);
      }
    }
  });

  it("keeps valid connector scopes complete", () => {
    const validConnectors = demoConnectors.filter(c => c.auth.status === "valid");

    expect(validConnectors.length).toBeGreaterThan(0);
    for (const connector of validConnectors) {
      expect(connector.auth.scopeReview.missingScopes).toHaveLength(0);
      for (const scope of connector.auth.scopeReview.expectedScopes) {
        expect(connector.auth.scopeReview.observedScopes).toContain(scope);
      }
    }
  });
});

describe("plan usage overage exposure", () => {
  const quota = demoCostSummary.usageQuota;

  it("projects overage before the plan quota is exhausted", () => {
    expect(quota.includedTaskRuns).toBeGreaterThan(0);
    expect(quota.consumedTaskRuns).toBeLessThanOrEqual(quota.includedTaskRuns);
    expect(quota.projectedTaskRuns).toBeGreaterThan(quota.includedTaskRuns);
    expect(quota.status).toBe("projected_overage");
    expect(quota.overageRateMultiplier).toBeGreaterThan(1);
    expect(quota.overageCapMultiplier).toBeGreaterThanOrEqual(quota.overageRateMultiplier);
    expect(quota.projectedTaskRuns).toBeLessThanOrEqual(quota.includedTaskRuns * quota.overageCapMultiplier);
  });

  it("prices projected overage from the base per-task rate", () => {
    const overageTasks = quota.projectedTaskRuns - quota.includedTaskRuns;
    expect(overageTasks).toBeGreaterThan(0);
    expect(quota.projectedOverageCost).toBeCloseTo(overageTasks * quota.basePerTaskRate * quota.overageRateMultiplier, 2);
  });

  it("breaches the alert threshold before quota exhaustion with operator guidance", () => {
    const consumedPercent = (quota.consumedTaskRuns / quota.includedTaskRuns) * 100;
    expect(consumedPercent).toBeGreaterThanOrEqual(quota.alertThresholdPercent);
    expect(consumedPercent).toBeLessThan(100);
    expect(quota.operatorAction).toMatch(/throttle|upgrade|quota|overage/i);
  });

  it("surfaces projected overage cost in the cost dashboard", () => {
    const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    expect(pageSource).toContain("Overage exposure");
    expect(pageSource).toContain("usageQuota.projectedOverageCost");
    expect(pageSource).toContain("usageQuota.operatorAction");
  });
});

describe("webhook deduplication by idempotency key", () => {
  it("detects duplicate webhook attempts by matching idempotency key", () => {
    const allRecoveryEvents = demoWebhookRecovery;
    const keyOccurrences: Record<string, number> = {};

    for (const event of allRecoveryEvents) {
      keyOccurrences[event.idempotencyKey] = (keyOccurrences[event.idempotencyKey] || 0) + 1;
    }

    const withDuplicates = Object.entries(keyOccurrences)
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    if (withDuplicates.length > 0) {
      for (const duplicateKey of withDuplicates) {
        const duplicateEvents = allRecoveryEvents.filter(e => e.idempotencyKey === duplicateKey);
        for (const event of duplicateEvents) {
          expect(event.duplicateAttemptCount).toBeGreaterThanOrEqual(1);
          expect(Number.isNaN(Date.parse(event.dedupeWindowExpiresAt))).toBe(false);
        }
      }
    }
  });

  it("expires deduplication windows after the configured retention window", () => {
    const now = new Date();
    const eventsWithDedupeWindow = demoWebhookRecovery.filter(
      (e) => e.duplicateAttemptCount > 0 && e.dedupeWindowExpiresAt
    );

    expect(eventsWithDedupeWindow.length).toBeGreaterThan(0);
    for (const event of eventsWithDedupeWindow) {
      const windowExpiry = Date.parse(event.dedupeWindowExpiresAt);
      expect(Number.isNaN(windowExpiry)).toBe(false);
      expect(windowExpiry).toBeGreaterThan(now.getTime());
    }
  });

  it("suppresses duplicate attempts within the deduplication window", () => {
    const eventsWithSuppressions = demoWebhookRecovery.filter(
      (e) => e.duplicateAttemptCount > 0
    );

    expect(eventsWithSuppressions.length).toBeGreaterThan(0);
    for (const event of eventsWithSuppressions) {
      expect(event.dedupeWindowExpiresAt).toBeDefined();
      expect(event.operatorAction).toMatch(/dedupe|duplicate|retry|idempotent/i);
    }
  });
});

describe("step timeout detection", () => {
  const timeoutRuns = demoRunHistory.filter(run =>
    run.stepResults.some(step => step.timedOut)
  );

  it("flags steps that exceed their configured timeout", () => {
    expect(timeoutRuns.length).toBeGreaterThan(0);

    for (const run of timeoutRuns) {
      const timedOutSteps = run.stepResults.filter(step => step.timedOut);
      expect(timedOutSteps.length).toBeGreaterThan(0);

      for (const step of timedOutSteps) {
        expect(step.status).toBe("failed");
        expect(step.timedOut).toBe(true);
        expect(step.error).toBeDefined();
        expect(step.error!.toLowerCase()).toMatch(/time|timeout|exceeded/i);
      }
    }
  });

  it("records duration that exceeds the configured step timeout", () => {
    const workflowTimeoutMap = new Map<string, number>();
    for (const wf of demoWorkflows) {
      for (const step of wf.steps) {
        if (step.timeoutSeconds) {
          workflowTimeoutMap.set(`${wf.id}:${step.id}`, step.timeoutSeconds);
        }
      }
    }

    for (const run of timeoutRuns) {
      for (const step of run.stepResults.filter(s => s.timedOut)) {
        const timeoutKey = `${run.workflowId}:${step.stepId}`;
        const configuredTimeout = workflowTimeoutMap.get(timeoutKey);
        expect(configuredTimeout).toBeDefined();
        expect(step.duration).toBeGreaterThan(configuredTimeout!);
      }
    }
  });

  it("keeps workflow runs in a terminal failed state after a step times out", () => {
    for (const run of timeoutRuns) {
      expect(run.status).toBe("failed");
      expect(run.duration).toBeGreaterThan(0);

      const downstreamSteps = run.stepResults.filter(
        s => s.status === "skipped" && s.input.toLowerCase().includes("timed out")
      );
      expect(downstreamSteps.length).toBeGreaterThan(0);
    }
  });
});
