import type { ApprovalRequest, AuditLogEntry, Connector, ConnectorCircuitBreaker, CostSummary, DlqRedriveControl, ExecutionConcurrencySummary, OpsSnapshot, StepRunResult, WebhookRecoveryEvent, WorkflowDefinition, WorkflowRun, WorkspaceMember } from "./types";

export const demoMembers: WorkspaceMember[] = [
  { id: "m_1", name: "Jordan Park", role: "admin", initials: "JP" },
  { id: "m_2", name: "Nina Vasquez", role: "operator", initials: "NV" },
  { id: "m_3", name: "Leo Tanaka", role: "operator", initials: "LT" }
];

export const demoConnectors: Connector[] = [
  {
    id: "conn_gmail", name: "Gmail", type: "email", status: "healthy", lastSuccess: "2026-06-08T15:30:00Z", errorCount: 0, uptime: 99.8,
    auth: {
      status: "valid", checkedAt: "2026-06-08T15:25:00Z", nextReviewAt: "2026-06-15T15:25:00Z",
      expiresAt: "2026-07-08T15:25:00Z", renewalWindowHours: 72,
      operatorAction: "No action needed; rotate service account key during the weekly credential review.",
      scopeReview: {
        expectedScopes: ["gmail.send", "gmail.modify"], observedScopes: ["gmail.send", "gmail.modify"], missingScopes: [],
        evidence: "OAuth token introspection returned the expected Gmail send and modify scopes."
      }
    }
  },
  {
    id: "conn_slack", name: "Slack", type: "messaging", status: "healthy", lastSuccess: "2026-06-08T15:28:00Z", errorCount: 1, uptime: 99.5,
    auth: {
      status: "valid", checkedAt: "2026-06-08T15:24:00Z", nextReviewAt: "2026-06-15T15:24:00Z",
      expiresAt: "2026-07-08T15:24:00Z", renewalWindowHours: 72,
      operatorAction: "No action needed; keep bot scope audit on the weekly review checklist.",
      scopeReview: {
        expectedScopes: ["chat:write", "channels:read"], observedScopes: ["chat:write", "channels:read"], missingScopes: [],
        evidence: "Slack auth.test confirmed bot access and the expected channel read scope."
      }
    }
  },
  {
    id: "conn_crm", name: "HubSpot CRM", type: "crm", status: "degraded", lastSuccess: "2026-06-08T14:10:00Z", errorCount: 14, uptime: 94.2,
    auth: {
      status: "reauth_due", checkedAt: "2026-06-08T14:12:00Z", nextReviewAt: "2026-06-08T16:00:00Z",
      expiresAt: "2026-06-08T18:00:00Z", renewalWindowHours: 4,
      operatorAction: "Refresh OAuth grant and review the missing CRM write scope before replaying upserts; owner Nina Vasquez.",
      scopeReview: {
        expectedScopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"], observedScopes: ["crm.objects.contacts.read"], missingScopes: ["crm.objects.contacts.write"],
        evidence: "HubSpot token introspection still reads contacts but no longer grants contact write permission."
      }
    }
  },
  {
    id: "conn_sheets", name: "Google Sheets", type: "spreadsheet", status: "healthy", lastSuccess: "2026-06-08T15:32:00Z", errorCount: 0, uptime: 100,
    auth: {
      status: "valid", checkedAt: "2026-06-08T15:22:00Z", nextReviewAt: "2026-06-15T15:22:00Z",
      expiresAt: "2026-07-08T15:22:00Z", renewalWindowHours: 72,
      operatorAction: "No action needed; monitor quota and key rotation in the weekly review.",
      scopeReview: {
        expectedScopes: ["spreadsheets.readonly", "spreadsheets.values.append"], observedScopes: ["spreadsheets.readonly", "spreadsheets.values.append"], missingScopes: [],
        evidence: "Google tokeninfo confirms Sheets read and append scopes remain active."
      }
    }
  },
  {
    id: "conn_zapier", name: "Legacy Zapier Bridge", type: "integration", status: "down", lastSuccess: "2026-06-07T22:15:00Z", errorCount: 47, uptime: 67.3,
    auth: {
      status: "expired", checkedAt: "2026-06-08T09:55:00Z", nextReviewAt: "2026-06-08T10:15:00Z",
      expiresAt: "2026-06-07T22:00:00Z", renewalWindowHours: 24,
      operatorAction: "Keep connector isolated and review missing legacy webhook scopes until the replacement workflow is live; do not replay queued payloads.",
      scopeReview: {
        expectedScopes: ["legacy.webhook.manage", "legacy.workflow.execute"], observedScopes: [], missingScopes: ["legacy.webhook.manage", "legacy.workflow.execute"],
        evidence: "Legacy bridge OAuth token endpoint returns invalid_grant, so no required webhook scopes are observable."
      }
    }
  }
];

