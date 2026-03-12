# aegir — Platform Overview

## What Is aegir?

aegir is a multi-tenant platform that builds **AI Employees** — domain-grounded AI agents paired with software automation to replace manual operational toil. Each AI Employee handles a specific operational domain end-to-end for a customer organization (tenant).

## First Customer: Health First Insurance (HFI)

**Problem:** HFI is a Utah-based general agency that manages broker-to-carrier contracting for healthcare insurance. Their staff spends ~60 hours/week on manual contracting workflows across 6+ disconnected systems.

**Goal:** 90% reduction in manual effort (60 → 6 hrs/week).

**Phase 1 Scope:** New broker contracting for 3 carriers, handling ~800–1,000 requests/year (~20/week).

---

## The Business Domain: Insurance Broker Contracting

When a broker wants to sell insurance plans from a carrier (e.g., Select Health, Regence), they go through a multi-step "contracting" process — gathering credentials, signing documents, getting appointed, and eventually being marked "Ready to Sell." HFI manages this process on behalf of brokers.

### Phase 1 Carriers

| Carrier                | Complexity   | States         | Lines of Business   | Method                           |
| ---------------------- | ------------ | -------------- | ------------------- | -------------------------------- |
| **Select Health**      | Medium       | UT, ID, CO, NV | ACA, Medicare       | Email to carrier → DocuSign flow |
| **University of Utah** | Simplest     | UT only        | ACA Individual only | HF-initiated DocuSign → Email    |
| **Regence** (BCBS)     | Most complex | UT, ID         | ACA, Medicare       | Portal-based submission          |

Select Health accounts for ~50% of total volume.

### Contracting Workflow (Simplified)

Every carrier follows roughly the same pattern:

1. **Gather info** — NPN, licenses, E&O insurance, state certifications
2. **Create DOI affiliation** in Sircon
3. **Submit contracting request** — via email, DocuSign, or carrier portal
4. **Track status** in Agent Intel (3–5 updates per contract)
5. **Wait for carrier processing** + follow up as needed
6. **File completed docs** in Google Drive
7. **Mark "Ready to Sell"** in Agent Intel and notify the broker

### Universal Agent Prerequisites

- Health, Accident & Sickness Producer License (per state)
- Errors & Omissions (E&O) policy — minimum $1M coverage
- State certifications (FFM for UT, YHI for ID, C4 for CO)
- DOI affiliation via Sircon (Health First EIN: 464344936)

---

## Systems HFI Uses Today (Integration Targets)

| System              | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| **Agent Intel**     | Broker profile + contract status tracking (primary system of record) |
| **DocuSign**        | Contract signing workflows                                           |
| **Sircon**          | DOI affiliation management                                           |
| **Traise**          | CRM                                                                  |
| **Google Drive**    | Document filing                                                      |
| **Google Sheets**   | Agent tracking for specific groups                                   |
| **1Password**       | Credential management                                                |
| **Carrier Portals** | Select Health Link, Regence Producer Center, U of U eApp             |

---

## Tech Stack

- **Monorepo** — pnpm + Turborepo
- **Language** — Node.js / TypeScript (ESM throughout)
- **API** — Federated GraphQL via Mercurius (gateway + subgraphs)
- **Frontend** — Nuxt 3 (Vue 3 + SSR) + Tailwind CSS
- **Database** — PostgreSQL
- **Object Storage** — S3 (MinIO for local dev)
- **Infrastructure** — OpenTofu, DevContainers, Traefik reverse proxy
- **GraphQL Conventions** — Moribashi framework

### Repository Structure

```
packages/
  common/            @aegir/common — shared utilities (env, logging)
  domain/            @aegir/domain — shared domain types (User, Organization)
services/
  gateway/           @aegir/gateway — Mercurius federated GraphQL gateway (:4000)
  iam/               @aegir/iam — identity & organization subgraph (:4001)
  legal/             @aegir/legal — contracts & agreements subgraph (:4002)
apps/
  app/               @aegir/app — Nuxt 3 SSR frontend (:3000)
docs/biz/            Business process documentation (domain knowledge)
.agents/reference/   AI contributor operating model
.devcontainer/       Local dev environment (Postgres, MinIO, Traefik)
```

### Service Routing (Traefik on :8080)

- `/app` → Nuxt frontend
- `/api/graphql` → Federated GraphQL gateway
- `/api/iam/*` → IAM subgraph
- `/api/legal/*` → Legal subgraph
- Dashboard: `:8081`

### Dev Commands

- `pnpm dev` — Start all services (Turborepo)
- `pnpm build` — Build all packages
- `pnpm test` — Run all tests

---

## Known Gaps & Risks

- **Medicare processes undocumented** — blocked on info from "Chris" for Select Health and Regence Medicare flows
- **Credentials exposed in Trello** — security risk from source data migration
- **Process inconsistencies** — Sircon uses NPN for some carriers, SSN for others; conflicting Regence submission methods in docs
- **Early-stage codebase** — schemas are stubs, no data sources connected, no GraphQL client in frontend yet

---

## Strategic Vision

Once Phase 1 validates the approach with 3 carriers, expansion to 16+ additional carriers should be largely **configuration-driven** rather than requiring new logic. The long-term competitive moat lives in accumulated domain knowledge (memory), operational visibility (observability), and continuous improvement (learning loops).

Detailed architecture docs: [docs/biz/strategic-content/](biz/strategic-content/)
Carrier-specific process docs: [docs/biz/healthfirst/](biz/healthfirst/)
