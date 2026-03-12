# Distributed GitOps Infrastructure Plan

## Context

The original [infra-plan.md](infra-plan.md) assumes a single monorepo owns everything: cluster provisioning, platform services, application code, and deployment manifests. That works for a single team with one project, but breaks down when:

- **Multiple projects** need to share the same clusters and platform tooling
- **Other teams or orgs** want to adopt the same infrastructure recipe without forking it
- **Platform concerns evolve independently** from any single application's release cycle

This document redesigns the architecture as a **two-repo split**: a shared **platform repo** that manages clusters and platform services, and per-project **application repos** that declare what they need and deploy their own workloads.

---

## The Split

### Platform Repo (`infra-platform`)

Owns everything below the application layer: AWS accounts, networking, clusters, platform services, reusable compositions, and shared Helm charts. One team (or one person early on) manages this. All projects on the platform consume it.

### Application Repo(s) (e.g., this repo)

Owns application code, Dockerfiles, CI pipelines, and a lightweight `infra/` directory that declares project-specific config: what services to deploy, what backing resources to claim, and per-environment overrides. The application repo never provisions a VPC or installs ArgoCD — it just registers itself with the platform.

---

## Design Decisions

### S3 Native State Locking

OpenTofu's S3 backend supports native state locking (`use_lockfile = true`) without a DynamoDB table. One fewer resource to provision and pay for. The bootstrap layer creates only the S3 state bucket (versioned, encrypted) — no DynamoDB.

### Terragrunt for Environment Isolation

Each environment (pre-prod, prod) gets its own Terragrunt root and its own state file. This means:

- **Independent apply cycles** — a failed pre-prod plan never blocks a prod hotfix
- **Blast radius containment** — `tofu destroy` on pre-prod cannot touch prod state
- **Clean promotion model** — module versions and variable values are explicit per environment, no workspace switching confusion
- **Future flexibility** — splitting dev and stage into separate clusters later is just adding a new Terragrunt root, not rearchitecting state

Terragrunt's `include` blocks and a shared root `terragrunt.hcl` keep DRY config (S3 backend, provider versions, common tags) while each environment overrides what it needs.

### Foundation Addons — The Boot Order Problem

ArgoCD needs working Ingress + DNS + TLS to be accessible. But if ArgoCD manages the ALB controller, external-dns, and cert-manager... who installs them first?

**Solution**: These critical-path components are installed via `helm_release` in OpenTofu as **foundation addons**, alongside (but before) ArgoCD:

1. **ALB Controller** → creates the ALB Ingress class
2. **external-dns** → manages Route53 records from Ingress annotations
3. **cert-manager** → provisions internal TLS certificates
4. **ArgoCD** → installed last, gets a working Ingress on first boot

After ArgoCD starts, its app-of-apps takes over managing the remaining platform components (ESO, Crossplane, observability). ArgoCD does **not** self-manage the four foundation addons — they stay as OpenTofu `helm_release` resources to avoid a circular dependency.

### Two Clusters: Pre-Prod and Prod

- **Pre-prod cluster** hosts dev + stage swim lanes as separate namespaces. Spot instances keep costs low.
- **Prod cluster** is isolated, on-demand only, HA NAT.
- If dev and stage ever need full isolation, promote pre-prod into two clusters — Terragrunt makes this a new directory, not a redesign.

---

## Platform Repo Structure

