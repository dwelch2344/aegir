# The Shipyard: Unified Strategy, Roadmap & Implementation Plan

**Version:** 1.0 | **Date:** 2026-03-13
**Synthesized from:** CPO, VP Engineering, Product Manager, Project Manager, QA/DevEx Lead, BizDev Strategist

---

## Vision

**The Shipyard turns "I've already solved this" into "every project I touch already has this solved."**

It is a software factory that encodes one senior architect's decade of production decisions -- auth, multi-tenancy, observability, orchestration, federation, infrastructure -- into a living catalog of battle-tested patterns, then applies them to new projects via AI agents in minutes instead of months.

---

## The Asset: What Already Exists

The Shipyard is not theoretical. On 2026-03-11, 14 production-grade patterns were reverse-forked from a working product:

| Pattern ID | What It Provides | Status |
|---|---|---|
| `harness.devcontainer` | Docker Compose + Traefik local dev = K8s mirror | Working |
| `auth.oidc-keycloak` | Keycloak realm, OIDC clients, Nuxt integration | Working |
| `tenancy.org-based` | Keycloak Orgs + schema isolation + org-scoped data | Working |
| `api.graphql-federation` | Mercurius gateway + Moribashi subgraphs | Working |
| `orchestration.conductor` | Conductor + task workers + 3 workflow patterns | Working |
| `cdc.debezium-kafka` | Debezium -> Redpanda -> Avro -> sink consumers | Working |
| `observability.grafana-stack` | Grafana + Prometheus + Loki + Tempo + Promtail | Working |
| `storage.s3` | MinIO locally, S3 in prod | Working |
| `email.smtp` | MailHog locally, SES/SendGrid in prod | Working |
| `frontend.nuxt-spa` | Nuxt 3 + Tailwind + OIDC auth | Working |
| `build.pnpm-turbo` | pnpm workspaces + Turborepo + tsup | Working |
| `db.postgres-isolated` | Schema-per-service + OpenTofu provisioning | Working |
| `infra.aws-eks-gitops` | Full AWS/EKS/ArgoCD plan | Documented |
| `agents.ai-conversation` | Agents service + Conductor workflows + Claude | Working |

These represent **5-6 months of senior architect time** ($60k-$150k opportunity cost). The patterns are not independent templates -- they form a coherent, integrated system where auth flows into multi-tenancy, which flows into schema isolation, which flows into GraphQL federation.

**The moat** is three things combined:
1. **Battle-tested patterns** (not theoretical starters)
2. **AI-powered application** (not copy-paste)
3. **Encoded architectural judgment** (why Keycloak Orgs for tenancy, why schema-per-service, why Mercurius federation)

---

## Strategic Direction

### The unanimous recommendation across all roles:

> **Use it -> Prove it -> Sell the output (ships) -> Decide whether to productize the factory.**

The Shipyard's primary value is making the founder faster. Revenue comes from the ships, not the Shipyard. Don't monetize the factory before proving the factory works.

### Phase 1: Internal Multiplier (Now - Month 6)

Use the Shipyard to launch 2-3 real products. The platform is a competitive advantage, not a product.

### Phase 2: Productized Service (Month 6-12)

Take 1-2 client projects. Position as premium: "Production-grade SaaS in 4 weeks." $25k+ per project. Each engagement stress-tests and improves the catalog.

### Phase 3: Decide the Long Game (Month 12-18)

With 3-5 ships launched, real revenue, and 20+ catalog patterns, choose:
- **Stay a studio** ($300-500k/year solo)
- **Open-source core** (community play, 2-3 year horizon)
- **Build the SaaS** (venture-scale, requires capital)

---

## The Killer Feature

All roles converged on the same insight:

> **The 12-step "adding a domain service" recipe is the single highest-value automation target.**

It is the most frequently repeated manual workflow, touches 15+ files across 6 directories, and is entirely deterministic given a service name and port number. Automating this single recipe delivers more value than any other feature.

---

## MVP Definition

**The MVP answers one question: "Can I scaffold a new ship and add a domain service to it without manual work?"**

