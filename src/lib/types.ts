export type RunStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed";
export type ConnectorStatus = "healthy" | "degraded" | "down";
export type CredentialStatus = "valid" | "reauth_due" | "expired";
export type CredentialGateStatus = "clear" | "reauth_required" | "expired_blocked";
export type WebhookSignatureStatus = "verified" | "invalid" | "stale_timestamp";
export type ErrorCategory = "transient" | "permanent" | "unknown";
export type RecoveryStatus = "ready_for_replay" | "replayed" | "quarantined";
export type ConcurrencyStatus = "normal" | "at_capacity" | "backlogged";
export type ConcurrencyScope = "production_webhook_and_trigger_runs";
export type CircuitBreakerState = "closed" | "open" | "half_open";
export type RedriveControlStatus = "held" | "canary" | "ramping" | "paused";
export type RedriveCanaryObservationStatus = "pending" | "passed" | "paused_on_failure";
export type StepType = "trigger" | "transform" | "ai_analyze" | "ai_generate" | "outbound_email" | "outbound_slack" | "crm_upsert" | "sheets_append" | "approval_gate";

export interface WorkspaceMember {
  id: string; name: string; role: "admin" | "operator" | "viewer"; initials: string;
}

export interface Connector {
  id: string; name: string; type: string; status: ConnectorStatus;
  lastSuccess: string; errorCount: number; uptime: number;
  auth: {
    status: CredentialStatus;
    checkedAt: string;
    nextReviewAt: string;
    expiresAt: string;
    renewalWindowHours: number;
    operatorAction: string;
    scopeReview: {
      expectedScopes: string[];
      observedScopes: string[];
      missingScopes: string[];
      evidence: string;
    };
  };
}

export interface WorkflowStep {
  id: string; type: StepType; label: string; config: string;
}

export interface WorkflowDefinition {
  id: string; name: string; description: string; stepCount: number;
  connectorCount: number; lastRun: string; successRate: number;
  steps: WorkflowStep[]; dependsOnConnectorIds: string[];
}

export interface StepRunResult {
  stepId: string; stepLabel: string; status: "success" | "failed" | "skipped";
  input: string; output: string; duration: number; error?: string; retries: number; errorCategory?: ErrorCategory;
}

export interface WorkflowRun {
  id: string; workflowId: string; workflowName: string;
  status: RunStatus; startedAt: string; duration: number;
  stepResults: StepRunResult[]; costEstimate: number; costActual: number;
}

export interface ApprovalRequest {
  id: string; runId: string; workflowName: string; stepLabel: string;
  action: string; detail: string; requestedAt: string;
}

export interface AuditLogEntry {
  id: string; runId: string; action: string; detail: string; timestamp: string; cost: number;
}

export interface WebhookRecoveryEvent {
  id: string; workflowId: string; provider: string; connectorId: string; receivedAt: string;
  traceId: string; idempotencyKey: string; failureReason: string;
  retryCount: number; maxRetries: number; status: RecoveryStatus;
  deadLetteredAt: string; replaySafe: boolean; operatorAction: string;
  duplicateAttemptCount: number; dedupeWindowExpiresAt: string;
  errorCategory: ErrorCategory; credentialGate: CredentialGateStatus;
  signatureVerification: {
    status: WebhookSignatureStatus; signedAt: string; checkedAt: string;
    toleranceSeconds: number; evidence: string;
  };
  rateLimitRecovery?: {
    retryAfterSeconds: number; retryNotBefore: string; evidence: string;
  };
}

export interface ExecutionConcurrencySummary {
  limit: number; activeExecutions: number; queuedExecutions: number;
  oldestQueuedAt: string | null; queueDiscipline: "fifo";
  scope: ConcurrencyScope; status: ConcurrencyStatus; operatorAction: string;
}

export interface ConnectorCircuitBreaker {
  id: string; connectorId: string; state: CircuitBreakerState;
  failureThreshold: number; recentFailures: number; openedAt: string | null;
  probeAfter: string | null; blockedExecutionCount: number; operatorAction: string;
}

export interface DlqRedriveControl {
  id: string; connectorId: string; status: RedriveControlStatus;
  eligibleMessageCount: number; canaryBatchSize: number; releasedMessageCount: number;
  remainingMessageCount: number; maxMessagesPerMinute: number;
  nextBatchNotBefore: string; operatorAction: string;
  canaryObservation: {
    status: RedriveCanaryObservationStatus; observedAt: string;
    observedMessageCount: number; succeededMessageCount: number; failedMessageCount: number;
    acknowledgedMessageCount: number; retryEligibleMessageCount: number; evidence: string;
  };
}

export interface CostSummary {
  totalRuns: number; totalCost: number; budgetLimit: number;
  costByWorkflow: { name: string; cost: number; runs: number }[];
}

export interface OpsSnapshot {
  members: WorkspaceMember[];
  connectors: Connector[];
  workflows: WorkflowDefinition[];
  activeRun: WorkflowRun | null;
  runHistory: WorkflowRun[];
  approvals: ApprovalRequest[];
  auditLog: AuditLogEntry[];
  webhookRecovery: WebhookRecoveryEvent[];
  concurrency: ExecutionConcurrencySummary;
  circuitBreakers: ConnectorCircuitBreaker[];
  redriveControls: DlqRedriveControl[];
  costSummary: CostSummary;
}
