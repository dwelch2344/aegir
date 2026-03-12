# Select Health ACA New Contract — Implementation Report

## What Was Built

A full-stack feature modeling the **Select Health ACA New Contract** process from `docs/biz/healthfirst/02-select-health-new-contract.md`. The 16-step manual process was collapsed into 7 automated Conductor workflow tasks, with a Nuxt UI to kick off and monitor workflows via GraphQL.

### Flow

```
Nuxt UI (form) → GraphQL mutation → Legal subgraph → Orchestration REST → Conductor workflow
                                                                              ↓
                                                              7 sequential SIMPLE tasks
                                                              (workers poll + execute)
                                                                              ↓
Nuxt UI (status) ← GraphQL query ← Legal subgraph ← Orchestration REST ← Conductor API
```

---

## Files Created

### Orchestration Service (workflow engine)

| File | Description |
|------|-------------|
| `services/orchestration/src/workers/sh-validate-agent-info.ts` | **Real logic** — validates agent fields + residency eligibility (UT/ID/CO/NV with CO exception for non-residents who have C4 cert + CO license) |
| `services/orchestration/src/workers/sh-create-sircon-affiliation.ts` | **Stub** — logs Sircon DOI affiliation creation |
| `services/orchestration/src/workers/sh-request-contract.ts` | **Stub** — logs email to Amy Koncar + Agent Intel status update |
| `services/orchestration/src/workers/sh-agent-signs-docusign.ts` | **Stub** — logs DocuSign delivery + agent signature |
| `services/orchestration/src/workers/sh-hf-countersign-and-training.ts` | **Stub** — logs HF countersign, training email, Andrew Freeze sign |
| `services/orchestration/src/workers/sh-carrier-processing.ts` | **Stub** — logs carrier processing + doc distribution |
| `services/orchestration/src/workers/sh-finalize-contract.ts` | **Stub** — logs Google Drive filing, Agent Intel completion, RTS email |

### Legal Subgraph (GraphQL surface)

| File | Description |
|------|-------------|
| `services/legal/src/contracting/contractingWorkflow.svc.ts` | Moribashi service that proxies to orchestration REST API |

### Nuxt App (frontend)

| File | Description |
|------|-------------|
| `apps/app/composables/useContracting.ts` | GraphQL client composable for contracting mutations/queries |
| `apps/app/pages/office/contracting/new.vue` | New contract form — agent info, state selection, CO exception UI |
| `apps/app/pages/office/contracting/[id].vue` | Workflow status tracker with task stepper + polling |

## Files Modified

| File | Changes |
|------|---------|
| `services/orchestration/src/conductor.ts` | Added `getWorkflow()` |
| `services/orchestration/src/definitions.ts` | Added 7 task defs + `select_health_aca_new_contract` workflow |
| `services/orchestration/src/worker-runner.ts` | Wired 7 new handlers |
| `services/orchestration/src/app.ts` | Added `POST /contracting/select-health` + `GET /contracting/status/:id`, registers new workflow |
| `services/legal/src/schema.ts` | Added `Legal` namespace with contracting queries + `LegalOps` mutations |
| `services/legal/src/resolvers.ts` | Added resolvers for contracting workflow operations |
| `apps/app/pages/office/index.vue` | Replaced empty state with contracting workflow list + "New Contract" button |

---

## How It Maps to the Business Process

The 16-step Select Health ACA process (doc `02-select-health-new-contract.md`) maps to the workflow as follows:

| Workflow Task | Business Steps | What Happens Today |
|--------------|----------------|-------------------|
| `sh_validate_agent_info` | Steps 1-2: Collect info + residency check | **Implemented** — validates fields, checks UT/ID/CO/NV residency, handles CO exception |
| `sh_create_sircon_affiliation` | Step 3: Create Sircon affiliation | **Stubbed** — would call Sircon API with HF EIN 464344936 |
| `sh_request_contract` | Steps 4-5: Email carrier + update Agent Intel | **Stubbed** — would send email to amy.koncar@selecthealth.org + update Agent Intel |
| `sh_agent_signs_docusign` | Steps 6-7: DocuSign sent to agent + agent signs | **Stubbed** — would integrate with DocuSign API |
| `sh_hf_countersign_and_training` | Steps 8-11: HF signs, training, Andrew Freeze signs | **Stubbed** — would integrate DocuSign + email |
| `sh_carrier_processing` | Steps 12-14: Carrier processes + docs distributed | **Stubbed** — would poll carrier system or await webhook |
| `sh_finalize_contract` | Steps 15-16: File docs + send RTS confirmation | **Stubbed** — would integrate Google Drive + Agent Intel + email |

---

## Where to Start Implementing for Real

### ~~Priority 1: Email Integration (Steps 3, 10, 16)~~ DONE

Implemented with a raw SMTP client (`services/orchestration/src/integrations/email.ts`) that sends to MailHog in dev. Two emails are now live:

1. **Request email to Amy Koncar** (Step 3) — sends via `sh-request-contract` with the exact template from the biz doc
2. **RTS confirmation to agent** (Step 16) — sends via `sh-finalize-contract` with contract details
3. **Training notification** (Step 10) — still a stub (sent by Andrew Freeze at Select Health, may not need automation)

