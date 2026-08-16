# Workflow Automation Ops Studio

Build, test, and monitor AI-powered workflow automations. Sandbox-test before production. Trace every step with input/output snapshots. See which integrations are healthy and which are silently failing. Human approval gates before any outbound action. no more "the automation sent 47 wrong emails."

This is a portfolio demonstration of production workflow automation patterns: sandbox testing, step-level execution traces, integration health monitoring, approval gates, retry policies, and cost tracking.

## Who this is for

**Ops teams running automations across Gmail, Slack, CRM, and Sheets.** If your Make.com zaps break silently and nobody knows until a customer complains, this shows what real observability looks like.

**Engineering teams evaluating workflow automation capabilities.** It proves you understand the hard parts: testing before production, debugging opaque failures, approval gates for outbound actions, and cost tracking per workflow.

**AI agents and technical screeners.** It compiles, passes lint/typecheck/test/build. The step execution trace, integration health panel, and approval gate system are all visible on a single dashboard.

## Project story

The most-cited frustration with workflow automation tools is silent failure. HN users describe zaps that break for months with no alerting, no auto-recovery, and no way to test before deploying. One commenter summarized it: *"You end up with a lot of orphan and broken 'scripts' deployed only to the production environment by well-meaning operators who can't really test or maintain them."*

This project addresses those failures directly:

- **Sandbox testing**: run any workflow against synthetic data before deploying. See step outputs without triggering real outbound actions
- **Step execution trace**: every step shows input, output, duration, status, and error details. Click any step to see what happened. No more "which step failed?" guessing
- **Integration health dashboard**: all connectors (Gmail, Slack, CRM, Sheets, Zapier bridge) show status, last success, error count, and uptime %. Degraded and down connectors are flagged
- **Approval gates**: any outbound action (email send, Slack post, CRM write) requires human approval. The approval queue shows exactly what will be sent before it goes out
- **Cost tracking**: per-workflow cost with estimated vs. actual. Budget tracking across all runs

The demo models three workflows: lead enrichment, overdue invoice follow-up, and support ticket triage. with 5 connectors and real-feeling failure scenarios.

![](docs/screenshots/01-dashboard-hero.png)

*Above: the ops studio dashboard showing workflow definitions, integration health, and system stats.*

## What you're looking at

| Screenshot | What it shows |
|---|---|
| `01-dashboard-hero.png` | Landing view: workflow stats, connector health summary, pending approvals, monthly cost |
| `02-integration-health-workflows.png` | Integration health panel with status dots, uptime percentages, and error counts + workflow definitions with step cards |
| `03-step-execution-trace.png` | Active run with step-by-step trace: input/output snapshots, duration, status per step |
| `04-approval-gates.png` | Approval gate with email draft awaiting human sign-off (accept/edit/reject) + sandbox test CTA |
| `05-cost-tracking-audit.png` | Cost tracking per workflow with budget gauge + audit log of all actions |
| `00-full-page.png` | Full-page portfolio screenshot |

## Features

- **Integration health dashboard**: 5 connectors with live status (healthy/degraded/down), last success timestamp, error counts, and uptime percentages
- **Sandbox testing**: Run any workflow against mock data to see step outputs without triggering real outbound actions
- **Step execution trace**: Every step shows input text, output text, duration, status (success/failed/skipped), retry count, and error details
- **Approval gates**: Outbound actions (email, Slack, CRM writes) require human approval. Queue shows draft content before sending
- **Workflow definitions**: 3 workflows with step cards showing the full pipeline (trigger → AI → transform → connector → outbound)
- **Run cost tracking**: Per-workflow cost with estimated vs. actual. Monthly budget gauge
- **Retry policies**: Failed steps show retry count and error reason (e.g., "HubSpot CRM API: 503 after 3 retries")
- **Audit log**: Every action recorded with cost, timestamp, and detail
- **Schedule health**: Missed scheduled runs surface with a catch-up policy (skip, bounded backfill, or hold for decision) and overlap prevention, so a quiet schedule never becomes a silent failure

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Testing | Vitest: 60 tests covering connector health, credential drift, concurrency pressure, circuit breakers, DLQ redrive, deduplication, overage exposure, timeouts, and schedule health |
| CI | GitHub Actions |
| Data | TypeScript fixture data, no real connectors, no API keys required |

## Architecture

```
src/app/page.tsx              ← Dashboard: integration health, workflow builder, step trace, approvals, cost, audit log
  → src/lib/demo-data.ts      ← Fixture data: 5 connectors, 3 workflows, 3 runs, 1 approval, 5 audit entries
  → src/lib/types.ts          ← Domain types: connectors, workflows, runs, steps, approvals, audit entries
```

The dashboard renders from static fixture data. All connector statuses, workflow runs, step traces, and audit entries are pre-computed demo data, no real integrations, no network calls. This is intentional: the demo proves observability and governance patterns without infrastructure.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality gates

```bash
npm run lint        # ESLint with zero warnings
npm run typecheck   # TypeScript strict mode
npm test            # Vitest. 60 tests
npm run build       # Production build
```

## Demo data

All data is fictional and public-safe:

- 5 connectors: Gmail (healthy), Slack (healthy), HubSpot CRM (degraded), Google Sheets (healthy), Legacy Zapier Bridge (down)
- 3 workflows: Lead Enrichment Pipeline, Overdue Invoice Follow-up, Support Ticket Triage
- 3 recent runs: completed (lead enrichment), awaiting approval (invoice follow-up), failed (support triage. CRM connector failure)
- 1 approval request with draft email content
- 5 audit log entries with cost tracking
- 3 schedule health records: an on-time fallback poll, a weekday scan behind with a bounded backfill of 1, and a silently stopped weekly digest awaiting a catch-up decision

## Screenshot refresh

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3110
SCREENSHOT_URL=http://127.0.0.1:3110 node scripts/capture-screenshots.mjs
```

## Production roadmap

- Real connector implementations with OAuth and retry/backoff
- WebSocket-based live run status updates
- Drag-and-drop workflow builder
- Workflow version control and export as JSON/YAML
- Per-tenant workspace isolation

## Safety

- No real API keys, secrets, or credentials committed
- All companies, people, and data are fictional
- No network calls; all data is static fixture data
- Approval gates are the default for outbound actions

---

Built as a portfolio demonstration of production workflow automation patterns. Ready for review.
