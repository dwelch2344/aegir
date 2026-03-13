# Session Log

## 2026-03-11 — Reverse Fork

### What was abstracted

- `@aegir/common` — shared utilities
- `@aegir/domain` — Identity, Organization types
- `@aegir/gateway` — Mercurius federated GraphQL gateway (:4000)
- `@aegir/iam` — identity & organization subgraph (:4001)
- `@aegir/agents` — AI conversation subgraph (:4003)
- `@aegir/orchestration` — Conductor workflow task workers (:4010)
- `@aegir/conductor-cdc` — change data capture from Conductor
- `@aegir/app` — Nuxt 3 SSR frontend (:3000)
- DevContainer stack: Postgres, Keycloak, Conductor, MinIO, Redpanda, Redis, Debezium, Mailhog, Grafana/Tempo/Loki/Promtail, Traefik
- OpenTofu infra, scripts

## 2026-03-13 — Domain Model Audit (Agent Team)

### Summary
Four-agent team conducted comprehensive domain model audit with test coverage expansion and adversarial QA.

### Agents
- **A (IAM Test Author)**: 17 new tests + 4 TODO stubs for Identity/Organization
- **B (System+Agents Test Author)**: 10 new system tests + 12 new agents tests + 4 TODO stubs
- **C (Adversarial QA)**: 51 adversarial tests across 5 new __qa__/ files, 11 findings
- **D (Documentation)**: Audit doc, domain model status update, coverage map

### Files Created
- docs/design/domain-model-audit.md
- docs/design/recipes/domain-model-test-coverage.md
- services/agents/src/app.test.ts
- services/iam/src/__qa__/seed-invariants.test.ts
- services/iam/src/__qa__/org-sync-attacks.test.ts
- services/iam/src/__qa__/cross-entity-invariants.test.ts
- services/system/src/__qa__/mutation-attacks.test.ts
- services/agents/src/__qa__/conversations-attacks.test.ts

### Files Modified
- services/iam/src/app.test.ts (7→24 tests + 4 TODOs)
- services/system/src/app.test.ts (8→18 tests + 3 TODOs)
- docs/design/domain-model.md (added Implementation Status section)
- packages/domain/src/index.ts (added JSDoc annotations)

### Key Findings
1. No UNIQUE constraint on identity.email
2. Empty string keys/names accepted everywhere (no min-length validation)
3. No input sanitization on ILIKE patterns (SQL wildcards not escaped)
4. conversation.organization_id has no FK constraint
5. integration.metadata is TEXT not JSONB (accepts invalid JSON)
6. message.role case mismatch (GraphQL String vs DB CHECK lowercase)
7. conversation.delete() always returns true (no affected-row check)
8. System service DI naming bug (tenant-integrations hyphen)
9. Test idempotency issues (shared DB state between runs)
10. Membership entity not implemented (externalized to Keycloak)
11. Organization has no tenant_id FK (cross-service relationship not enforced)

### Recommendations (Priority Order)
1. Fix DI naming bug (rename tenant-integrations → tenantIntegrations)
2. Add UNIQUE constraint on identity.email
3. Add FK constraint on conversation.organization_id
4. Add input validation (min-length, pattern escaping)
5. Change metadata columns from TEXT to JSONB
6. Implement Membership entity locally
