# Topic: Infrastructure — Aegir Project

## Local Stack (DevContainer)

14+ services via Docker Compose at `.devcontainer/docker-compose.yml`:

| Service | Port | Purpose |
|---------|------|---------|
| Traefik | 7356 | Reverse proxy — single entrypoint for all services |
| PostgreSQL 16 | 5432 | Shared DB, schema-per-service isolation |
| Keycloak | - | OIDC IdP (behind Traefik at `/infra/idp`) |
| Conductor | 8080 | Workflow engine (UI at `/infra/conductor`) |
| Redpanda | 29092 | Kafka-compatible broker |
| Redis | 6379 | Caching |
| MinIO | 9000 | S3-compatible object storage |
| Debezium | 8083 | CDC connector (PostgreSQL → Kafka) |
| MailHog | 1025 | SMTP sink for dev emails |
| Grafana/Tempo/Loki | - | Observability stack |

## Traefik Routing

Config at `.devcontainer/traefik/dynamic.yml`:
- `/app` → Nuxt (:3000)
- `/api/graphql` → Gateway (:4000, strips `/api`)
- `/api/iam`, `/api/system`, `/api/projects` → domain services
- `/infra/*` → infrastructure UIs (Conductor, Grafana, Redpanda)

## IaC (OpenTofu)

- Local provisioning: `infra/local/tf/`
- Modules: `postgres` (schema + user provisioning), `keycloak` (realm config)
- Database init: `.devcontainer/postgres/init-databases.sql`

## Database Architecture

- Single Postgres instance, multiple databases: `aegir`, `keycloak`, `conductor`, `conductor_cdc`
- Schema-per-service in `aegir`: `iam`, `system`, `legal`, `agents`
- WAL logical replication enabled for Debezium CDC
- Flyway migrations: `V{semver}__{snake_case}.sql`

## Cloud Plan (AWS — not yet implemented)

- **Bootstrap**: S3 state backend, GitHub OIDC, IAM roles
- **Foundation**: VPC, EKS (dev+stage shared, prod isolated), ECR
- **Platform**: ArgoCD, ALB Controller, External Secrets, Crossplane
- **Data**: Crossplane claims for RDS, ElastiCache, S3, MSK
- Estimated: ~$243/mo dev/stage, ~$593/mo prod
- Docs: `docs/infra-plan.md`, `docs/infra-distributed-plan.md`

## CI/CD

- GitHub Actions with path-filtered workflows
- `biome check .` for formatting + lint
- `tsc --noEmit` per service for type checking
- `pnpm test` via Turborepo for all services
