# AWS GitOps Infrastructure Plan

## Context

This project runs locally via Docker Compose (14+ containers) behind Traefik. No CI/CD or cloud infra exists yet. The goal is to stand up a fully GitOps-driven AWS environment where GitHub is the single control plane: OpenTofu provisions infrastructure, ArgoCD deploys workloads, and SWEs never touch the AWS console after initial bootstrap.

## Design Decisions (from user input)

- **Fully parameterized**: All config (org name, project name, domain, AWS account, region, service list) is variable-driven so this recipe is reusable across projects
- **Domain**: Support both "bring your own domain" (point NS to Route53) and "register new via Route53" — domain is an optional variable; ALB URLs work without one
- **Dev deployment**: Auto-deploy on merge to main. Stage/prod require explicit PR-based promotion
- **Conductor**: Keep it, but treat Postgres + Redis as pluggable backing services (RDS/ElastiCache) — no hardcoded assumptions about where they run

---

## Repo Structure

**Same repo, dedicated `infra/` subtree.** Small team, monorepo already uses Turborepo. Separate repos add coordination overhead. Path filters in GitHub Actions keep pipelines isolated.

```
infra/
  config.yaml             # ← PROJECT PARAMS: project name, org, region, domain,
                          #   service list, swim lanes, backing service config
  bootstrap/              # One-time manual apply (state backend, OIDC, IAM)
  foundation/             # OpenTofu: VPC, EKS, ECR, core AWS
    environments/
      dev.tfvars           # Generated / inherits from config.yaml
      stage.tfvars
      prod.tfvars
  platform/               # ArgoCD app-of-apps
    argocd-bootstrap/     #   Helm values for initial ArgoCD install
    app-of-apps/          #   Root Application
    platform-apps/        #   Platform component Argo Applications
  charts/                 # Helm charts
    service/              #   Generic shared chart for all app services
    conductor/            #   Conductor server chart (pluggable backing services)
  apps/                   # Per-service Argo Application definitions (or ApplicationSet)
    base/                 #   Shared values per service
    dev/
    stage/
    prod/
  crossplane/             # Compositions + Claims for AWS resources
    compositions/         #   Reusable: rds-postgres, elasticache-redis, s3-bucket, msk
    claims/{dev,stage,prod}/
  local/tf/               # Existing local dev (unchanged)

.github/workflows/
  ci.yaml                 # Lint + test on PR
  build-push.yaml         # Build images → ECR on merge to main (auto-deploys dev)
  infra-plan.yaml         # tofu plan on PR touching infra/foundation/
  infra-apply.yaml        # tofu apply on merge to main
```

### Parameterization: `infra/config.yaml`

Single source of truth for project-level config. Referenced by OpenTofu (as vars), Helm (as values), and GHA workflows. Example shape:

```yaml
project: aegir
github_org: my-org
aws_region: us-east-1
domain: aegir.dev # optional — omit for ALB-only
services: # drives ECR repos, ApplicationSet, Helm values
  - name: app
    port: 3000
    path: /app
  - name: gateway
    port: 4000
    path: /api/graphql
    strip_prefix: /api
  # ...
swim_lanes:
  dev: { cluster: dev, auto_sync: true }
  stage: { cluster: dev, auto_sync: false }
  prod: { cluster: prod, auto_sync: false }
backing_services:
  postgres:
    {
      type: rds,
      dev_instance: db.t4g.micro,
      prod_instance: aurora-serverless-v2,
    }
  redis:
    {
      type: elasticache,
      dev_instance: cache.t4g.micro,
      prod_instance: serverless,
    }
  s3: { type: s3 }
  kafka: { type: in-cluster, prod_override: msk-serverless }
```

---

## Layer 1: Bootstrap (Manual, One-Time)

The only human-at-terminal step. `infra/bootstrap/main.tf` provisions:

1. **S3 bucket** for OpenTofu state: `${var.project}-tofu-state-${data.aws_caller_identity.current.account_id}` (versioned, encrypted)
2. **DynamoDB table** for state locking: `${var.project}-tofu-locks`
3. **GitHub OIDC Identity Provider** in AWS IAM
4. **IAM Role `${var.project}-github-infra`** — trusted by OIDC, scoped to `repo:${var.github_org}/${var.github_repo}:*`
5. **IAM Role `${var.project}-github-deploy`** — scoped to `main` branch, ECR push + EKS describe + Secrets Manager read
6. **ECR repositories** — dynamically created from `var.services` list (currently 7: app, gateway, iam, legal, agents, orchestration, conductor-cdc)

All names derived from `var.project` + `var.github_org`. No hardcoded values.

Manual steps: `aws configure` → edit `terraform.tfvars` (project, org, region) → `tofu init && tofu apply` → set GitHub secrets (account ID, region) → done.

---

## Layer 2: Foundation (OpenTofu via GitHub Actions)

### VPC