export const demoWorkflows: WorkflowDefinition[] = [
  {
    id: "wf_lead_enrich", name: "Lead Enrichment Pipeline", description: "New CRM lead → AI research → enrichment fields → Slack notify sales",
    stepCount: 5, connectorCount: 3, lastRun: "2026-06-08T15:30:00Z", successRate: 94,
    dependsOnConnectorIds: ["conn_crm", "conn_slack"],
    steps: [
      { id: "s1", type: "trigger", label: "CRM: New Lead Created", config: "Watch HubSpot for new contact with lifecycle_stage = 'lead'" },
      { id: "s2", type: "ai_analyze", label: "AI: Research Company", config: "Look up company domain, headcount, industry, recent news" },
      { id: "s3", type: "transform", label: "Transform: Score & Enrich", config: "Calculate lead score from signals. Map to enrichment fields." },
      { id: "s4", type: "crm_upsert", label: "CRM: Update Lead Record", config: "Write enrichment fields back to HubSpot contact" },
      { id: "s5", type: "outbound_slack", label: "Slack: Notify Sales", config: "Post to #sales-leads with summary and link to CRM record" }
    ]
  },
  {
    id: "wf_invoice_chase", name: "Overdue Invoice Follow-up", description: "Daily scan → filter overdue >30d → AI draft email → approval gate → send",
    stepCount: 6, connectorCount: 3, lastRun: "2026-06-08T08:00:00Z", successRate: 87,
    dependsOnConnectorIds: ["conn_sheets", "conn_gmail", "conn_slack"],
    steps: [
      { id: "s1", type: "trigger", label: "Sheets: Scan Invoice Tracker", config: "Read Google Sheet. Filter status = 'sent' AND days_overdue > 30" },
      { id: "s2", type: "ai_generate", label: "AI: Draft Follow-up Email", config: "Generate polite but firm email with invoice #, amount, due date" },
      { id: "s3", type: "approval_gate", label: "Approval: Review Draft", config: "Operator must review and approve/change/reject email draft" },
      { id: "s4", type: "outbound_email", label: "Gmail: Send Follow-up", config: "Send via Gmail. BCC ops@ for audit trail." },
      { id: "s5", type: "sheets_append", label: "Sheets: Log Follow-up", config: "Append row with date, invoice #, email sent status to tracker" },
      { id: "s6", type: "outbound_slack", label: "Slack: Report to Ops", config: "Post summary to #ops-automation" }
    ]
  },
  {
    id: "wf_support_triage", name: "Support Ticket Triage", description: "New Zendesk ticket → AI classify urgency → route to team",
    stepCount: 4, connectorCount: 3, lastRun: "2026-06-08T15:20:00Z", successRate: 96,
    dependsOnConnectorIds: ["conn_crm", "conn_slack"],
    steps: [
      { id: "s1", type: "trigger", label: "Trigger: New Ticket", config: "Zendesk webhook on ticket.created" },
      { id: "s2", type: "ai_analyze", label: "AI: Classify & Route", config: "Classify urgency, sentiment, category. Determine target team." },
      { id: "s3", type: "crm_upsert", label: "CRM: Update Customer", config: "Update support tier and last ticket date on customer record" },
      { id: "s4", type: "outbound_slack", label: "Slack: Alert Team", config: "Post to target team channel with ticket summary" }
    ]
  }
];

