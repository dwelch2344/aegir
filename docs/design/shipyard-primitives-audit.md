# Shipyard Primitives Audit: What Already Exists

## Context

This report reverse-engineers the thinking behind every primitive, service, and infrastructure component already present in the aegir repository. The project was "reverse forked" on 2026-03-11 — meaning existing, working code from a real product was abstracted into a reusable platform foundation. Everything here is battle-tested, not theoretical.

---

## 1. The Harness (Local Dev Environment = K8s Mirror)

The `.devcontainer/docker-compose.yml` + `devcontainer.json` setup is the foundational primitive. It creates a **local development experience that is structurally identical to a Kubernetes deployment**, so that code written locally runs identically in production without environment-specific conditionals.

### How it mirrors K8s

| Production (K8s) Pattern | Local Equivalent |
|---|---|
| Ingress controller / API gateway | **Traefik** on port 7356 with path-based routing |
| Service discovery | Docker Compose DNS (`postgres`, `keycloak`, `redpanda`, etc.) |
| ConfigMaps | Environment variables in docker-compose.yml |
| Secrets (Sealed/External Secrets) | Mounted `/home/node/.secrets/` + `.envrc` via direnv |
| Init containers | `init-databases.sql` + `01-enable-replication.sh` |
| Liveness/readiness probes | Docker `healthcheck` directives on every service |
| Namespaced service isolation | PostgreSQL schema-per-service with role-based grants |
| OpenTelemetry collector | Direct OTLP export to Tempo (gRPC 4317, HTTP 4318) |
| Persistent volumes | Named Docker volumes for stateful services |

### Traefik Routing (the local "Ingress")

All traffic enters through `localhost:7356` and is path-routed:

```
/app/*              → Nuxt frontend (3000)
/api/graphql        → GraphQL gateway (4000)
/api/iam/*          → IAM subgraph (4001)
/infra/idp/*        → Keycloak (8080)
/infra/grafana/*    → Grafana (3000)
/infra/conductor/*  → Conductor UI (5000)
/infra/redpanda/*   → Redpanda Console (8080)
/infra/mailhog/*    → MailHog UI (8025)
```

This single-port, path-routed model is identical to how an ALB or Ingress controller would work in production.

### Why this matters for the Shipyard

This harness IS a catalog pattern. Every ship needs a local dev environment. The compose file, Traefik config, init scripts, and health checks are parameterizable — swap service names, ports, and paths and you have a new ship's harness.

---

## 2. Identity & Multi-Tenancy

### Keycloak (OIDC Identity Provider)

Managed via OpenTofu (`infra/local/tf/modules/keycloak/`):

- **Realm: `global`** — single realm, multi-org via Keycloak Organizations (v26.5 feature)
- **Google IdP federation** — OIDC with IMPORT sync mode (users created on first login)
- **Two OIDC clients:**
  - `aegir-app` — confidential client for the Nuxt frontend (authorization code flow)
  - `aegir-admin-api` — service account for M2M realm management (manage-users, view-users, manage-realm)
- **Email verification required**, login with email enabled
- **SMTP routed to MailHog** for local dev (noreply@aegir.local)

### Multi-Tenancy Design

The multi-tenancy model uses **Keycloak Organizations** as the source of truth, synced into application-level data:

1. **Keycloak Organizations** — tenant boundaries at the IdP level
2. **IAM service** syncs org data into `iam.organization` table (with `keycloak_id` FK)
3. **Identity records** belong to organizations (`organization_id` on `iam.identity`)
4. **Agents conversations** are org-scoped (`organization_id` on `agents.conversation`)
5. **Nuxt frontend** has org-aware composables (`useOrg.ts`) and full CRUD API routes for orgs + members

### Database-Level Isolation

OpenTofu provisions **schema-per-service** with dedicated users:
- `iam_svc` → owns `iam` schema
- `agents_svc` → (implied by pattern)
- `legal_svc` → owns `legal` schema (future service)
- Each user gets `CREATE`, `USAGE` on their schema + `SELECT/INSERT/UPDATE/DELETE` on tables

This is the Postgres equivalent of K8s namespace isolation.

### Why this matters for the Shipyard

Auth and multi-tenancy are the hardest 20% of any SaaS. This is a complete, working pattern: IdP setup, OIDC flows, M2M service accounts, org management API, and database isolation. It's catalog pattern `auth.oidc-keycloak` + `tenancy.org-based` waiting to be formalized.

---

## 3. GraphQL Federation (Mercurius + Moribashi)

### Architecture

```
Client → Gateway (4000) → IAM subgraph (4001)
                        → Agents subgraph (4003)
                        → (future subgraphs)
```