- Dev/stage share one VPC (`10.0.0.0/16`), prod gets its own (`10.1.0.0/16`)
- 3 AZs: public, private (pods/nodes), intra (RDS/ElastiCache) subnets
- Single NAT for dev/stage, HA NAT (per-AZ) for prod
- Uses `terraform-aws-modules/vpc/aws`

### EKS — Two Clusters Total

| Cluster           | Swim Lanes             | Nodes                                                             |
| ----------------- | ---------------------- | ----------------------------------------------------------------- |
| `${project}-dev`  | dev + stage namespaces | Spot `m7i.large` (2-6) + On-Demand `t3.medium` system (1-2)       |
| `${project}-prod` | prod namespace         | On-Demand `m7i.large` (3-10) + On-Demand `t3.medium` system (2-3) |

- Uses `terraform-aws-modules/eks/aws`
- Addons: CoreDNS, kube-proxy, vpc-cni, EBS CSI, pod-identity-agent
- IRSA enabled, etcd encryption via KMS

### ArgoCD Bootstrap

- Installed via `helm_release` in OpenTofu (the only Helm release Tofu manages)
- After install, a root `Application` points to `infra/platform/app-of-apps/` — ArgoCD self-manages from here

---

## Layer 3: Platform (ArgoCD App-of-Apps)

ArgoCD auto-installs these platform components:

| Component                        | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| **AWS Load Balancer Controller** | ALB ingress (replaces Traefik) — native ACM TLS, WAF integration   |
| **external-dns**                 | Auto-creates Route53 records from Ingress hosts                    |
| **cert-manager**                 | TLS for internal services if needed (ALB handles external TLS)     |
| **External Secrets Operator**    | Syncs AWS Secrets Manager → K8s Secrets                            |
| **Crossplane + provider-aws**    | Declarative AWS resource provisioning (RDS, ElastiCache, S3, etc.) |
| **kube-prometheus-stack**        | Prometheus + Grafana + Alertmanager                                |
| **Loki + Tempo**                 | Logs + distributed tracing                                         |

---

## Layer 4: Service Mapping (Docker Compose → AWS)

| Local Service                     | AWS Target                                                                     | Provisioned By            |
| --------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| **postgres**                      | RDS PostgreSQL (dev: `t4g.micro`, prod: Aurora Serverless v2)                  | Crossplane Claim          |
| **redis**                         | ElastiCache Redis (dev: `t4g.micro`, prod: Serverless)                         | Crossplane Claim          |
| **minio**                         | S3 (direct — app already uses S3-compatible API)                               | Crossplane Claim          |
| **redpanda**                      | Dev/stage: in-cluster Redpanda. Prod: MSK Serverless                           | Crossplane Claim / ArgoCD |
| **debezium-connect**              | In-cluster Deployment (all envs)                                               | ArgoCD                    |
| **conductor**                     | In-cluster Deployment (all envs), pluggable Postgres + Redis (RDS/ElastiCache) | ArgoCD (custom chart)     |
| **conductor-ui**                  | In-cluster (dev/stage only)                                                    | ArgoCD                    |
| **keycloak**                      | In-cluster via Keycloak Operator (all envs), backed by RDS                     | ArgoCD                    |
| **traefik**                       | Replaced by AWS ALB via LB Controller                                          | Foundation layer          |
| **grafana/prometheus/loki/tempo** | In-cluster via kube-prometheus-stack + loki + tempo charts                     | ArgoCD                    |
| **mailhog**                       | Dev: in-cluster. Stage/prod: AWS SES                                           | ArgoCD / Crossplane       |

### Database Architecture

Same pattern as local: single RDS instance, multiple databases (aegir, conductor, keycloak, conductor_cdc), schema-per-service isolation (iam, legal). Crossplane provisions the RDS instance; a post-provision K8s Job runs the init SQL (porting `infra/local/tf/modules/postgres/`). Keycloak realm config ported to Keycloak Operator CRDs.

---

## Layer 5: Application Deployment

### Shared Helm Chart

One chart (`infra/charts/aegir-service/`) for all 7 deployables. Per-service overrides via values files for: image, port, ingress path, env vars, resources, replicas.

### ArgoCD ApplicationSet

Matrix generator: `[dev, stage, prod] × [app, gateway, iam, legal, agents, orchestration, conductor-cdc]` — auto-generates all Application resources. No need to maintain 21 individual YAML files.

### Image Build Pipeline (GitHub Actions)

1. PR → `ci.yaml`: lint + test
2. Merge to `main` → `build-push.yaml`: Turborepo `--filter` detects changed packages, builds multi-stage Docker images, pushes to ECR as `{repo}:{git-sha}`
3. Dev auto-deploys (ArgoCD automated sync)
4. Stage/prod promotion: PR updating image tag in values files → review → merge → ArgoCD syncs

### Routing (Traefik → ALB Ingress)

Current Traefik paths map 1:1 to ALB Ingress path rules:

- `/app` → app service
- `/api/graphql` → gateway (strip `/api`)
- `/api/iam` → iam (strip `/api/iam`)
- `/infra/idp` → keycloak
- etc.

