import {
  demoActiveRun, demoApprovals, demoAuditLog, demoCircuitBreakers, demoConcurrencySummary, demoConnectors, demoCostSummary,
  demoMembers, demoRedriveControls, demoWebhookRecovery, demoWorkflows
} from "@/lib/demo-data";
import type { ConnectorStatus, CredentialStatus, RunStatus } from "@/lib/types";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const t: Record<string, string> = {
    slate: "border-slate-200 bg-white text-slate-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700", amber: "border-amber-200 bg-amber-50 text-amber-800",
    purple: "border-indigo-200 bg-indigo-50 text-indigo-700"
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${t[tone]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur ${className}`}>{children}</section>;
}

function ConnectorDot({ status }: { status: ConnectorStatus }) {
  const c = { healthy: "bg-emerald-500", degraded: "bg-amber-500 animate-pulse", down: "bg-red-500" };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c[status]}`} />;
}

function CredentialBadge({ status }: { status: CredentialStatus }) {
  const m: Record<CredentialStatus, { label: string; tone: string }> = {
    valid: { label: "Auth valid", tone: "green" },
    reauth_due: { label: "Reauth due", tone: "amber" },
    expired: { label: "Auth expired", tone: "red" }
  };
  return <Badge tone={m[status].tone}>{m[status].label}</Badge>;
}

function formatIsoMinute(value: string) {
  const [date, time = ""] = value.split("T");
  return `${date} ${time.slice(0, 5)} UTC`;
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  const m: Record<RunStatus, { label: string; tone: string }> = {
    queued: { label: "Queued", tone: "slate" }, running: { label: "Running", tone: "purple" },
    awaiting_approval: { label: "Awaiting Approval", tone: "amber" }, completed: { label: "Completed", tone: "green" }, failed: { label: "Failed", tone: "red" }
  };
  return <Badge tone={m[status].tone}>{m[status].label}</Badge>;
}

function StepIcon({ type, status }: { type: string; status: string }) {
  const icons: Record<string, string> = { trigger: "⚡", ai_analyze: "🧠", ai_generate: "🤖", transform: "🔄", crm_upsert: "📇", outbound_email: "✉️", outbound_slack: "💬", sheets_append: "📊", approval_gate: "🛡️" };
  const color = status === "failed" ? "text-red-400" : status === "success" ? "text-emerald-500" : "text-slate-400";
  return <span className={color}>{icons[type] ?? "•"}</span>;
}