const leadEnrichSteps: StepRunResult[] = [
  { stepId: "s1", stepLabel: "CRM: New Lead Created", status: "success", input: "Trigger: HubSpot webhook — contact 48291 (\"DataVista Inc\")", output: "Lead extracted: DataVista Inc, domain datavista.io, 47 employees", duration: 0.3, retries: 0 },
  { stepId: "s2", stepLabel: "AI: Research Company", status: "success", input: "Company: DataVista Inc, domain: datavista.io", output: "Industry: AI/ML infrastructure. Recent: raised $12M Series A (Mar 2026). Growth: 47→62 employees in 6 months.", duration: 2.1, retries: 0 },
  { stepId: "s3", stepLabel: "Transform: Score & Enrich", status: "success", input: "Research data + CRM fields", output: "Lead score: 87/100 (high growth, recent funding, ICP match). Enriched fields: industry, headcount, funding_stage, recent_news_summary.", duration: 0.1, retries: 0 },
  { stepId: "s4", stepLabel: "CRM: Update Lead Record", status: "success", input: "Enrichment fields for contact 48291", output: "HubSpot contact updated: 7 fields written. No conflicts.", duration: 0.8, retries: 0 },
  { stepId: "s5", stepLabel: "Slack: Notify Sales", status: "success", input: "Lead summary for #sales-leads", output: "Message posted to #sales-leads. 3 sales reps mentioned.", duration: 0.4, retries: 0 }
];

export const demoActiveRun: WorkflowRun = {
  id: "run_042", workflowId: "wf_lead_enrich", workflowName: "Lead Enrichment Pipeline",
  status: "completed", startedAt: "2026-06-08T15:30:00Z", duration: 3.7,
  stepResults: leadEnrichSteps, costEstimate: 0.12, costActual: 0.09
};

export const demoRunHistory: WorkflowRun[] = [
  demoActiveRun,
  {
    id: "run_041", workflowId: "wf_invoice_chase", workflowName: "Overdue Invoice Follow-up",
    status: "awaiting_approval", startedAt: "2026-06-08T08:00:00Z", duration: 0,
    stepResults: [
      { stepId: "s1", stepLabel: "Sheets: Scan Invoice Tracker", status: "success", input: "Sheet ID: inv_tracker_2026", output: "3 invoices >30 days overdue found. Total: $24,700", duration: 0.5, retries: 0 },
      { stepId: "s2", stepLabel: "AI: Draft Follow-up Email", status: "success", input: "Invoice #INV-2847 ($8,200, 47 days overdue) — WestGate Partners", output: "Email draft: Subject \"Invoice INV-2847 — Payment Overdue\". Body: polite reminder with payment link.", duration: 1.8, retries: 0 }
    ],
    costEstimate: 0.15, costActual: 0.06
  },
  {
    id: "run_040", workflowId: "wf_support_triage", workflowName: "Support Ticket Triage",
    status: "failed", startedAt: "2026-06-08T15:20:00Z", duration: 1.2,
    stepResults: [
      { stepId: "s1", stepLabel: "Trigger: New Ticket", status: "success", input: "Webhook: ticket #T-5829 created", output: "Ticket: \"API returning 500 errors on /v2/export\" — customer: Acme Corp", duration: 0.2, retries: 0 },
      { stepId: "s2", stepLabel: "AI: Classify & Route", status: "success", input: "Ticket: API 500 errors, Acme Corp", output: "Urgency: critical. Sentiment: frustrated. Category: API/infrastructure. Route to: engineering-oncall.", duration: 1.0, retries: 0 },
      { stepId: "s3", stepLabel: "CRM: Update Customer", status: "failed", input: "Customer: Acme Corp, update support_tier", output: "", duration: 0, error: "HubSpot CRM API: 503 Service Unavailable after 3 retries (30s timeout each). Connector status downgraded to degraded.", retries: 3, errorCategory: "transient" },
      { stepId: "s4", stepLabel: "Slack: Alert Team", status: "skipped", input: "Skipped — CRM step failed", output: "", duration: 0, retries: 0 }
    ],
    costEstimate: 0.08, costActual: 0.04
  }
];