One consolidated Ingress resource per namespace = one ALB per swim lane.

---

## Layer 6: Swim Lane Model

A swim lane = a **Kubernetes namespace** with dedicated resource claims.

| Lane  | Cluster         | Namespace          | Infra                                                                  |
| ----- | --------------- | ------------------ | ---------------------------------------------------------------------- |
| dev   | ${project}-dev  | `${project}-dev`   | Shared RDS t4g.micro, shared ElastiCache, in-cluster Redpanda          |
| stage | ${project}-dev  | `${project}-stage` | Same RDS instance (separate DB), same ElastiCache, in-cluster Redpanda |
| prod  | ${project}-prod | `${project}-prod`  | Aurora Serverless, HA ElastiCache, MSK Serverless                      |

Creating a lane = add dirs under `infra/apps/{lane}/` + `infra/crossplane/claims/{lane}/`. ApplicationSet picks it up. Destroying = delete dirs, ArgoCD prunes, Crossplane deletes AWS resources.

NetworkPolicies + ResourceQuotas enforce isolation between lanes on shared clusters.

---

## Secrets Strategy

AWS Secrets Manager, organized as:

```
${project}/{env}/database/{service}   → connection strings
${project}/{env}/keycloak             → client secrets
${project}/{env}/conductor            → redis/db config
${project}/{env}/smtp                 → SES credentials
${project}/{env}/integrations         → DocuSign, Google Drive, etc.
```

External Secrets Operator syncs these into K8s Secrets per namespace.

---

## DNS & TLS

**If domain is provided** (in `config.yaml`):

- Route53 hosted zone created in foundation layer (or imported if pre-existing)
- `dev.{domain}`, `stage.{domain}`, `{domain}` (prod)
- Wildcard ACM cert (`*.{domain}`) for ALB TLS termination (free, auto-renewing)
- external-dns auto-manages records from Ingress annotations

**If no domain** (early dev / cost-saving):

- ALB-generated URLs work out of the box (HTTP only)
- Domain can be added later by setting the variable and re-applying

---

## Implementation Sequence

| Phase | Work                                                                         | Dependencies |
| ----- | ---------------------------------------------------------------------------- | ------------ |
| 0     | AWS account + domain + manual bootstrap                                      | None         |
| 1     | Foundation: VPC, EKS, ECR, GitHub Actions workflows                          | Phase 0      |
| 2     | Platform: ArgoCD app-of-apps (LB controller, ESO, Crossplane, observability) | Phase 1      |
| 3     | Data plane: Crossplane compositions + dev claims (RDS, ElastiCache, S3)      | Phase 2      |
| 4     | Apps: Shared Helm chart, Dockerfiles, build pipeline, dev Argo Applications  | Phase 3      |
| 5     | Stateful services: Keycloak Operator + Conductor + Debezium on K8s           | Phase 4      |
| 6     | Stage + prod swim lanes, promotion workflows                                 | Phase 5      |
| 7     | Hardening: NetworkPolicies, PodSecurity, alerting, backups, DR               | Phase 6      |

---

## Estimated Monthly Cost

|                          | Dev/Stage (shared) | Prod                     |
| ------------------------ | ------------------ | ------------------------ |
| EKS control plane        | $73                | $73                      |
| EC2 nodes                | ~$90 (Spot)        | ~$300 (On-Demand)        |
| RDS                      | $13 (t4g.micro)    | ~$60 (Aurora Serverless) |
| ElastiCache              | $12                | ~$40                     |
| NAT Gateway              | $32                | $96 (HA)                 |
| ALB                      | $16                | $16                      |
| Other (S3, ECR, R53, SM) | ~$7                | ~$8                      |
| **Total**                | **~$243/mo**       | **~$593/mo**             |

---

## Critical Files to Reference

- `.devcontainer/docker-compose.yml` — all service deps, ports, env vars
- `.devcontainer/traefik/dynamic.yml` — routing topology → ALB Ingress rules
- `infra/local/tf/modules/postgres/main.tf` — DB role/schema pattern to replicate
- `infra/local/tf/modules/keycloak/main.tf` — realm config → Keycloak Operator CRDs
- `.devcontainer/postgres/init-databases.sql` — multi-DB init to port as K8s Job
- `scripts/init.sh` — initialization logic

---

## Verification Plan

1. **Bootstrap**: `tofu apply` succeeds, OIDC role assumable from GitHub Actions
2. **Foundation**: GHA workflow runs `tofu plan` on PR, `tofu apply` on merge; EKS cluster reachable via `kubectl`
3. **Platform**: ArgoCD UI accessible, all platform apps healthy
4. **Data plane**: Crossplane claims show `Ready=True`, RDS/ElastiCache endpoints reachable from pods
5. **Apps**: All services running in `aegir-dev` namespace, ingress paths return expected responses
6. **E2E**: Nuxt app loads at `dev.aegir.dev/app`, authenticates via Keycloak, hits GraphQL gateway