Config: All SMTP settings are env-driven via `config.smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, etc.). For production, either configure a real SMTP relay or swap the raw client for an email service API.

### ~~Priority 2: Agent Intel Integration (Steps 4, 7, 9, 15)~~ DONE (client ready, no live endpoint)

Implemented an Agent Intel API client (`services/orchestration/src/integrations/agent-intel.ts`) that is wired into 4 workers:
- `sh-request-contract` → updates to `contract_requested`
- `sh-agent-signs-docusign` → updates to `agent_signed`
- `sh-hf-countersign-and-training` → updates to `hf_signed` then `fully_signed`
- `sh-finalize-contract` → updates to `ready_to_sell`

Config: `AGENT_INTEL_URL` + `AGENT_INTEL_API_KEY`. When URL is empty/default, calls are logged but not executed (safe for dev). When a live Agent Intel instance is available, set the env vars and the full status machine will flow.

### NEW Priority 1: Config Module

All integration credentials and URLs are centralized in `services/orchestration/src/config.ts` with env variable hooks. Env vars are declared in `.devcontainer/docker-compose.yml`. No code changes needed when moving to dev/stage/prod — just set the env vars.

| Integration | Env Vars | Status |
|-------------|----------|--------|
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME` | Live (MailHog) |
| Agent Intel | `AGENT_INTEL_URL`, `AGENT_INTEL_API_KEY` | Client ready, no endpoint |
| DocuSign | `DOCUSIGN_BASE_URL`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY` | Config ready, not implemented |
| Google Drive | `GOOGLE_DRIVE_CREDENTIALS_PATH`, `GOOGLE_DRIVE_CONTRACTING_FOLDER_ID`, `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID` | Config ready, not implemented |
| Sircon | `SIRCON_URL`, `SIRCON_HF_EIN` | Config ready, not implemented |
| Select Health | `SH_CARRIER_CONTACT_EMAIL`, `SH_TRAINING_CONTACT_EMAIL`, `SH_WRITING_NUMBER` | Live |

### NEW Priority 2: Convert Stubs to WAIT/HUMAN Tasks

The current implementation uses SIMPLE tasks for everything, meaning stubs execute instantly. In reality:
- **DocuSign signing** (steps 6-8, 11) should be WAIT tasks that pause until a webhook/signal arrives
- **Carrier processing** (step 12) should be a WAIT task
- Conductor supports `WAIT` and `HUMAN` task types for this pattern
- Would need a webhook endpoint to receive DocuSign completion callbacks and signal the waiting task

### Priority 4: DocuSign Integration (Steps 5-8, 11, 13-14)

Most complex integration. DocuSign handles:
- Sending paperwork to agent (from `dse_NA3@docusign.net`)
- Agent signature capture
- HF countersignature (Brandon Combs signs as "Health First Insurance")
- Andrew Freeze signature
- Completed document distribution

DocuSign Connect webhooks would feed into the WAIT tasks from Priority 3.

### Priority 5: Google Drive Integration (Step 14)

File completed DocuSign documents to agent's folder:
- Path: `agents/{Last, First}/Select Health/`
- Google Drive API with service account
- Template folder copying from onboarding (step 4c of general onboarding)

### Priority 6: Sircon Integration (Step 2)

DOI affiliation creation. Sircon may only have a web portal (no API), which would need:
- Browser automation (Playwright), or
- Manual step with a HUMAN task that presents instructions to the operator

---

## Architectural Notes

- **Workflow naming**: `sh_` prefix on all Select Health tasks. When Regence and U of U workflows are added, use `rg_` and `uu_` prefixes.
- **GraphQL conventions**: Followed Moribashi namespacing — `Legal.contracting.workflowStatus()` for queries, `LegalOps.contracting.startSelectHealth()` for mutations.
- **Moribashi service naming**: Service files must use camelCase (e.g., `contractingWorkflow.svc.ts`), not kebab-case. The DI scanner derives the container name from the filename: `contractingWorkflow.svc.ts` → `contractingWorkflowService`.
- **Gateway race condition**: The federated gateway can crash if subgraphs aren't up yet. The retry config (10 retries, 3s interval) sometimes isn't enough. If the gateway is down after a restart, touch any file in `services/gateway/src/` to trigger tsx watch restart.
- **localStorage for workflow list**: The Office page stores `{workflowId, agentName, startedAt}` in `localStorage`. This is a demo shortcut — should be replaced with a GraphQL query that lists workflows from Conductor or a database.

## What's Not Covered Yet

From the broader Health First onboarding docs:
- **General onboarding flow** (`01-general-onboarding-flow.md`) — the 4-phase process that happens *before* carrier contracting. This is a separate workflow that should feed into the carrier-specific ones.
- **Freeze dates** — Select Health freezes new ACA contracts Nov 1 - Feb 1. The validation task should check this.
- **Medicare process** — documented as "Need Chris" in the source data. No content available.
- **Regence** (`04-regence-new-contract.md`) and **University of Utah** (`03-university-of-utah-new-contract.md`) carrier workflows.
- **Contract transfers** — different from new contracts, not yet modeled.