```
infra-platform/
  config.yaml                  # ← PLATFORM PARAMS: org, region, account, clusters,
                               #   shared domain, platform component versions
  bootstrap/                   # One-time manual apply (state backend, OIDC, IAM)
  foundation/                  # OpenTofu via Terragrunt — per-environment state isolation
    modules/
      vpc/
      eks-cluster/
      ecr-registry/
    terragrunt.hcl             #   Root config: S3 backend, common vars
    pre-prod/
      terragrunt.hcl           #   Inherits root, own state: ${org}-tofu-state/.../pre-prod
      vpc/terragrunt.hcl
      eks/terragrunt.hcl
      ecr/terragrunt.hcl
    prod/
      terragrunt.hcl           #   Inherits root, own state: ${org}-tofu-state/.../prod
      vpc/terragrunt.hcl
      eks/terragrunt.hcl
      ecr/terragrunt.hcl
  foundation-addons/             # Helm releases managed by OpenTofu (must exist before ArgoCD)
    alb-controller/              #   AWS Load Balancer Controller — ArgoCD Ingress depends on this
    external-dns/                #   Route53 record management — ArgoCD host depends on this
    cert-manager/                #   TLS — internal certs needed at boot
    argocd/                      #   ArgoCD itself — installed last, after networking is ready
  platform/                    # ArgoCD app-of-apps (everything ArgoCD self-manages after boot)
    app-of-apps/               #   Root Application
    platform-apps/             #   Platform component Argo Applications
  charts/                      # Shared Helm charts (published to OCI/ECR or referenced directly)
    service/                   #   Generic chart any project can use
    stateful-service/          #   Chart for backing services (workflow engines, IdPs, etc.)
  crossplane/
    compositions/              #   Reusable: rds-postgres, elasticache-redis, s3-bucket, msk
    xrds/                      #   CompositeResourceDefinitions (the "API" projects consume)
  tenant-onboarding/           # OpenTofu module or script to register a new project
    main.tf                    #   Creates: ECR repos, namespace, RBAC, Argo AppProject,
                               #   Secrets Manager paths, Crossplane provider config
  docs/
    onboarding.md              #   How to register a new project with the platform
    architecture.md            #   Platform architecture overview

.github/workflows/
  infra-plan.yaml              # terragrunt plan on PR touching foundation/
  infra-apply.yaml             # terragrunt apply on merge to main (per-environment)
  platform-sync.yaml           # ArgoCD diff / sync check for platform apps
```

### Platform `config.yaml`

```yaml
org: my-org
aws_region: us-east-1
aws_account_id: "123456789012"

clusters:
  pre-prod:
    vpc_cidr: "10.0.0.0/16"
    node_groups:
      workload: { instance: m7i.large, min: 2, max: 8, capacity: spot }
      system: { instance: t3.medium, min: 1, max: 2, capacity: on-demand }
    swim_lanes: [dev, stage] # multiple lanes share this cluster
  prod:
    vpc_cidr: "10.1.0.0/16"
    node_groups:
      workload: { instance: m7i.large, min: 3, max: 12, capacity: on-demand }
      system: { instance: t3.medium, min: 2, max: 3, capacity: on-demand }
    swim_lanes: [prod]
    nat_ha: true

platform_domain: platform.example.dev # optional — for ArgoCD UI, Grafana, etc.

foundation_addons: # installed via helm_release in OpenTofu — before ArgoCD
  aws-lb-controller: { version: "1.10.x" }
  external-dns: { version: "1.16.x" }
  cert-manager: { version: "1.17.x" }
  argocd: { version: "7.8.x", namespace: argocd }

platform_components: # installed by ArgoCD after bootstrap — self-managed
  external-secrets: { version: "0.12.x" }
  crossplane: { version: "1.18.x" }
  kube-prometheus-stack: { version: "68.x" }
  loki: { version: "6.x" }
  tempo: { version: "1.x" }

tenants: # registered projects — drives ECR repos, Argo AppProjects, namespaces
  - name: aegir
    repo: my-org/aegir
    domain: aegir.dev
    lanes: [dev, stage, prod]
  - name: next-project
    repo: my-org/next-project
    domain: nextproject.io
    lanes: [dev, prod]
```

---

## Application Repo Structure

Each project keeps a slim `infra/` directory. No cluster provisioning, no platform installs — just declarations.

```
my-project/
  infra/
    config.yaml              # ← PROJECT PARAMS: project name, services, backing services
    apps/                    # ArgoCD Application definitions (or ApplicationSet)
      base/                  #   Shared values per service
      dev/                   #   Per-lane overrides (image tags, replicas, env)
      stage/
      prod/
    claims/                  # Crossplane Claims — request resources from platform compositions
      dev/
        postgres.yaml        #   "I need a dev-sized Postgres"
        redis.yaml
        s3.yaml
      prod/
        postgres.yaml        #   "I need a prod-sized Postgres"
        redis.yaml
        s3.yaml
        kafka.yaml
    values/                  # Helm values files per service per lane
      base.yaml
      dev.yaml
      stage.yaml
      prod.yaml
    local/tf/                # Existing local dev (unchanged)

  .github/workflows/
    ci.yaml                  # Lint + test on PR
    build-push.yaml          # Build images → ECR on merge to main
```