export const demoApprovals: ApprovalRequest[] = [
  {
    id: "app_001", runId: "run_041", workflowName: "Overdue Invoice Follow-up",
    stepLabel: "AI: Draft Follow-up Email", action: "Send email to WestGate Partners re: INV-2847",
    detail: "Subject: \"Invoice INV-2847 — Payment Overdue\"\nTo: billing@westgate-partners.com\nBody: [AI-generated draft — 3 paragraphs, polite but firm, includes payment link]\n\nInvoice: #INV-2847\nAmount: $8,200\nDue: 2026-04-22 (47 days overdue)\n\nThis email will be sent via Gmail and BCC'd to ops@.",
    requestedAt: "2026-06-08T08:02:00Z"
  }
];

export const demoAuditLog: AuditLogEntry[] = [
  { id: "aud_001", runId: "run_042", action: "workflow_completed", detail: "Lead Enrichment Pipeline: DataVista Inc scored 87/100. Slack notification sent.", timestamp: "2026-06-08T15:30:04Z", cost: 0.09 },
  { id: "aud_002", runId: "run_041", action: "approval_required", detail: "Overdue Invoice Follow-up: email draft for INV-2847 awaiting operator approval.", timestamp: "2026-06-08T08:02:00Z", cost: 0.06 },
  { id: "aud_003", runId: "run_040", action: "connector_failure", detail: "Support Ticket Triage: CRM step failed — HubSpot 503. Workflow terminated. Connector downgraded.", timestamp: "2026-06-08T15:21:12Z", cost: 0.04 },
  { id: "aud_004", runId: "run_039", action: "connector_health", detail: "Legacy Zapier Bridge: connector down for >12h (last success: 2026-06-07 22:15). 47 errors in last 30 days.", timestamp: "2026-06-08T10:00:00Z", cost: 0 },
  { id: "aud_005", runId: "run_038", action: "workflow_completed", detail: "Support Ticket Triage: ticket #T-5828 routed to engineering-oncall. Slack alert sent.", timestamp: "2026-06-08T15:15:00Z", cost: 0.07 }
];

export const demoWebhookRecovery: WebhookRecoveryEvent[] = [
  {
    id: "dlq_001", workflowId: "wf_support_triage", provider: "Zendesk", connectorId: "conn_crm",
    receivedAt: "2026-06-08T15:20:05Z", traceId: "trc_ticket_5829",
    idempotencyKey: "idem_zendesk_T-5829_crm_upsert_v1",
    failureReason: "HubSpot CRM returned 503 after provider-aware exponential backoff while its OAuth grant was due for reauthorization.",
    retryCount: 3, maxRetries: 3, status: "quarantined",
    deadLetteredAt: "2026-06-08T15:21:12Z", replaySafe: false,
    operatorAction: "Refresh the HubSpot OAuth grant before any replay; then re-check the credential gate and preserve the trace ID.",
    duplicateAttemptCount: 2, dedupeWindowExpiresAt: "2026-06-08T16:21:12Z",
    errorCategory: "transient", credentialGate: "reauth_required",
    signatureVerification: {
      status: "verified", signedAt: "2026-06-08T15:20:02Z", checkedAt: "2026-06-08T15:20:05Z",
      toleranceSeconds: 300, evidence: "Zendesk HMAC signature matched the endpoint secret before the payload entered the recovery queue."
    }
  },
  {
    id: "dlq_002", workflowId: "wf_lead_enrich", provider: "HubSpot", connectorId: "conn_crm",
    receivedAt: "2026-06-08T15:30:03Z", traceId: "trc_contact_48291",
    idempotencyKey: "idem_hubspot_48291_enrichment_v1",
    failureReason: "Provider retried after a slow acknowledgement, but the original contact update already succeeded.",
    retryCount: 3, maxRetries: 3, status: "quarantined",
    deadLetteredAt: "2026-06-08T15:30:48Z", replaySafe: false,
    operatorAction: "Reject the stale webhook timestamp, request a fresh signed delivery, and re-check credentials before any manual replay.",
    duplicateAttemptCount: 3, dedupeWindowExpiresAt: "2026-06-08T16:30:48Z",
    errorCategory: "permanent", credentialGate: "reauth_required",
    signatureVerification: {
      status: "stale_timestamp", signedAt: "2026-06-08T15:19:50Z", checkedAt: "2026-06-08T15:30:03Z",
      toleranceSeconds: 300, evidence: "The HMAC matched, but the signed timestamp was outside the five-minute replay-attack tolerance."
    }
  },
  {
    id: "dlq_003", workflowId: "wf_lead_enrich", provider: "Slack", connectorId: "conn_slack",
    receivedAt: "2026-06-08T15:30:04Z", traceId: "trc_slack_lead_48291",
    idempotencyKey: "idem_slack_lead_48291_notification_v1",
    failureReason: "Slack returned a transient 429 during provider retry; auth was checked and remains valid.",
    retryCount: 3, maxRetries: 3, status: "ready_for_replay",
    deadLetteredAt: "2026-06-08T15:32:10Z", replaySafe: true,
    operatorAction: "Replay after the rate-limit window resets; Slack credential gate is clear and trace ID prevents duplicate alerts.",
    duplicateAttemptCount: 0, dedupeWindowExpiresAt: "2026-06-08T16:32:10Z",
    errorCategory: "transient", credentialGate: "clear",
    signatureVerification: {
      status: "verified", signedAt: "2026-06-08T15:30:01Z", checkedAt: "2026-06-08T15:30:04Z",
      toleranceSeconds: 300, evidence: "Slack signing-secret verification passed within the accepted timestamp tolerance."
    },
    rateLimitRecovery: {
      retryAfterSeconds: 60, retryNotBefore: "2026-06-08T15:33:10Z",
      evidence: "Slack HTTP 429 returned Retry-After: 60; replay stayed paused until the provider window elapsed."
    }
  }
];