- **Gateway** (`services/gateway`) — Mercurius federation gateway with service discovery, polling (5s), and retry logic (10 attempts, 3s delay)
- **Subgraphs** use the **Moribashi** framework: schema-first GraphQL with DI containers, migration support, and federation decorators
- **Each subgraph** owns its types and resolvers; the gateway composes them

### What Moribashi provides

- Dependency injection (awilix-based cradle)
- PostgreSQL plugin with migration runner
- Web plugin (Fastify integration)
- GraphQL plugin (Mercurius federation)
- Convention-driven naming and structure

### Current GraphQL Surface

**IAM subgraph:**
- Types: `Identity`, `Organization`
- Queries: `iam.identities.search()`, `iam.orgs.search()`
- Mutations: `iam.orgs.sync()` (sync from Keycloak)
- Subscriptions: `iamEcho`, `iamNotifications`

**Agents subgraph:**
- Types: `AgentsConversation`, `AgentsMessage`
- Queries: `agents.conversations.search()`
- Mutations: `agents.conversations.create/update/delete/addMessage/sendMessage()`
- Subscriptions: `agentsMessageAdded()`

### Why this matters for the Shipyard

Federated GraphQL is the API composition pattern. Adding a new domain to a ship = adding a new subgraph that automatically composes into the gateway. The Moribashi conventions ensure consistency across subgraphs. This is catalog pattern `api.graphql-federation`.

---

## 4. Workflow Orchestration (Conductor)

### What's running

- **Netflix Conductor** (v3.22.0) — workflow engine with PostgreSQL persistence and Redis queuing
- **Orchestration service** (`services/orchestration`) — registers workflow definitions and runs task workers
- **Conductor UI** — custom-built from source, served behind Traefik at `/infra/conductor/`

### Workflow Capabilities Demonstrated

The orchestration service shows three patterns any ship could use:

1. **Simple sequential workflow** — e.g. `new_user_setup`: validate input → provision account → send welcome email → notify admin. Linear task chain, no human interaction.
2. **Multi-step with human-in-the-loop** — e.g. `document_approval`: submit document → auto-validate → WAIT for reviewer approval → countersign → finalize. Uses Conductor's WAIT task type so a human can unblock the flow via API signal.
3. **Persistent conversational loop** — `agent_chat_conversation`: start workflow → WAIT for user message → gather context → invoke Claude → deliver response → loop back to WAIT. Keeps a long-running workflow alive across many interactions.

### Task Worker Pattern

Workers poll Conductor for tasks, execute business logic, and report results:
- AI context gathering → LLM invocation → response delivery
- Email sending via SMTP (MailHog locally, SES/SendGrid in prod)
- Business process steps with human-in-the-loop WAIT tasks

### CDC Pipeline (Conductor → Kafka → Postgres)

The `conductor-cdc` service creates a **real-time event stream** from Conductor's internal state:

```
Conductor DB (Postgres, WAL)
  → Debezium (logical replication)
    → Redpanda (raw JSON topics)
      → CDC Processor (normalizes to Avro)
        → Redpanda (normalized topics)
          → Sink consumers
            → conductor_cdc DB (raw events)
            → aegir.conductor schema (denormalized for app queries)
```

This means any service can react to workflow state changes without coupling to Conductor's API.

### Why this matters for the Shipyard

Long-running, multi-step processes with human-in-the-loop are universal. The Conductor setup + CDC pipeline is catalog pattern `orchestration.conductor` + `cdc.debezium-kafka`. The agent chat workflow specifically shows how to wire AI into orchestrated processes.

---

## 5. Event Streaming & CDC

### Infrastructure

- **Redpanda** — Kafka-compatible broker (in-memory, single-node for dev)
- **Debezium Connect** — captures PostgreSQL WAL changes
- **Schema Registry** — Avro schema validation (built into Redpanda)

### Topics

| Topic | Format | Purpose |
|---|---|---|
| `conductor.cdc.public.workflow` | JSON (Debezium) | Raw workflow state changes |
| `conductor.cdc.public.task` | JSON (Debezium) | Raw task state changes |
| `conductor.workflow.events` | Avro | Normalized workflow events |
| `conductor.task.events` | Avro | Normalized task events |

### Why this matters for the Shipyard

Event-driven architecture is the pattern for decoupling services. The Debezium + Kafka + Avro pipeline is reusable for any service that needs to broadcast state changes. Catalog pattern: `messaging.kafka-cdc`.

---

## 6. Observability Stack

### Components

| Tool | Role | Port |
|---|---|---|
| **Grafana** | Unified dashboard | 3000 (at `/infra/grafana`) |
| **Prometheus** | Metrics scraping | 9090 |
| **Loki** | Log aggregation | 3100 |
| **Tempo** | Distributed tracing (OTLP) | 3200 (gRPC: 4317, HTTP: 4318) |
| **Promtail** | Log shipping (Docker containers → Loki) | 9080 |

