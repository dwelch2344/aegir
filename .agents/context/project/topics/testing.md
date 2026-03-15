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
```

## Test Patterns

**Core service tests** (`app.test.ts`):
- `beforeAll`: build Fastify app instance
- `afterAll`: graceful stop
- Test health endpoint: `GET /health`
- Test federation: `{ _service { sdl } }`
- Test queries/mutations via `fastify.inject()` (in-process, no network)

**Seed invariant tests** (`__qa__/`):
- Assert exact record counts from seed data
- Validate uniqueness, FK integrity, data shapes

**Adversarial tests** (`__qa__/`):
- Extreme inputs: 1000+ chars, special characters, HTML/XSS, SQL injection
- Document findings inline: `// FINDING: {description}`
- Probe missing constraints (UNIQUE, FK, CHECK, min-length)

## Key Conventions

- **Real database**: Tests hit actual PostgreSQL — no mocks for data layer
- **In-process HTTP**: Use `fastify.inject()` not HTTP clients
- **Schema isolation**: Each service owns its DB schema
- **Black-box**: Test observable behavior (status codes, response shapes)
- **Idempotent**: Tests repeatable without explicit teardown

## Seed Data

- 3 identities: System, Alice, Bob
- 2-3 organizations: system, aegir
- Loaded via database init scripts (keycloak.sql, migrations)

## QA Strategy Phases

1. Catalog entry validation (Zod schemas)
2. Scaffolder snapshot tests (golden-output)
3. Domain service automation (`shipyard add service`)
4. Applicator tests (before/after equivalence, idempotency)
5. CLI metrics, `shipyard doctor`

See: `docs/design/qa-devex-strategy.md`
