# aegir

aegir is a multi-tenant platform built on a federated GraphQL microservice architecture with a Nuxt 3 frontend, OIDC-based authentication, and a full local development stack.

## Tech Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js (TypeScript)                              |
| Database        | PostgreSQL                                        |
| Object Storage  | S3 (MinIO for local dev)                          |
| API             | Federated GraphQL (Mercurius gateway + subgraphs) |
| Frontend        | Nuxt 3 (Vue 3 + SSR) + Tailwind CSS              |
| Services        | Fastify microservices                             |
| Auth            | OIDC via Keycloak                                 |
| Infrastructure  | OpenTofu                                          |
| Dev Environment | DevContainers, Turborepo, Traefik reverse proxy   |

## Repo Structure

```
packages/
  common/            — @aegir/common: shared utilities (env, logging)
  domain/            — @aegir/domain: shared domain types (Identity, Organization)
services/
  gateway/           — @aegir/gateway: Mercurius federated GraphQL gateway (:4000)
  iam/               — @aegir/iam: identity & organization subgraph (:4001)
  agents/            — @aegir/agents: AI conversation subgraph (:4003)
  orchestration/     — @aegir/orchestration: Conductor workflow task workers (:4010)
  conductor-cdc/     — @aegir/conductor-cdc: change data capture from Conductor
apps/
  app/               — @aegir/app: Nuxt 3 SSR frontend (:3000)
.agents/reference/   — AI contributor operating model
.devcontainer/       — Local dev environment (Postgres, Keycloak, MinIO, Traefik, etc.)
infra/               — OpenTofu infrastructure-as-code
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

Traefik dashboard: **port 8081**

### Infrastructure Services (DevContainer)

| Service         | Purpose                      |
| --------------- | ---------------------------- |
| PostgreSQL      | Primary database                  |
| Keycloak        | OIDC identity provider            |
| Conductor       | Workflow orchestration engine      |
| MinIO           | S3-compatible object storage      |
| Redpanda        | Kafka-compatible streaming        |
| Redis           | Caching (Conductor backing store) |
| Debezium        | CDC from Conductor Postgres       |
| Mailhog         | Local email testing               |
| Grafana + stack | Observability (logs, traces)      |
| Traefik         | Reverse proxy / routing           |
