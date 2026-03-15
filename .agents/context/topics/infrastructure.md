# Topic: Infrastructure (System)

> General infrastructure and IaC best practices.
> Project-specific conventions are in `project/topics/infrastructure.md`.

## IaC Principles (OpenTofu / Terraform)

- Infrastructure is code — version controlled, reviewed, tested
- State is sacred — never manually edit `.tfstate`; use remote backends
- Modules encapsulate reusable infrastructure units
- Plan before apply — always review `tofu plan` output
- Use workspaces or separate state files per environment

## Docker Compose (Local Dev)

- One service per container — no multi-process containers
- Use named volumes for data persistence across restarts
- Health checks enable dependency ordering (`depends_on: condition: service_healthy`)
- Pin image versions — avoid `:latest` in committed configs
- Use `.env` or environment blocks for configuration injection

## Reverse Proxy (Traefik)

- Path-based routing: single entrypoint fans out to backend services
- Strip path prefixes when backends don't expect them
- Health check endpoints for automatic service discovery
- TLS termination at the proxy layer in production

## Database Infrastructure

- Schema-per-service isolation in shared instances (dev/local)
- Dedicated instances per service in production (or Aurora clusters)
- Enable WAL logical replication if CDC is needed
- Per-service database users with scoped permissions

## Cloud Patterns (AWS)

- **Networking**: VPC with public/private subnets, NAT gateway
- **Compute**: EKS for container orchestration; Fargate for serverless workloads
- **Data**: RDS/Aurora for relational; ElastiCache for caching; MSK for Kafka
- **Secrets**: AWS Secrets Manager + External Secrets Operator in K8s
- **CI/CD**: GitHub Actions → ECR → ArgoCD → EKS (GitOps)

## Observability

- **Metrics**: Prometheus scrape → Grafana dashboards
- **Logs**: Structured JSON → Loki (or CloudWatch)
- **Traces**: OpenTelemetry → Tempo (or X-Ray)
- Every service exposes `/health` and `/metrics` endpoints