| Component | What It Does | What It Does NOT Do |
|---|---|---|
| **Manifest schema** | YAML file describing a ship's state | No drift detection, no versioned history |
| **Catalog format** | YAML entries with id/version/preconditions/provides/instructions/test_criteria | No registry, no search index |
| **5 core entries** | build.pnpm-turbo, harness.devcontainer, db.postgres-isolated, api.graphql-federation, auth.oidc-keycloak | Remaining 9 patterns not yet formalized |
| **Scaffolder** | `shipyard init <name>` generates a bootable ship | No interactive wizard, no optional pattern selection |
| **Domain service command** | `shipyard add service <name>` automates the 12-step recipe | No NLP, no dependency resolution |

### What "done" looks like

1. `shipyard init billing-platform` -> bootable ship in < 5 minutes
2. `shipyard add service invoicing` -> 15 files created, 4 modified, tests pass
3. `pnpm build && pnpm test` -> green on first run
4. Manifest accurately reflects what was applied

---

## Open Decisions (Must Resolve Before Building)

All roles recommended the same answers. These need your sign-off:

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| DEC-001 | Manifest format | **YAML** | Human-readable, comment support, K8s ecosystem alignment, multi-line `application_instructions` |
| DEC-002 | Catalog storage | **Files in this repo** (`catalog/`) | Version-controlled, diffable, reviewable, agent-readable. Move to separate repo only if needed later |
| DEC-003 | Drift handling | **Manifest-only for M0-M2; structural comparison for M3** | Don't build drift detection before ships exist that could drift |
| DEC-004 | Catalog granularity | **Feature slices** | Matches how the 14 patterns naturally decompose. One entry = one coherent capability |
| DEC-005 | Profile flexibility | **All-or-nothing for M1** | First profile must be battle-tested as a unit. Add skip-list support in M2 |

---

## Technical Architecture Decisions

### Proposed Catalog Entry Schema (YAML)

```yaml
id: api.graphql-subgraph
version: 0.1.0
name: GraphQL Federated Subgraph
description: A Moribashi-based federated GraphQL service with Postgres schema isolation
preconditions:
  - build.pnpm-turbo
  - db.postgres-isolated
provides:
  - "graphql.subgraph.{service_name}"
parameters:
  service_name: { type: string, required: true }
  port: { type: number, required: true }
  pg_schema: { type: string, default: "{service_name}" }
  pg_user: { type: string, default: "{service_name}_svc" }
application_instructions: |
  1. Create services/{service_name}/ with package.json, tsup.config.ts, vitest.config.ts
  2. Create src/app.ts using Moribashi createApp + webPlugin + pgPlugin + federation
  3. Create src/schema.ts with federated type definitions
  4. Create src/resolvers.ts with namespace-prefixed resolver map
  5. Create data/migrations/ directory
  6. Add {service_name} to gateway service list
  7. Add Traefik routing rule for /api/{service_name}
  8. Add OpenTofu postgres role + schema provisioning
test_criteria:
  - Service starts and responds to GET /health
  - Federation SDL is served at POST /graphql with { _service { sdl } }
  - Gateway includes service in composed schema
```

### Proposed Ship Manifest Schema (YAML)

```yaml
shipyard_version: "0.1"
name: my-project
type: api
stack:
  languages: [typescript]
  frameworks: [moribashi, nuxt, fastify]
  runtime: node-22
services:
  - name: iam
    type: graphql-subgraph
    port: 4001
    schema: iam
catalog_refs:
  - id: harness.devcontainer
    version: 0.1.0
capabilities: [graphql-federation, oidc-auth, org-based-tenancy]
constraints:
  protected_paths: [packages/domain/]
conventions:
  graphql_naming: moribashi
  migration_format: flyway
  service_scan_pattern: "**/*.svc.ts"
```

### Build vs Buy vs Integrate

| Component | Decision | Tool |
|---|---|---|
| Catalog storage | Build | YAML files in repo |
| Template engine | Integrate | Handlebars |
| CLI framework | Integrate | commander + prompts |
| Code generation | Build | Catalog templates + Handlebars |
| Schema validation | Integrate | Zod |
| AST manipulation (v1.0) | Integrate | ts-morph |
| AI orchestration | Build | Reuse existing Conductor + Claude |
| CI/CD | Integrate | GitHub Actions |