export const demoConcurrencySummary: ExecutionConcurrencySummary = {
  limit: 8,
  activeExecutions: 8,
  queuedExecutions: 5,
  oldestQueuedAt: "2026-06-08T15:29:42Z",
  queueDiscipline: "fifo",
  scope: "production_webhook_and_trigger_runs",
  status: "at_capacity",
  operatorAction: "Add worker capacity or reduce long-running execution time before the FIFO queue exceeds its response-time SLO."
};

export const demoCircuitBreakers: ConnectorCircuitBreaker[] = [
  {
    id: "cb_crm_api",
    connectorId: "conn_crm",
    state: "open",
    failureThreshold: 3,
    recentFailures: 4,
    openedAt: "2026-06-08T15:21:12Z",
    probeAfter: "2026-06-08T15:26:12Z",
    blockedExecutionCount: 6,
    operatorAction: "Keep HubSpot calls failed fast until the five-minute recovery window ends, then allow one health probe before resuming queued work."
  }
];

export const demoRedriveControls: DlqRedriveControl[] = [
  {
    id: "redrive_slack_429",
    connectorId: "conn_slack",
    status: "canary",
    eligibleMessageCount: 12,
    canaryBatchSize: 2,
    releasedMessageCount: 0,
    remainingMessageCount: 12,
    maxMessagesPerMinute: 10,
    nextBatchNotBefore: "2026-06-08T15:33:10Z",
    operatorAction: "Release a two-message canary after the Slack recovery window, monitor errors for five minutes, then ramp to 10 per minute; pause on any new 429."
  }
];

export const demoCostSummary: CostSummary = {
  totalRuns: 42, totalCost: 3.47, budgetLimit: 20.00,
  costByWorkflow: [
    { name: "Lead Enrichment Pipeline", cost: 1.42, runs: 18 },
    { name: "Overdue Invoice Follow-up", cost: 0.89, runs: 6 },
    { name: "Support Ticket Triage", cost: 1.16, runs: 18 }
  ]
};

export const demoSnapshot: OpsSnapshot = {
  members: demoMembers,
  connectors: demoConnectors,
  workflows: demoWorkflows,
  activeRun: demoActiveRun,
  runHistory: demoRunHistory,
  approvals: demoApprovals,
  auditLog: demoAuditLog,
  webhookRecovery: demoWebhookRecovery,
  concurrency: demoConcurrencySummary,
  circuitBreakers: demoCircuitBreakers,
  redriveControls: demoRedriveControls,
  costSummary: demoCostSummary
};
