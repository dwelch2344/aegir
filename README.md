# aegir

aegir is a multi-tenant platform that provides **AI Employees** — domain-grounded AI agents paired with traditional software automation — that replace manual operational toil and enable businesses to scale workloads traditionally assigned to human staff.

## The Problem

Many industries run on repetitive, multi-step operational workflows that span multiple systems — CRMs, portals, email, document signing, licensing databases. These workflows are too complex for simple automation but too routine to justify the cost and scaling limits of dedicated human staff. Businesses either throw bodies at the problem or accept bottlenecks.

## The Product

aegir provides AI Employees that understand a specific business domain and can execute end-to-end workflows across integrated systems. Each AI Employee combines:

- **Traditional software automation** for structured, deterministic steps (data entry, document routing, status tracking)
- **Domain-grounded AI agents** for steps requiring judgment, interpretation, or adaptation (eligibility decisions, follow-up timing, exception handling)
- **Human-in-the-loop checkpoints** where oversight or approval is needed

The platform is multi-tenant — each customer gets their own configured instance with their carriers, contacts, templates, and business rules.

## First Use Case: Healthcare General Agency Contracting

aegir's first AI Employee handles **broker-to-carrier contracting** for Healthcare General Agencies (GAs). GAs like Health First Insurance act as intermediaries: they onboard insurance brokers/agents and facilitate contracting those brokers with health insurance carriers so the brokers can sell the carriers' plans.

This process today is entirely manual — a contracting team spends ~60 hours/week on repetitive steps across 6+ systems (email, DocuSign, carrier portals, CRM, licensing databases, document storage). The target is a 90% reduction in manual effort.

**Pilot customer**: Health First Insurance (HFI), based in Utah, managing contracting across 19+ carriers in multiple states.

**Phase 1 scope**: New broker contracting for 3 carriers — Select Health, University of Utah Health Plan, and Regence (BCBS). Detailed process documentation lives in [`docs/biz/`](docs/biz/).

## Tech Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js (TypeScript)                              |
| Database        | PostgreSQL                                        |
| Object Storage  | S3 (MinIO for local dev)                          |
| API             | Federated GraphQL (Mercurius gateway + subgraphs) |
| Frontend        | Nuxt 3 (Vue 3 + SSR) + Tailwind CSS               |
| Services        | Fastify microservices                             |
| Infrastructure  | OpenTofu                                          |
| Dev Environment | DevContainers, Turborepo, Traefik reverse proxy   |

## Repo Structure

```
packages/
  common/            — @aegir/common: shared utilities (env, logging)
  domain/            — @aegir/domain: shared domain types (User, Organization)
services/
  gateway/           — @aegir/gateway: Mercurius federated GraphQL gateway (:4000)
  iam/               — @aegir/iam: identity & organization subgraph (:4001)
  legal/             — @aegir/legal: contracts & agreements subgraph (:4002)
apps/
  app/               — @aegir/app: Nuxt 3 SSR frontend (:3000)
docs/biz/            — Business process documentation (domain knowledge)
.agents/reference/   — AI contributor operating model
.devcontainer/       — Local dev environment (Postgres, MinIO, Traefik)
```

## Development

```bash
pnpm dev       # Start all services in parallel (via Turborepo)
pnpm build     # Build all packages
pnpm test      # Run all tests
```

All services are available through Traefik on **port 8080**:

| Path           | Routes To                 |
| -------------- | ------------------------- |
| `/app`         | Nuxt frontend             |
| `/api/graphql` | Federated GraphQL gateway |
| `/api/iam/*`   | IAM subgraph              |
| `/api/legal/*` | Legal subgraph            |

Traefik dashboard: **port 8081**

## Key Concepts

- **AI Employee**: A configured agent that handles a specific operational domain end-to-end
- **Tenant**: A customer organization (e.g., HFI) with its own carriers, contacts, workflows, and data
- **Carrier**: An insurance company that brokers contract with to sell plans (e.g., Select Health, Regence)
- **Contracting**: The multi-step process of getting a broker authorized to sell a carrier's plans
- **Agent Intel**: HFI's internal system for broker profile and contract status management