### Tech Debt to Address (Pre-M1)

1. **Extract `bindResolversToScope`** into `@aegir/common` or upstream to Moribashi (duplicated in iam + system)
2. **Pin Moribashi versions** more tightly (currently `^0.1.11`, pre-1.0 semver risk)
3. **Add CI pipeline** (`.github/workflows/ci.yaml` -- lint, build, test)
4. **Clean domain-specific remnants** from orchestration workers (`sh-agent-signs-docusign.ts`, etc.)

---

## Delivery Roadmap

### M0: Foundation -- "The schemas exist and aegir describes itself"

**Target: 1-2 days** | Developer: 4h | AI agents: 8h

| Deliverable | Definition of Done |
|---|---|
| DEC-001 through DEC-005 decided | Documented in decision log |
| `shipyard.manifest` JSON Schema | Validates against test data |
| Catalog entry JSON Schema | Validates against test data |
| `shipyard.manifest` for aegir | aegir's own manifest passes validation |
| 3 catalog entries formalized | `build.pnpm-turbo`, `db.postgres-isolated`, `harness.devcontainer` |

---

### M1: First Ship -- "I can scaffold a new project and it builds"

**Target: 1-2 weeks after M0** | Developer: 12h | AI agents: 30h

| Deliverable | Definition of Done |
|---|---|
| All 14+1 catalog entries formalized | Every pattern has a structured entry |
| Scaffolder CLI (`shipyard init`) | `shipyard init my-project` produces a buildable project |
| "saas" profile defined | Baseline pattern bundle for multi-tenant SaaS |
| Scaffolded ship builds and starts | `pnpm install && pnpm build` succeeds |
| Ship has valid manifest | Manifest reflects exactly what was applied |

**After M1: STOP. Build a real ship.** Return to M2 when friction demands it.

---

### M2: Pattern Application -- "I can add capabilities to existing ships"

**Target: 1-2 weeks after M1** | Developer: 10h | AI agents: 20h

| Deliverable | Definition of Done |
|---|---|
| `shipyard add service <name>` | Automates the 12-step recipe end-to-end |
| Applicator agent workflow | Reads manifest, finds pattern, checks preconditions, applies, updates manifest |
| Precondition checking | Refuses patterns with unmet preconditions, with clear message |
| Tested on aegir | Successfully adds a new domain service |

---

### M3: Full Loop -- "The Shipyard manages its catalog and detects drift"

**Target: 2-4 weeks after M2** | Developer: 8h | AI agents: 16h

| Deliverable | Definition of Done |
|---|---|
| `shipyard status` | Shows applied patterns, outdated versions, drift |
| Drift detection | Structural comparison of manifest vs actual state |
| `shipyard catalog add` | Agent-assisted workflow to propose new catalog entries |
| Catalog versioning | Semver, ships can pin or float versions |

---

## Critical Path

```
Manifest Schema -> Catalog Schema -> 5 Core Entries -> Template Engine -> Scaffolder -> [BUILD A REAL SHIP] -> Applicator -> Drift Detection
```

**Parallelizable:** Catalog entries 6-14 (independent), CLI framework (independent), Applicator prompt design (after 3-4 entries exist).

---

## Resource Allocation (Solo Dev + AI Agents)

### The founder should:
- Make all design decisions (formats, CLI UX, drift strategy)
- Review all AI-generated catalog entries
- Engineer the Applicator prompts
- Design profiles (which patterns compose a baseline)
- Verify the first scaffolded ship manually

### AI agents should:
- Formalize catalog entries (mechanical translation of existing code)
- Write JSON Schemas from PRD field lists
- Generate CLI boilerplate
- Parameterize template files
- Write tests

### Daily rhythm:
1. **Morning (30 min):** Make one design decision. Give AI agents tasks.
2. **Working session (2-4h):** AI agents produce; you review in batches.
3. **End of day (30 min):** Review, update session log, identify tomorrow's decision.