### What's wired up

- **Conductor** exports traces to Tempo via OpenTelemetry Java agent
- **Prometheus** scrapes Conductor metrics at `/actuator/prometheus`
- **Promtail** tails all Docker container logs → Loki
- **Grafana** has provisioned datasources (Prometheus, Loki, Tempo) + a Conductor dashboard

### Why this matters for the Shipyard

Every ship needs observability. This is a complete, pre-wired stack: traces, metrics, and logs unified in Grafana. Catalog pattern: `observability.grafana-stack`.

---

## 7. Object Storage (MinIO/S3)

- **MinIO** runs locally as S3-compatible storage
- Bucket: `aegir-docs`
- Endpoint: `minio:9000` (API), `minio:9001` (console)
- In production: direct swap to AWS S3

Catalog pattern: `storage.s3`.

---

## 8. Email (MailHog)

- **MailHog** captures all SMTP on port 1025, UI on 8025
- Keycloak sends verification/password-reset emails through it
- Orchestration workers send welcome emails through it
- In production: swap to SES/SendGrid

Catalog pattern: `email.smtp`.

---

## 9. Frontend (Nuxt 3 SPA)

- **Nuxt 3** in SPA mode (SSR disabled) with Vue 3 Composition API
- **Tailwind CSS** — dark theme, utility-only (no component library)
- **nuxt-oidc-auth** — OIDC integration with Keycloak
- **Server API routes** — proxy to Keycloak Admin API for org/user management
- **Composables** — `useOrg.ts`, `useAgent.ts` for state management
- **Design system documented** in `docs/design/nuxt.md` (color palette, component patterns, layout)

Catalog pattern: `frontend.nuxt-spa`.

---

## 10. Build & Monorepo Tooling

- **pnpm** workspaces — package management
- **Turborepo** — build orchestration with dependency-aware task graph
- **tsup** — TypeScript bundling for all services/packages
- **vitest** — testing across all packages
- **Biome** — linting/formatting

Catalog pattern: `build.pnpm-turbo`.

---

## 11. Infrastructure as Code (OpenTofu)

### Local (`infra/local/tf/`)
- PostgreSQL module: user/schema/grant provisioning
- Keycloak module: realm, IdP, OIDC clients, SMTP

### Cloud plan (`docs/infra-plan.md`)
- Full AWS migration plan: VPC, EKS, ArgoCD, Crossplane
- Parameterized via `infra/config.yaml` — project name, services, swim lanes, backing services
- 8-phase implementation: bootstrap → foundation → platform → services → hardening
- Cost estimates: ~$243/mo (dev/stage) + ~$593/mo (prod)
- Designed to be **fully reusable across projects** (swap config.yaml = new ship's infra)

Catalog pattern: `infra.aws-eks-gitops`.

---

## Summary: Catalog Patterns Already Implemented

| Pattern ID (proposed) | Status | What exists |
|---|---|---|
| `harness.devcontainer` | Working | Docker Compose + Traefik + devcontainer.json |
| `auth.oidc-keycloak` | Working | Keycloak realm, OIDC clients, Nuxt integration |
| `tenancy.org-based` | Working | Keycloak Orgs + schema isolation + org-scoped data |
| `api.graphql-federation` | Working | Mercurius gateway + Moribashi subgraphs |
| `orchestration.conductor` | Working | Conductor + task workers + 3 workflow patterns (sequential, human-in-the-loop, conversational loop) |
| `cdc.debezium-kafka` | Working | Debezium → Redpanda → Avro → sink consumers |
| `observability.grafana-stack` | Working | Grafana + Prometheus + Loki + Tempo + Promtail |
| `storage.s3` | Working | MinIO locally, S3 in prod |
| `email.smtp` | Working | MailHog locally, SES/SendGrid in prod |
| `frontend.nuxt-spa` | Working | Nuxt 3 + Tailwind + OIDC auth |
| `build.pnpm-turbo` | Working | pnpm workspaces + Turborepo + tsup |
| `db.postgres-isolated` | Working | Schema-per-service + OpenTofu provisioning |
| `infra.aws-eks-gitops` | Planned | Full AWS/EKS/ArgoCD plan documented |
| `agents.ai-conversation` | Working | Agents service + Conductor workflows + Claude |

---

## The Big Picture

The Shipyard's value proposition is already proven by what exists: this codebase contains **14 reusable, production-grade patterns** that any new project ("ship") would otherwise spend months building from scratch. The reverse fork on 2026-03-11 extracted these from a working product, which means they're not hypothetical — they've been tested under real load with real users.

What remains is formalization: extracting these patterns into the Catalog format (id, version, preconditions, provides, application_instructions, test_criteria) so the Scaffolder and Applicator can apply them systematically to new ships.