export default function Home() {
  const healthyCount = demoConnectors.filter(c => c.status === "healthy").length;
  const downCount = demoConnectors.filter(c => c.status === "down").length;
  const pendingApprovals = demoApprovals.length;
  const recoveryQueueCount = demoWebhookRecovery.filter(e => e.status !== "replayed").length;
  const replayReadyCount = demoWebhookRecovery.filter(e => e.status === "ready_for_replay").length;
  const authReviewCount = demoConnectors.filter(c => c.auth.status !== "valid").length;
  const scopeDriftCount = demoConnectors.filter(c => c.auth.scopeReview.missingScopes.length > 0).length;
  const expiryWindowCount = demoConnectors.filter(c => {
    const hoursUntilExpiry = (Date.parse(c.auth.expiresAt) - Date.parse(c.auth.checkedAt)) / (60 * 60 * 1000);
    return c.auth.status !== "expired" && hoursUntilExpiry <= c.auth.renewalWindowHours;
  }).length;
  const openCircuitBreakers = demoCircuitBreakers.filter(circuit => circuit.state === "open");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-8 md:px-8 lg:px-10 bg-slate-50">
      {/* HEADER */}
      <header className="grid gap-6 rounded-[2rem] border border-white/80 bg-white/80 p-8 shadow-sm backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="purple">Workflow Automation</Badge>
            <Badge tone="green">{demoWorkflows.length} workflows</Badge>
            <Badge>{demoConnectors.length} connectors</Badge>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-600">Ops Studio</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">Workflow Automation Ops</h1>
          <p className="max-w-3xl text-lg leading-8 text-slate-600">
            Build, test, and monitor AI-powered workflows. Sandbox-test before production. 
            Step-level execution traces. Integration health at a glance. Human approval gates before any outbound action.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Healthy connectors", value: healthyCount, sub: `of ${demoConnectors.length}` },
            { label: "Connectors down", value: downCount, sub: "needs attention" },
            { label: "Pending approvals", value: pendingApprovals, sub: "awaiting human" },
            { label: "Recovery queue", value: recoveryQueueCount, sub: "DLQ events" },
            { label: "Auth review", value: authReviewCount, sub: `${scopeDriftCount} scope drift · ${expiryWindowCount} expiring` },
            { label: "Monthly cost", value: `$${demoCostSummary.totalCost.toFixed(2)}`, sub: `/${demoCostSummary.totalRuns} runs` }
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-sm text-slate-300">{s.label}</p>
              <p className="text-3xl font-black">{s.value}</p>
              <p className="text-xs text-slate-400">{s.sub}</p>
            </div>
          ))}
        </div>
      </header>

      {/* INTEGRATION HEALTH + WORKFLOW DEFINITIONS */}
      <div className="grid gap-6 lg:grid-cols-[0.6fr_1.4fr]">
        <Card>
          <h2 className="text-xl font-bold text-slate-950">Integration Health</h2>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4" role="status" aria-label="Production execution concurrency">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950">Execution pressure</h3>
              <Badge tone="amber">{demoConcurrencySummary.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {demoConcurrencySummary.activeExecutions} / {demoConcurrencySummary.limit} active · {demoConcurrencySummary.queuedExecutions} queued · FIFO
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {demoConcurrencySummary.oldestQueuedAt ? `Oldest queued ${formatIsoMinute(demoConcurrencySummary.oldestQueuedAt)}` : "Queue clear"}
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-800">{demoConcurrencySummary.operatorAction}</p>
          </div>
          {openCircuitBreakers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/70 p-4" role="alert" aria-label="Open downstream circuit breakers">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-950">Retry storm protection</h3>
                <Badge tone="red">{openCircuitBreakers.length} open</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {openCircuitBreakers.map(circuit => {
                  const connector = demoConnectors.find(item => item.id === circuit.connectorId);
                  return (
                    <div key={circuit.id} className="rounded-xl bg-white p-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-900">
                        {connector?.name ?? circuit.connectorId}: {circuit.recentFailures} recent failures / threshold {circuit.failureThreshold}
                      </p>
                      <p className="mt-1 text-red-600">
                        {circuit.blockedExecutionCount} executions failed fast · {circuit.probeAfter ? `probe after ${formatIsoMinute(circuit.probeAfter)}` : "manual reset required"}
                      </p>
                      <p className="mt-1 leading-5">{circuit.operatorAction}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {demoConnectors.map(c => (
              <div key={c.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${c.status === "down" ? "bg-red-50 border border-red-200" : c.status === "degraded" ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <ConnectorDot status={c.status} />
                  <div>
                    <p className="font-semibold text-sm text-slate-950">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.type}</p>
                  </div>
                </div>
                <div className="space-y-1 text-right text-xs">
                  <CredentialBadge status={c.auth.status} />
                  <p className="font-medium text-slate-600">{c.uptime}% uptime</p>
                  <p className="text-slate-500">Expires {formatIsoMinute(c.auth.expiresAt)} · renew {c.auth.renewalWindowHours}h before</p>
                  {c.errorCount > 0 && <p className="text-red-500">{c.errorCount} errors</p>}
                  {c.auth.status !== "valid" && <p className="max-w-44 text-[10px] leading-4 text-amber-700">{c.auth.operatorAction}</p>}
                  {c.auth.scopeReview.missingScopes.length > 0 && (
                    <p className="max-w-44 text-[10px] leading-4 text-red-600">Missing scopes: {c.auth.scopeReview.missingScopes.join(", ")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950">Webhook recovery queue</h3>
              <Badge tone="purple">{replayReadyCount} replay-ready</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Dead-lettered payloads keep trace IDs, idempotency keys, and signature evidence so forged or stale deliveries cannot be replayed.
            </p>
            <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3" role="status" aria-label="Bounded dead-letter queue redrive controls">
              <h4 className="text-xs font-bold text-slate-950">Bounded DLQ redrive</h4>
              {demoRedriveControls.map(control => {
                const connector = demoConnectors.find(item => item.id === control.connectorId);
                const observation = control.canaryObservation;
                return (
                  <div key={control.id} className="mt-2 text-xs text-slate-600">
                    <p className="font-semibold text-indigo-700">{connector?.name ?? control.connectorId} · {control.status}</p>
                    <p className="mt-1">
                      {control.canaryBatchSize}-message canary · {control.maxMessagesPerMinute}/min max · {control.remainingMessageCount} remaining
                    </p>
                    <p className="mt-1 text-slate-400">Next batch no earlier than {formatIsoMinute(control.nextBatchNotBefore)}</p>
                    <p className="mt-1 font-semibold text-amber-700">
                      Partial-batch canary: {observation.acknowledgedMessageCount} acknowledged · {observation.retryEligibleMessageCount} isolated
                    </p>
                    <p className="mt-1 leading-5 text-slate-500">{observation.evidence}</p>
                    <p className="mt-1 leading-5">{control.operatorAction}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-2">
              {demoWebhookRecovery.map(event => (
                <div key={event.id} className="rounded-xl bg-white p-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{event.provider}</span>
                    <span className="font-mono text-[10px] text-indigo-600">{event.traceId}</span>
                  </div>
                  <p className="mt-1">{event.failureReason}</p>
                  <p className="mt-1 text-slate-400">
                    {event.retryCount}/{event.maxRetries} retries · {event.status.replace(/_/g, " ")} · {event.replaySafe ? "safe replay" : "hold for review"}
                  </p>
                  <p className="mt-1 text-slate-400">
                    {event.duplicateAttemptCount} duplicate attempt{event.duplicateAttemptCount === 1 ? "" : "s"} blocked · dedupe TTL {new Date(event.dedupeWindowExpiresAt).toLocaleTimeString()}
                  </p>
                  <p className={`mt-1 font-semibold ${event.credentialGate === "clear" ? "text-emerald-600" : "text-amber-700"}`}>
                    Credential gate: {event.credentialGate.replace(/_/g, " ")}
                  </p>
                  <p className={`mt-1 font-semibold ${event.signatureVerification.status === "verified" ? "text-emerald-600" : "text-red-600"}`}>
                    Signature gate: {event.signatureVerification.status.replace(/_/g, " ")} · {event.signatureVerification.toleranceSeconds}s tolerance
                  </p>
                  {event.rateLimitRecovery && (
                    <p className="mt-1 font-semibold text-indigo-600">
                      Provider retry window: {event.rateLimitRecovery.retryAfterSeconds}s · resumes {formatIsoMinute(event.rateLimitRecovery.retryNotBefore)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-slate-950">Workflow Definitions</h2>
          <div className="mt-4 space-y-4">
            {demoWorkflows.map(wf => (
              <div key={wf.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-950">{wf.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{wf.successRate}% success</span>
                    <Badge>{wf.stepCount} steps</Badge>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-600">{wf.description}</p>
                {/* Step cards */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {wf.steps.map((step, i) => (
                    <span key={step.id} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200">
                      <StepIcon type={step.type} status="idle" />
                      {step.label}
                      {i < wf.steps.length - 1 && <span className="text-slate-300 ml-1">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SANDBOX TEST + STEP TRACE (active run) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">Step Execution Trace</h2>
            <RunStatusBadge status={demoActiveRun.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{demoActiveRun.workflowName} · started {new Date(demoActiveRun.startedAt).toLocaleTimeString()} · {demoActiveRun.duration}s</p>
          <div className="mt-4 space-y-2">
            {demoActiveRun.stepResults.map((step) => (
              <div key={step.stepId} className={`rounded-xl border p-4 ${step.status === "failed" ? "border-red-200 bg-red-50/30" : step.status === "success" ? "border-emerald-100 bg-white" : "border-slate-100 bg-slate-50/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StepIcon type={demoWorkflows[0].steps.find(s => s.id === step.stepId)?.type ?? ""} status={step.status} />
                    <span className="font-semibold text-sm text-slate-950">{step.stepLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-semibold ${step.status === "failed" ? "text-red-600" : "text-emerald-600"}`}>{step.status}</span>
                    <span className="text-slate-400">{step.duration}s</span>
                    {step.retries > 0 && <span className="text-amber-500">{step.retries} retries</span>}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Input:</span> <span className="text-slate-600">{step.input}</span></div>
                  {step.output && <div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400">Output:</span> <span className="text-slate-600">{step.output}</span></div>}
                </div>
                {step.error && <p className="mt-2 text-xs font-semibold text-red-600">⚠ {step.error}</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Est. cost: ${demoActiveRun.costEstimate.toFixed(2)}</span>
            <span>Actual: ${demoActiveRun.costActual.toFixed(2)}</span>
          </div>
        </Card>

        {/* APPROVALS + RUN HISTORY */}
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-xl font-bold text-slate-950">Approval Gates</h2>
            {demoApprovals.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No pending approvals.</p>
            ) : (
              demoApprovals.map(app => (
                <div key={app.id} className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-slate-950">{app.workflowName}</p>
                    <Badge tone="amber">Awaiting approval</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{app.detail}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve & Send</button>
                    <button className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Edit Draft</button>
                    <button className="rounded-xl border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600">Reject</button>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Sandbox test CTA */}
          <Card>
            <h2 className="text-xl font-bold text-slate-950">Sandbox Test</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Run any workflow against synthetic data before deploying. See step outputs without triggering real outbound actions.</p>
            <button className="mt-4 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white">Run Sandbox Test →</button>
          </Card>
        </div>
      </div>

      {/* COST + AUDIT LOG */}
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <h2 className="text-xl font-bold text-slate-950">Run Cost Tracking</h2>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Monthly spend</span>
              <span className="text-sm font-semibold">${demoCostSummary.totalCost.toFixed(2)} / ${demoCostSummary.budgetLimit.toFixed(2)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${(demoCostSummary.totalCost / demoCostSummary.budgetLimit) * 100}%` }} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {demoCostSummary.costByWorkflow.map(w => (
              <div key={w.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span>{w.name}</span>
                <span className="font-semibold">${w.cost.toFixed(2)} <span className="text-slate-400 font-normal">({w.runs} runs)</span></span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-slate-950">Audit Log</h2>
          <div className="mt-4 space-y-2 max-h-[200px] overflow-auto">
            {demoAuditLog.map(e => (
              <div key={e.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-600 capitalize">{e.action.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-slate-400">${e.cost.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{e.detail}</p>
                <p className="mt-1 text-[10px] text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* MEMBERS */}
      <Card>
        <h2 className="text-xl font-bold text-slate-950">Team</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {demoMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{m.initials}</span>
              <div>
                <p className="font-semibold text-slate-950">{m.name}</p>
                <p className="text-xs text-slate-500 capitalize">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