**Total estimated effort: ~34h developer + ~74h AI agents over 5-8 weeks.**

---

## Quality Strategy

### Testing the Factory

| What | How |
|---|---|
| Scaffolder output | Golden-output snapshots + build verification (pnpm install/build/test in temp dir) |
| Pattern application | Before/after functional equivalence (existing tests must still pass) |
| Idempotency | Apply every pattern twice; second run must produce identical results |
| Catalog entries | Schema validation + apply-and-verify test per pattern |

### Quality Gates for Ships

Every scaffolded ship must pass before being declared ready:
- `pnpm install` exits 0
- `tsc --noEmit` exits 0
- `pnpm build` exits 0
- `vitest run` exits 0
- `biome check .` exits 0
- `shipyard.manifest` validates
- No `TODO`/`FIXME` in generated code

### DevEx Metrics

| Metric | Baseline (Today) | Target |
|---|---|---|
| Time to bootable ship | ~2 days (manual) | < 5 minutes |
| Time to add a domain service | ~2 hours (manual 12-step) | < 60 seconds |
| First-run success rate | N/A | 100% |
| Manual steps after automation | 12 | 0 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Over-engineering the meta-project** -- spending more time building the Shipyard than building ships | High | Critical | M1 is the forcing function. After M1, STOP and build a real ship. Hard calendar deadline: if M1 isn't done in 2 weeks, ship manually and formalize later. |
| **Template complexity explosion** -- parameterizing all pattern combinations becomes combinatorial | Medium | High | Start with profiles (fixed bundles), not a la carte. Add granular selection only when you know which combinations get used. |
| **AI agent reliability** -- Applicator produces inconsistent or broken code | Medium | Medium | Detailed `application_instructions` (the 12-step recipe is the gold standard). Test criteria for verification. Dry-run mode. |
| **Stack lock-in** -- all patterns are TypeScript/Node/Postgres/Keycloak | Low (near-term) | Medium (long-term) | Accept as a feature. The founder builds TypeScript SaaS. Stack-agnosticism is a Phase 3+ concern. |
| **Moribashi coupling** -- pre-1.0 framework with bus factor of one | Low | Medium | Pin exact versions. Document conventions the Shipyard depends on. |

---

## Execution Plan: First 10 Days

### Day 1
- [ ] Decide DEC-001 (YAML), DEC-002 (files in repo), DEC-004 (feature slices)
- [ ] AI agent: draft manifest JSON Schema
- [ ] AI agent: draft catalog entry JSON Schema

### Day 2
- [ ] Review and finalize both schemas
- [ ] Write aegir's `shipyard.manifest`
- [ ] AI agent: formalize `build.pnpm-turbo`, `db.postgres-isolated`, `harness.devcontainer`

### Days 3-5
- [ ] AI agents: formalize remaining 11 catalog entries (3-4 per session)
- [ ] Review each batch
- [ ] Decide DEC-005 (all-or-nothing profiles)
- [ ] Design scaffolder CLI interface

### Days 6-8
- [ ] Build template engine (Handlebars)
- [ ] Build scaffolder core (`shipyard init`)
- [ ] Define "saas" profile

### Days 9-10
- [ ] End-to-end test: scaffold a ship
- [ ] Fix issues
- [ ] **M1 complete -- stop and build a real ship**

---

## Supporting Documents

| Document | Purpose |
|---|---|
| [Delivery Plan](delivery-plan.md) | Detailed WBS, milestones, dependency map, risk register |
| [QA & DevEx Strategy](qa-devex-strategy.md) | Testing strategy, quality gates, CLI design, metrics |
| [Primitives Audit](shipyard-primitives-audit.md) | Full analysis of the 14 existing patterns |
| [Domain Model](domain-model.md) | Foundational entity model (Identity, Org, Tenant, Integration) |
| [Adding a Domain Service](recipes/adding-a-domain-service.md) | The 12-step recipe (automation target #1) |

---

*This document is the synthesis of a 6-role strategic planning exercise. It should be treated as the starting point for execution, not a final specification. Update as decisions are made and reality is encountered.*