### Application `infra/config.yaml`

```yaml
project: my-project
platform_repo: my-org/infra-platform # where the platform lives
domain: my-project.dev # optional

services:
  - name: web
    port: 3000
    path: /
  - name: api
    port: 4000
    path: /api
  - name: worker
    replicas: { dev: 1, prod: 3 }
    ingress: false # no external traffic

swim_lanes:
  dev: { cluster: pre-prod, auto_sync: true }
  stage: { cluster: pre-prod, auto_sync: false }
  prod: { cluster: prod, auto_sync: false }

backing_services:
  postgres:
    { composition: rds-postgres, dev_size: micro, prod_size: aurora-serverless }
  redis:
    { composition: elasticache-redis, dev_size: micro, prod_size: serverless }
  s3: { composition: s3-bucket }
```

---

## Responsibility Boundary

| Concern                                                             | Platform Repo             | Application Repo                 |
| ------------------------------------------------------------------- | ------------------------- | -------------------------------- |
| AWS accounts, IAM, OIDC                                             | Owns                      | —                                |
| VPC, subnets, NAT                                                   | Owns                      | —                                |
| EKS clusters, node groups                                           | Owns                      | —                                |
| ArgoCD install + self-management                                    | Owns                      | —                                |
| Platform components (LB controller, ESO, Crossplane, observability) | Owns                      | —                                |
| Crossplane Compositions + XRDs                                      | Owns (defines the API)    | Consumes (files Claims)          |
| Shared Helm charts                                                  | Owns + publishes          | References                       |
| ECR repositories                                                    | Creates per tenant        | Pushes images                    |
| Kubernetes namespaces + RBAC                                        | Creates per tenant        | Deploys into                     |
| Argo AppProject                                                     | Creates per tenant        | Scoped to                        |
| Secrets Manager path structure                                      | Creates prefix per tenant | Manages own secrets under prefix |
| Application Dockerfiles + code                                      | —                         | Owns                             |
| CI/CD for application builds                                        | —                         | Owns                             |
| ArgoCD Applications / ApplicationSet                                | —                         | Owns (within AppProject scope)   |
| Crossplane Claims (resource requests)                               | —                         | Owns                             |
| Per-service Helm values                                             | —                         | Owns                             |
| Ingress routing rules                                               | —                         | Owns (via Ingress annotations)   |

---

## Tenant Onboarding Flow

When a new project wants to use the platform:

### 1. Platform side — register the tenant

Add an entry to `tenants` in the platform `config.yaml`, then merge to main. The `tenant-onboarding/` module runs automatically and provisions:

- **ECR repositories** — one per service declared in the project's config
- **Kubernetes namespaces** — `${project}-${lane}` for each swim lane
- **RBAC** — namespace-scoped roles for the project's CI service account
- **Argo AppProject** — scoped to the project's namespaces + repo, prevents cross-tenant access
- **Secrets Manager prefix** — `${project}/` with appropriate IAM policies
- **Crossplane ProviderConfig** — namespace-scoped AWS credentials for the project's claims
- **IAM Role** — `${project}-github-deploy` trusted by the project's repo via OIDC

### 2. Application side — bootstrap `infra/`

