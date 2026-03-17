# BCP: testing.ci-pipeline

> Mapping test layers to CI/CD pipeline stages for fast feedback and thorough verification.

**ID:** `testing.ci-pipeline`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

Without a deliberate CI test strategy, teams either run everything on every PR (slow, expensive)
or skip slow tests entirely (dangerous). The four integration layers (BCP: `testing.integration-layers`)
each have different infrastructure requirements, execution speeds, and failure significance. CI
pipelines must be structured to give fast feedback on common failures while still catching
cross-boundary issues before merge.

## Best Current Practice

### Three CI Stages

#### Stage 1: PR Checks (Every Push)

**Runs:** Layer 1 (in-process) + Layer 2 (database constraints)
**Infrastructure:** Postgres only (per-service schema isolation)
**Speed target:** < 2 minutes for the full monorepo
**Trigger:** Every push to a feature branch

```yaml
# Turborepo runs only affected service tests
pr-tests:
  services: [postgres]
  command: pnpm test
  # Turborepo's dependency graph ensures only changed services + dependents run
```

**What this catches:**
- SQL query bugs, constraint violations
- Business logic regressions
- API contract changes (response shapes)
- Seed data inconsistencies
- Input validation gaps (adversarial tests)

#### Stage 2: Merge Gate (PR Merge to Main)

**Runs:** Stage 1 + Layer 3 (cross-service federation) + Contract tests
**Infrastructure:** Postgres + all subgraph services + gateway
**Speed target:** < 5 minutes
**Trigger:** Merge queue or post-merge pipeline

```yaml
merge-tests:
  services: [postgres, iam, system, agents, practices, gateway]
  steps:
    - pnpm test                                    # All Layer 1+2 tests
    - pnpm --filter gateway test -- --grep "Contract"  # Contract tests
    - pnpm --filter gateway test -- --grep "Federation" # Composition tests
```

**What this catches:**
- Federation composition errors (conflicting types, missing `@key` resolvers)
- Consumer contract violations (provider changed a field consumers depend on)
- Cross-subgraph query failures

#### Stage 3: Nightly / Pre-Release

**Runs:** All layers including Layer 4 (event-driven)
**Infrastructure:** Full stack (Postgres, Redpanda, Conductor, all services)
**Speed target:** < 15 minutes
**Trigger:** Nightly schedule or release branch creation

```yaml
full-integration:
  services: [postgres, redpanda, conductor, iam, system, agents, practices, gateway, orchestration]
  steps:
    - pnpm test                    # All unit + integration
    - pnpm test:federation         # Cross-service
    - pnpm test:events             # Kafka flow tests
    - pnpm test:workflows          # Conductor workflow tests
```

**What this catches:**
- Async event flow regressions
- Workflow orchestration failures
- Message schema drift
- End-to-end data pipeline integrity

### Test Naming Conventions for CI Filtering

Use consistent `describe` prefixes so CI can grep for specific test categories:

```typescript
describe('Schema Contract: IAM subgraph', () => { ... })      // --grep "Schema Contract"
describe('Behavioral Contract: IAM', () => { ... })            // --grep "Behavioral Contract"
describe('Federation: cross-subgraph queries', () => { ... })  // --grep "Federation"
describe('Seed Invariants — Adversarial QA', () => { ... })    // --grep "Seed Invariants"
describe('Mutation Attacks — Adversarial QA', () => { ... })   // --grep "Mutation Attacks"
```

### Failure Response Matrix

| Stage | Failure | Action |
|-------|---------|--------|
| PR | Layer 1 test fails | Block merge. Developer fixes immediately. |
| PR | Seed invariant fails | Seed data changed — update counts or fix regression. |
| Merge | Contract test fails | Breaking change detected. Coordinate with consumer team. |
| Merge | Federation fails | Schema composition error. Fix before next deploy. |
| Nightly | Event test fails | Async flow regression. Investigate and fix within 24h. |
| Nightly | Workflow test fails | Orchestration regression. Fix before next release. |

### Turborepo Integration

In a monorepo, Turborepo's dependency graph determines which services need retesting:

```json
{
  "pipeline": {
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.ts", "src/**/*.test.ts", "data/migrations/**"],
      "outputs": []
    }
  }
}
```

**Key:** When `packages/domain` changes, all services that depend on it are retested. When only
`services/practices` changes, only practices tests run.

### Contract Test CI Integration

Consumer contracts must run in the **provider's** pipeline, not the consumer's:

```
services/agents/src/__contracts__/iam.contract.ts    # Defined by consumer (agents)
services/iam/src/app.test.ts                          # Imported and run by provider (iam)
```

This means a change to the IAM service automatically validates all consumer contracts.

## Anti-Patterns

- **Running Layer 3+ on every PR** — Too slow, too flaky. Save for merge gate.
- **No merge gate** — Going straight from PR tests to production misses cross-service breaks.
- **Ignoring nightly failures** — "It'll fix itself" leads to accumulated debt. Triage within 24h.
- **Manual federation testing** — "Just spin up all services and click around" doesn't scale.
- **Skipping tests for "fast merge"** — Use `--no-verify` zero times. Fix the tests or fix the CI.

## References

- Context: `project/topics/infrastructure.md` (CI infrastructure)
- Related BCP: `testing.integration-layers`, `testing.contract`
