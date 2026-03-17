# Topic: Testing — Aegir Project

## Stack

- **Framework**: Vitest v3.0.0+ (globals enabled)
- **Config**: `vitest.config.ts` per workspace package (minimal)
- **Scripts**: `test` = `vitest run` (CI), `test:watch` = `vitest` (dev)
- **Runner**: `pnpm test` at root via Turborepo

## File Organization

```
services/<service>/src/
  app.test.ts                      # Core: health, schema, queries, mutations
  __qa__/
    seed-invariants.test.ts        # Exact seed data validation
    *-attacks.test.ts              # Adversarial input probing
    cross-entity-invariants.test.ts # Referential integrity checks
  __contracts__/
    <provider>.contract.ts         # Consumer-driven contract tests
```

## Test Patterns

**Core service tests** (`app.test.ts`):
- `beforeAll`: build Fastify app instance
- `afterAll`: graceful stop
- Test health endpoint: `GET /health`
- Test federation: `{ _service { sdl } }`
- Test queries/mutations via `fastify.inject()` (in-process, no network)
- Test upsert idempotency (same input twice = same result)

**Seed invariant tests** (`__qa__/`):
- Assert exact record counts from seed data
- Validate uniqueness, FK integrity, data shapes
- Verify seed idempotency (re-run seed, counts unchanged)

**Adversarial tests** (`__qa__/`):
- Extreme inputs: 1000+ chars, special characters, HTML/XSS, SQL injection
- Document findings inline: `// FINDING: {description}`
- Probe missing constraints (UNIQUE, FK, CHECK, min-length)
- Boundary values: 0, negative, MAX_SAFE_INTEGER for numeric inputs

**Contract tests** (`__contracts__/`):
- Schema contracts: verify provider SDL contains expected types and fields
- Behavioral contracts: verify expected query responses
- Event contracts: validate Kafka message shapes with Zod schemas
- Run in the provider's CI pipeline, not the consumer's

## Key Conventions

- **Real database**: Tests hit actual PostgreSQL — no mocks for data layer
- **In-process HTTP**: Use `fastify.inject()` not HTTP clients
- **Schema isolation**: Each service owns its DB schema
- **Black-box**: Test observable behavior (status codes, response shapes)
- **Idempotent**: Tests repeatable without explicit teardown
- **Unique test data**: Use timestamp-suffixed keys for mutation tests

## Seed Data

- 3 identities: System, Alice, Bob
- 2-3 organizations: system, aegir
- Loaded via database init scripts (keycloak.sql, migrations)
- Practices service: context files (5), topics (5), BCP categories (6), catalog entries (15+)

## Contract Relationships

| Consumer | Provider | Contract Surface |
|----------|----------|-----------------|
| agents | iam | Identity (id, type, label, email) |
| agents | system | Tenant (id, key) |
| practices | — | No external dependencies (leaf service) |
| gateway | all | Schema composition (all subgraph types) |

## Test Coverage by Service

| Service | Core | Seed | Adversarial | Contract | Total |
|---------|------|------|-------------|----------|-------|
| IAM | 18 | 6 | 29 | — | 53 |
| System | 12 | 4 | 14 | — | 30 |
| Agents | 10 | 4 | 10 | — | 24 |
| Practices | TBD | TBD | TBD | — | TBD |

## Test Data Strategy

- **Seeds**: Loaded via `seedFromDisk()` from `.agents/` registries and `catalog/` patterns
- **Factories**: Inline per-test with `Date.now()` keys, cleanup after assertions
- **Fixtures**: Not yet needed — services are leaf-level with simple entity graphs
- **Isolation**: Schema-per-service Postgres, unique keys for mutation tests
- **Shared IAM seed**: 3 identities, 2 orgs — all services build on this

## CI Pipeline Stages

| Stage | Tests | Infrastructure | Target |
|-------|-------|---------------|--------|
| PR Checks | `pnpm test` (Layer 1+2) | Postgres | < 2 min |
| Merge Gate | + contracts + federation | All services + gateway | < 5 min |
| Nightly | + event + workflow tests | Full stack + Redpanda | < 15 min |

## QA Strategy Phases

1. Catalog entry validation (Zod schemas)
2. Scaffolder snapshot tests (golden-output)
3. Domain service automation (`shipyard add service`)
4. Applicator tests (before/after equivalence, idempotency)
5. CLI metrics, `shipyard doctor`

See: `docs/design/qa-devex-strategy.md`