The project creates its `infra/` directory (can be scaffolded from a template in the platform repo's docs):

1. Write `infra/config.yaml` with services, backing services, swim lanes
2. Add Crossplane Claims under `infra/claims/{lane}/`
3. Add ArgoCD Application definitions under `infra/apps/`
4. Add Helm values under `infra/values/`
5. Set up GitHub Actions workflows for build + push

### 3. First deployment

1. Merge to main triggers `build-push.yaml` → images land in ECR
2. ArgoCD detects the new Applications → syncs to dev (auto-sync)
3. Crossplane Claims reconcile → backing resources provisioned
4. Services start, Ingress created → external-dns updates Route53
5. Dev is live at `dev.${domain}/`

---

## How the Layers Map

The original plan's layers still exist, but ownership shifts:

| Layer                     | Original (monorepo)              | Distributed                                                                      | Owner       |
| ------------------------- | -------------------------------- | -------------------------------------------------------------------------------- | ----------- |
| **1. Bootstrap**          | `infra/bootstrap/`               | `infra-platform/bootstrap/`                                                      | Platform    |
| **2. Foundation**         | `infra/foundation/`              | `infra-platform/foundation/` (Terragrunt, per-env state)                         | Platform    |
| **2b. Foundation Addons** | (was part of Layer 3)            | `infra-platform/foundation-addons/` (ALB, DNS, certs, ArgoCD via `helm_release`) | Platform    |
| **3. Platform**           | `infra/platform/`                | `infra-platform/platform/` (ArgoCD self-manages remaining components)            | Platform    |
| **4. Data Plane**         | `infra/crossplane/compositions/` | `infra-platform/crossplane/` (compositions)                                      | Platform    |
| **4b. Data Claims**       | `infra/crossplane/claims/`       | `my-project/infra/claims/`                                                       | Application |
| **5. App Deployment**     | `infra/apps/` + `infra/charts/`  | `my-project/infra/apps/` + platform charts                                       | Application |
| **6. Swim Lanes**         | Directories in `infra/apps/`     | Same, but namespaces pre-created by platform                                     | Shared      |

---

## ArgoCD Multi-Tenant Model

### AppProjects

Each registered tenant gets an Argo `AppProject` that constrains:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: ${project}
  namespace: argocd
spec:
  sourceRepos:
    - "https://github.com/${tenant_repo}.git"
  destinations:
    - namespace: "${project}-*"
      server: "*"
  clusterResourceWhitelist: [] # no cluster-scoped resources
  namespaceResourceBlacklist:
    - group: ""
      kind: ResourceQuota # platform controls quotas
    - group: networking.k8s.io
      kind: NetworkPolicy # platform controls network isolation
```

Projects can only deploy to their own namespaces and cannot modify platform resources or other tenants' workloads.

### Application Discovery

Each project's ArgoCD Applications live in the project repo under `infra/apps/`. The platform's root app-of-apps includes a per-tenant `ApplicationSet` that watches the project repo:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: ${project}-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/${tenant_repo}.git
        revision: HEAD
        directories:
          - path: infra/apps/*
  template:
    metadata:
      name: "{{path.basename}}"
    spec:
      project: ${project}
      source:
        repoURL: https://github.com/${tenant_repo}.git
        path: "{{path}}"
      destination:
        server: https://kubernetes.default.svc
```

---

## Secrets Strategy (Multi-Tenant)

AWS Secrets Manager, partitioned by project:

```
${project}/${env}/database/{service}   → connection strings
${project}/${env}/identity             → IdP client secrets
${project}/${env}/smtp                 → SES credentials
${project}/${env}/integrations/{name}  → third-party API keys
```

IAM policies ensure each project's pods can only read their own `${project}/` prefix. External Secrets Operator `ClusterSecretStore` is platform-managed; per-namespace `SecretStore` references are project-scoped.

---

## DNS & TLS (Multi-Tenant)

### Platform-level

- Route53 hosted zone(s) managed by platform
- Wildcard ACM cert per domain (`*.${domain}`)
- Platform services (ArgoCD, Grafana) live under `platform.example.dev`

### Project-level

Each project optionally brings its own domain:

- Platform creates a Route53 hosted zone (or imports) during tenant onboarding
- Project's Ingress annotations drive external-dns record creation
- `dev.${project_domain}`, `stage.${project_domain}`, `${project_domain}` (prod)
- Projects without a domain get ALB-generated URLs

---

## Implementation Sequence

| Phase | Work                                                                                           | Owner          | Dependencies |
| ----- | ---------------------------------------------------------------------------------------------- | -------------- | ------------ |
| 0     | AWS account + domain + manual bootstrap                                                        | Platform       | None         |
| 1     | Foundation: VPC, EKS, ECR via Terragrunt (pre-prod first, then prod)                           | Platform       | Phase 0      |
| 1b    | Foundation addons: ALB controller, external-dns, cert-manager via `helm_release`               | Platform       | Phase 1      |
| 2     | ArgoCD install (via `helm_release`), then app-of-apps bootstraps remaining platform components | Platform       | Phase 1b     |
| 3     | Crossplane compositions + XRDs (define the tenant API)                                         | Platform       | Phase 2      |
| 4     | Tenant onboarding module (namespace, RBAC, AppProject, ECR)                                    | Platform       | Phase 3      |
| 5     | **First tenant**: register project, scaffold `infra/`, deploy to dev                           | Application    | Phase 4      |
| 6     | Stage + prod swim lanes, promotion workflows                                                   | Both           | Phase 5      |
| 7     | Hardening: NetworkPolicies, PodSecurity, alerting, backups, DR                                 | Platform       | Phase 6      |
| 8     | Second tenant onboarding (validates the recipe is truly reusable)                              | Platform + App | Phase 4      |

---

## Estimated Monthly Cost

Platform costs are shared across all tenants. Per-tenant marginal cost is near zero (just their backing service claims).

### Platform (shared)

|                                 | Pre-Prod Cluster | Prod Cluster           |
| ------------------------------- | ---------------- | ---------------------- |
| EKS control plane               | $73              | $73                    |
| EC2 nodes (scales with tenants) | ~$90–$200 (Spot) | ~$300–$600 (On-Demand) |
| NAT Gateway                     | $32              | $96 (HA)               |
| ALB (1 per swim lane)           | $16              | $16                    |
| Observability stack overhead    | ~$5              | ~$5                    |
| **Platform subtotal**           | **~$216–$326**   | **~$490–$790**         |

### Per-Tenant (incremental)

|                          | Dev/Stage       | Prod                     |
| ------------------------ | --------------- | ------------------------ |
| RDS (if claimed)         | $13 (t4g.micro) | ~$60 (Aurora Serverless) |
| ElastiCache (if claimed) | $12             | ~$40                     |
| S3 + ECR storage         | ~$2             | ~$3                      |
| Secrets Manager          | ~$1             | ~$1                      |
| **Per-tenant subtotal**  | **~$28**        | **~$104**                |

---

## Migration Path from Monorepo Plan

If starting from the [single-repo infra-plan.md](infra-plan.md):

1. **Extract** `bootstrap/`, `foundation/`, `platform/`, `crossplane/compositions/` into the new platform repo
2. **Keep** `apps/`, `claims/`, `charts/` references, and `local/tf/` in the application repo under `infra/`
3. **Move** shared Helm charts to the platform repo; application repo references them via OCI or git
4. **Replace** the monorepo's ArgoCD root app with the multi-tenant AppProject + ApplicationSet model
5. **Add** `tenant-onboarding/` module to the platform repo
6. **Update** GitHub Actions: platform repo gets infra plan/apply workflows; application repo keeps only CI + build-push

---

## Verification Plan

### Platform

1. **Bootstrap**: `tofu apply` succeeds, OIDC role assumable from platform repo's GitHub Actions
2. **Foundation**: EKS clusters reachable, node groups healthy
3. **Platform components**: ArgoCD UI accessible, all platform apps show `Healthy` + `Synced`
4. **Crossplane**: Compositions installed, XRDs available (`kubectl get xrd`)
5. **Tenant onboarding**: Register a test tenant → namespaces, RBAC, AppProject, ECR repos all created

### Per-Tenant

1. **Build pipeline**: Merge to main → images appear in ECR with correct tags
2. **Claims**: Crossplane claims show `Ready=True`, backing service endpoints reachable from pods
3. **Apps**: All services running in `${project}-dev` namespace, health checks passing
4. **Ingress**: Paths return expected responses, DNS records created automatically
5. **Isolation**: Tenant A cannot access Tenant B's namespace, secrets, or Argo applications
6. **E2E**: App loads at `dev.${domain}/`, authenticates, hits API — full flow works
