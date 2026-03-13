# QA & Developer Experience Strategy for The Shipyard

**Version:** 0.1.0
**Date:** 2026-03-13
**Role:** QA Lead / Developer Experience Lead

---

## Executive Summary

The Shipyard is a software factory. Its output is not a product -- it is other products ("ships"). This means the QA surface area is fundamentally different from a typical application: we must test the **generator**, the **generated output**, and the **transformation process** (pattern application). A bug in the Shipyard multiplies across every ship it produces.

This strategy is built on top of what already exists: vitest across all packages, Biome for formatting/linting, TypeScript strict mode, schema-per-service DB isolation, a 12-step recipe for domain services, and 14 battle-tested patterns from a working product.

---

## 1. Testing Strategy for the Shipyard Itself

### 1.1 Scaffolder Testing (Does Generated Output Work?)

The Scaffolder produces a complete ship from a manifest. The hardest part is proving the output is correct without running it manually. The approach: **golden-output snapshot testing combined with functional verification.**

#### Unit Tests: Template Rendering

```
tests/scaffolder/
  templates/          # test fixtures: minimal manifests
  snapshots/          # golden outputs for comparison
  scaffold.test.ts    # renders templates and compares
```

- Every template file the Scaffolder emits gets a snapshot test.
- The test provides a minimal `shipyard.manifest` and asserts the output matches expected structure.
- Snapshots are committed to the repo. Changes to scaffolding require explicit snapshot updates (vitest `-u` flag), which show up in PR diffs.

#### Integration Tests: Build Verification

These tests go beyond "does it look right" to "does it actually work."

```typescript
describe('Scaffolder: full lifecycle', () => {
  // 1. Scaffold a ship into a temp directory
  // 2. Run `pnpm install` in the temp dir
  // 3. Run `tsc --noEmit` -- types must resolve
  // 4. Run `pnpm build` -- tsup must produce dist/
  // 5. Run `pnpm test` -- vitest must pass (health check, schema introspection)
  // 6. Clean up temp dir
})
```

These are slow (10-30s each) and run in CI, not on every save. They exercise:

| Check | What it proves |
|---|---|
| `pnpm install` succeeds | Dependencies are valid, workspace references resolve |
| `tsc --noEmit` passes | TypeScript compiles with strict mode |
| `pnpm build` produces output | tsup config is valid, entry points exist |
| `vitest run` passes | Health check responds, GraphQL schema serves, seed data loads |

#### Combinatorial Matrix

Ships vary by `type` (web-app, api, cli, library) and by which catalog patterns are included. The Scaffolder needs a test matrix:

| Ship Type | Baseline Patterns | Tests |
|---|---|---|
| `api` | `build.pnpm-turbo`, `api.graphql-federation`, `db.postgres-isolated` | build + serve + query |
| `web-app` | `build.pnpm-turbo`, `frontend.nuxt-spa`, `auth.oidc-keycloak` | build + render + auth flow |
| `cli` | `build.pnpm-turbo` | build + `--help` + exit codes |
| `library` | `build.pnpm-turbo` | build + import in consumer |

Start with `api` (the most common case). Add types as they are implemented.

### 1.2 Applicator Testing (Does Pattern Application Preserve Existing Code?)

The Applicator is the AI agent that applies catalog patterns to an existing ship. This is the highest-risk operation in the Shipyard because it modifies code that already works.

#### Test Approach: Before/After Functional Equivalence

```
tests/applicator/
  fixtures/
    ship-baseline/          # a scaffolded ship in known-good state
    ship-with-logging/      # same ship after applying `logging.structured`
  applicator.test.ts
```

Each test:

1. **Starts with a known-good ship** (the fixture) that has passing tests.
2. **Applies a pattern** via the Applicator.
3. **Runs the ship's existing test suite** -- all pre-existing tests must still pass.
4. **Runs the pattern's own test criteria** -- new tests added by the pattern must pass.
5. **Verifies the manifest was updated** -- `catalog_refs` and `capabilities` reflect the new state.

#### Idempotency Tests

Applying the same pattern twice must not break anything. For every pattern:

```typescript
it('is idempotent', async () => {
  await applicator.apply(ship, 'logging.structured')
  const firstResult = await runTests(ship)

  await applicator.apply(ship, 'logging.structured') // second time
  const secondResult = await runTests(ship)

  expect(secondResult).toEqual(firstResult)
})
```

#### Conflict Detection Tests

When two patterns modify the same file (e.g., both add middleware to `app.ts`), the Applicator must detect and handle this. Test cases:

- Pattern A modifies `app.ts`, then Pattern B also modifies `app.ts` -- both changes must be present.
- Pattern A is applied, then an incompatible Pattern C is requested -- Applicator must refuse and explain why.

### 1.3 Catalog Pattern Testing (Isolation)

Each catalog pattern must be testable in isolation, without a full ship. This is how pattern authors validate their work before publishing.

#### Pattern Test Contract

Every catalog entry must include a `test_criteria` field. The Shipyard enforces this by requiring a test harness per pattern:

```
catalog/
  logging.structured/
    v1.0.0/
      pattern.yaml           # metadata, preconditions, provides
      application.ts         # agent instructions as executable steps
      test/
        test-ship/           # minimal fixture ship
        apply-and-verify.test.ts  # applies pattern to fixture, runs checks
```

The `apply-and-verify.test.ts` for each pattern:

1. Copies `test-ship/` to a temp dir.
2. Applies the pattern.
3. Asserts the pattern's `test_criteria` are met (e.g., "structured logger is configured", "log output is JSON").
4. Asserts the test ship's baseline tests still pass.

### 1.4 Integration Testing

Full integration tests verify the Shipyard end-to-end: scaffold a ship, apply patterns, run the ship.

#### Smoke Test: The "Hello Ship"

A CI job that runs nightly (not on every PR -- too slow):

1. `shipyard new --type api --name hello-ship`
2. `shipyard apply logging.structured --ship hello-ship`
3. `shipyard apply auth.oidc-keycloak --ship hello-ship`
4. `cd hello-ship && pnpm install && pnpm build && pnpm test`
5. Start the ship, hit `/health`, query GraphQL, verify auth middleware.

This catches integration issues between patterns that unit tests miss.

---

## 2. Testing Strategy for Generated Ships

### 2.1 Out-of-the-Box Tests

Every scaffolded ship must include these tests from day one, with zero developer effort:

| Test Category | What It Covers | Implementation |
|---|---|---|
| **Health check** | `GET /health` returns `{ status: "ok", service: "<name>" }` | Per-service `app.test.ts` (already exists in aegir) |
| **Schema introspection** | `{ _service { sdl } }` returns expected types | Per-subgraph `app.test.ts` (already exists) |
| **Type safety** | `tsc --noEmit` passes | Turborepo `build` task dependency |
| **Lint/format** | `biome check .` passes | Root script, CI gate |
| **Seed data verification** | Queries against seeded data return expected results | Per-service `app.test.ts` with fixture assertions |
| **Build verification** | `tsup` produces valid ESM output | Turborepo `build` task |

These are the tests from the existing aegir pattern (`services/iam/src/app.test.ts`, `services/system/src/app.test.ts`). The Scaffolder generates them automatically.

### 2.2 Post-Scaffold Verification ("First Run" Guarantee)

When `shipyard new` completes, the CLI must run a verification pass and report results:

```
Scaffolded "hello-ship" (api)

Verification:
  [pass] pnpm install -- dependencies resolved
  [pass] tsc --noEmit -- types check
  [pass] pnpm build -- dist/ produced
  [pass] vitest run -- 4/4 tests passed
    - health check
    - schema introspection
    - seed data query
    - federation reference resolution

Ship is ready. Run `pnpm dev` to start.
```

If any check fails, the Scaffolder has a bug. This is a hard gate -- a ship that does not pass verification is not shipped.

### 2.3 Post-Pattern-Application Smoke Tests

After every `shipyard apply`, run a targeted smoke suite:

1. **Existing tests still pass** (regression gate).
2. **Pattern-specific checks pass** (from the catalog entry's `test_criteria`).
3. **Manifest is consistent** (all `catalog_refs` resolve, no orphaned capabilities).

The smoke suite is fast (under 10 seconds) because it uses `fastify.inject()` (no network) and in-memory test databases where possible.

---

## 3. Developer Experience Design

### 3.1 CLI Design

The CLI is the primary interface for the Shipyard. It must feel like a tool built by someone who has used `git`, `cargo`, and `npm` -- concise, predictable, informative.

#### Core Commands

```
shipyard new <name> [--type api|web-app|cli|library]
  Scaffold a new ship. Runs verification automatically.

shipyard apply <pattern-id> [--ship <path>]
  Apply a catalog pattern to a ship. Defaults to current directory.

shipyard catalog list [--search <term>]
  Browse available patterns.

shipyard catalog show <pattern-id>
  Show pattern details: preconditions, provides, version history.

shipyard verify [--ship <path>]
  Run the full verification suite against a ship.

shipyard status [--ship <path>]
  Show ship manifest, applied patterns, and drift detection.

shipyard doctor
  Check Shipyard installation, dependencies, and environment health.
```

#### Output Principles

- **Structured, not chatty.** One line per action. Use `[pass]`/`[fail]`/`[skip]` prefixes.
- **Colors for status.** Green for success, red for failure, yellow for warnings. Respect `NO_COLOR` env var.
- **Progressive disclosure.** Default output is summary. `--verbose` shows detail. `--json` outputs machine-readable.
- **Timing.** Show elapsed time for operations over 1 second.
- **Error messages.** Always include: what failed, why it failed, what to do about it.

Example error output:

```
[fail] Pattern "auth.oidc-keycloak" requires precondition "api.graphql-federation"
       Ship "hello-ship" does not have this pattern applied.

       To fix: shipyard apply api.graphql-federation --ship hello-ship
       Then retry: shipyard apply auth.oidc-keycloak --ship hello-ship
```

### 3.2 Automating the 12-Step Domain Service Recipe

The existing recipe at `docs/design/recipes/adding-a-domain-service.md` has 12 manual steps. This is the Shipyard's first automation target.

#### Proposed Command

```
shipyard add service <name> [--port <port>]
```

#### What It Automates

| Step | Manual Today | Automated |
|---|---|---|
| 1. Choose a port | Developer picks from table | Auto-detect next available port from gateway config |
| 2. Domain types | Create file in `packages/domain/src/` | Generate from entity name, re-export from index |
| 3. Terraform DB | Edit 4 files in `infra/local/tf/` | Generate HCL blocks, run `tofu apply` |
| 4. Scaffold directory | Create 6+ boilerplate files | Copy from internal template with substitutions |
| 5. Migrations | Write SQL by hand | Generate CREATE TABLE from entity definition |
| 6. Service classes | Write `*.svc.ts` | Generate CRUD service with DI pattern |
| 7. GraphQL schema | Write `schema.ts` | Generate from entity + conventions |
| 8. Resolvers | Write `resolvers.ts` | Generate namespace + CRUD resolvers |
| 9. App bootstrap | Copy and modify `app.ts` | Generate with correct port, PG config, service name |
| 10. Gateway registration | Edit 2 files | Append to config.ts and app.ts |
| 11. Traefik routing | Edit `dynamic.yml` | Append router + middleware + service blocks |
| 12. Tests | Write `app.test.ts` | Generate health + schema + query tests |
| 13. Final steps | Run 5 commands | Run `pnpm install && build && test` automatically |

Steps 5-8 (migrations, services, schema, resolvers) require a domain entity definition as input. The minimal input:

```yaml
# Entity definition (could be interactive prompt or file)
name: Invoice
fields:
  - name: key
    type: string
    unique: true
  - name: amount
    type: decimal
  - name: status
    type: enum
    values: [DRAFT, SENT, PAID, VOID]
  - name: organization_id
    type: integer
    reference: iam.organization
```

This generates all SQL, TypeScript types, service methods, GraphQL types, and resolvers. The developer refines from there.

### 3.3 Feedback Loops

#### Local Development (Already Strong)

The existing setup is good: `pnpm dev` starts all services via Turborepo with `tsx watch`. Hot reload is effectively instant. Keep this.

#### Additions Needed

| Feedback Loop | Implementation | Target Latency |
|---|---|---|
| **Type checking on save** | `tsc --noEmit --watch` per service (add to `dev` script) | <2s |
| **Test on save** | `vitest --watch` (already in `test:watch` script) | <3s |
| **Lint on save** | Biome VS Code extension (already installed) | <1s |
| **Schema validation on save** | GraphQL schema linting in CI + editor plugin | <1s |
| **Catalog pattern validation** | `shipyard catalog validate <path>` during pattern authoring | <5s |
| **Ship verification after apply** | Automatic post-apply smoke run | <10s |

#### Watch Mode for Pattern Authoring

When developing a new catalog pattern, the author needs:

```
shipyard catalog dev <pattern-path>
```

This command:
1. Watches the pattern files for changes.
2. On change, re-applies the pattern to the test fixture ship.
3. Runs the pattern's `test_criteria`.
4. Reports results inline.

Cycle time target: under 5 seconds from save to test result.

### 3.4 Documentation Strategy

#### Principles

- **No separate docs that drift.** The recipe document already exists and will go stale if it is not the source of truth for the automation.
- **Code is the documentation.** The catalog pattern's `application_instructions` and `test_criteria` fields ARE the docs for that pattern. If the instructions are wrong, the pattern does not apply correctly -- this is self-enforcing.
- **Generated API docs.** GraphQL schema introspection generates schema docs automatically. Do not write separate API documentation.
- **Living recipe docs.** The `adding-a-domain-service.md` recipe should be generated from the `shipyard add service` command's template, not maintained separately.

#### Documentation Artifacts

| Artifact | Source of Truth | Format |
|---|---|---|
| Pattern documentation | `catalog/<pattern>/pattern.yaml` | YAML, rendered in `shipyard catalog show` |
| API documentation | GraphQL SDL served by each subgraph | Introspection, viewed in playground or generated |
| Architecture diagrams | `.devcontainer/docker-compose.yml` + Traefik config | Generated from compose labels |
| Ship status | `shipyard.manifest` + `shipyard status` | CLI output, not a separate file |
| Recipe/how-to docs | Automation code + `--dry-run` output | CLI shows what it would do |
| Conventions | `docs/design/` folder (existing) | Markdown, human-maintained |

---

## 4. Quality Gates

### 4.1 Before a Pattern Enters the Catalog

A new pattern must pass all of these before merge:

| Gate | Check | Automated? |
|---|---|---|
| **Schema validation** | `pattern.yaml` matches the catalog entry schema (id, version, preconditions, provides, application_instructions, test_criteria) | Yes -- JSON Schema / Zod validation |
| **Test fixture exists** | `test/test-ship/` directory contains a valid minimal ship | Yes -- directory structure check |
| **Apply-and-verify passes** | Pattern applies cleanly to its test fixture; all test_criteria pass | Yes -- vitest |
| **Idempotency** | Applying twice produces identical results | Yes -- vitest |
| **Baseline preservation** | Test fixture's pre-existing tests still pass after application | Yes -- vitest |
| **Versioning** | Version follows semver; breaking changes bump major | Manual review |
| **Preconditions documented** | Every entry in `preconditions` corresponds to a real catalog pattern | Yes -- cross-reference check |
| **No secrets** | Pattern does not embed credentials, API keys, or tokens | Yes -- secret scanner |

### 4.2 Before a Ship Is "Scaffolded" (Exit Criteria)

The Scaffolder's output is not considered valid until:

| Gate | Check |
|---|---|
| `pnpm install` exits 0 | Dependencies resolve |
| `tsc --noEmit` exits 0 | Types compile under strict mode |
| `pnpm build` exits 0 | tsup produces ESM output |
| `vitest run` exits 0 | Health check, schema introspection, seed data tests pass |
| `biome check .` exits 0 | Code passes lint and format rules |
| `shipyard.manifest` is valid | Manifest schema validates; all `catalog_refs` point to real patterns |
| No `TODO` or `FIXME` in generated code | Scaffolder output must be complete |

### 4.3 CI/CD Pipeline Design

#### For the Shipyard Repository (this repo)

```
on: [push, pull_request]

jobs:
  lint:
    - biome check .
    - tsc --noEmit (all packages)

  unit-tests:
    - vitest run (all packages, parallel via Turborepo)
    needs: [lint]

  catalog-validation:
    - For each catalog pattern:
      - Validate pattern.yaml schema
      - Run apply-and-verify tests
      - Run idempotency tests
    needs: [unit-tests]

  scaffold-verification:
    - For each ship type (api, web-app, cli, library):
      - Scaffold into temp dir
      - Run full verification suite
    needs: [unit-tests]
    # Runs on main branch merges and nightly, not every PR (too slow)

  integration:
    - Scaffold ship
    - Apply multiple patterns
    - Build and run ship
    - Hit endpoints, verify responses
    needs: [scaffold-verification]
    # Nightly only
```

#### For Generated Ships (template CI shipped with every ship)

Every ship gets a `.github/workflows/ci.yml` (or equivalent) as part of scaffolding:

```yaml
# Shipped with every scaffolded ship
on: [push, pull_request]

jobs:
  quality:
    steps:
      - pnpm install
      - biome check .
      - tsc --noEmit
      - pnpm build
      - vitest run

  # Optional: integration tests requiring databases
  integration:
    services:
      postgres: { ... }
    steps:
      - pnpm install
      - pnpm build
      - vitest run --project integration
```

This CI template is itself a catalog pattern (`ci.github-actions`) and can be versioned/updated independently.

---

## 5. DevEx Metrics

### 5.1 Primary Metrics

These are the numbers that tell us whether the Shipyard is achieving its purpose.

| Metric | Target | How to Measure |
|---|---|---|
| **Time from `shipyard new` to running app** | < 60 seconds | CLI timer from command start to verification pass |
| **Time from pattern request to applied + verified** | < 30 seconds | CLI timer from `shipyard apply` to smoke pass |
| **First-run success rate** | 100% | Percentage of `shipyard new` that pass verification without manual intervention |
| **Pattern application success rate** | > 95% | Percentage of `shipyard apply` that pass smoke tests without manual fixes |
| **Manual steps after `shipyard add service`** | 0 for boilerplate, 1-2 for business logic | Count of steps the developer must perform manually |

### 5.2 Secondary Metrics

| Metric | Target | Why It Matters |
|---|---|---|
| **Catalog coverage** | > 80% of common needs | Measures how often `catalog before code` is possible |
| **Test suite runtime per ship** | < 30 seconds | Developers skip slow test suites |
| **CI pipeline duration** | < 5 minutes for ships | Fast feedback on PRs |
| **Pattern idempotency failures** | 0 | Non-zero means the Applicator has bugs |
| **Manifest drift incidents** | Track over time | How often ships diverge from their manifest |

### 5.3 Measurement Implementation

Bake metrics into the CLI itself:

```typescript
// Every CLI command records timing
const start = performance.now()
// ... do work ...
const elapsed = performance.now() - start

telemetry.record({
  command: 'shipyard new',
  shipType: 'api',
  duration_ms: elapsed,
  success: true,
  patternsApplied: ['build.pnpm-turbo', 'api.graphql-federation'],
  verificationPassed: true,
})
```

Telemetry is opt-in, local-only by default (stored in `~/.shipyard/metrics.jsonl`). No phone-home. The developer can run `shipyard metrics` to see their own stats.

---

## 6. Testing Architecture Specifics

### 6.1 Test Database Strategy

The existing aegir codebase uses real Postgres with schema-per-service isolation. For testing:

**Shipyard tests (catalog patterns, scaffolder):** Use Docker-launched ephemeral Postgres containers via testcontainers or a shared test Postgres with per-test-run schemas:

```typescript
// Test helper: create isolated schema per test suite
async function createTestSchema(serviceName: string): Promise<TestDb> {
  const schema = `test_${serviceName}_${Date.now()}`
  await superDb.query(`CREATE SCHEMA ${schema}`)
  // Run migrations against this schema
  // Return connection configured for this schema
  // Teardown: DROP SCHEMA CASCADE
}
```

**Ship tests (generated with the ship):** Use the devcontainer's Postgres (already running). The Moribashi `pgPlugin` handles migrations automatically on startup. Tests use `fastify.inject()` for zero-network-overhead HTTP testing (already the pattern in `services/iam/src/app.test.ts`).

### 6.2 Testing Pattern Application Concretely

The most novel testing challenge: how do you verify that an AI agent correctly modified source code?

#### Approach: Structural Assertions, Not String Matching

Do not assert on exact file contents (too brittle). Instead, assert on structural properties:

```typescript
describe('after applying logging.structured', () => {
  it('app.ts imports the logger', async () => {
    const appSource = await fs.readFile(ship.resolve('src/app.ts'), 'utf-8')
    const ast = parse(appSource) // TypeScript AST
    const imports = getImports(ast)
    expect(imports).toContainEqual(
      expect.objectContaining({ module: '@shipyard/logging' })
    )
  })

  it('logger is registered in the DI container', async () => {
    // Start the app, inspect the cradle
    const { app } = await buildApp(ship.path)
    expect(app.cradle).toHaveProperty('logger')
  })

  it('health endpoint includes log correlation ID', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/health' })
    expect(response.headers).toHaveProperty('x-request-id')
  })

  it('existing tests still pass', async () => {
    const result = await exec('vitest run', { cwd: ship.path })
    expect(result.exitCode).toBe(0)
  })
})
```

#### Approach: Behavioral Black-Box Tests

For patterns that add observable behavior, test the behavior, not the code:

```typescript
// Pattern: auth.oidc-keycloak
it('unauthenticated requests get 401', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    payload: { query: '{ me { id } }' },
  })
  expect(response.statusCode).toBe(401)
})

// Pattern: logging.structured
it('logs are JSON formatted', async () => {
  const logs = captureStdout(() => fastify.inject({ method: 'GET', url: '/health' }))
  const parsed = JSON.parse(logs[0])
  expect(parsed).toHaveProperty('level')
  expect(parsed).toHaveProperty('timestamp')
  expect(parsed).toHaveProperty('service')
})
```

### 6.3 Regression Safety Net

Every ship gets a "canary query" -- a GraphQL query that exercises the full stack:

```graphql
# canary.graphql -- generated per ship, exercises all subgraphs
{
  _service { sdl }
  # For each subgraph, one representative query:
  iam { identities { search(input: {}) { results { id } } } }
  system { integrations { search(input: {}) { results { id } } } }
}
```

This canary query is run:
- After every `shipyard apply`
- In CI on every PR
- As the first test in the integration suite

If the canary fails, something fundamental is broken.

---

## 7. Implementation Priority

This strategy is large. Here is the order in which to build it, prioritized by impact and aligned with what already exists.

### Phase 1: Foundation (Weeks 1-2)

1. **Catalog entry schema validation** -- Zod schema for `pattern.yaml`, enforced in CI.
2. **First catalog entry formalized** -- Take `api.graphql-federation` (already working in aegir) and write its `pattern.yaml`, `test_criteria`, and `apply-and-verify.test.ts`.
3. **Ship verification command** -- `shipyard verify` that runs the 7-gate checklist from Section 4.2.

### Phase 2: Scaffolder (Weeks 3-4)

4. **`shipyard new --type api`** -- Scaffold an API ship with the existing service template.
5. **Scaffolder snapshot tests** -- Golden-output tests for the generated files.
6. **Scaffolder integration test** -- Build-and-run test in CI.

### Phase 3: Domain Service Automation (Weeks 5-6)

7. **`shipyard add service`** -- Automate the 12-step recipe.
8. **Template test generation** -- Auto-generate `app.test.ts` with health, schema, and query tests.

### Phase 4: Applicator (Weeks 7-8)

9. **Applicator smoke test harness** -- Before/after functional equivalence framework.
10. **Idempotency test framework** -- Generic test wrapper for any pattern.

### Phase 5: Metrics & Polish (Weeks 9-10)

11. **CLI timing and telemetry** -- Bake metrics into every command.
12. **`shipyard doctor`** -- Environment health check.
13. **CI templates shipped with ships** -- `ci.github-actions` catalog pattern.

---

## 8. Open Questions for the Founder

1. **Test database lifecycle:** Should ship tests use the devcontainer Postgres (fast, couples to Docker) or testcontainers (isolated, slower)? Recommendation: devcontainer for local dev, testcontainers in CI.

2. **Catalog pattern authoring:** Should pattern authors provide executable application steps (code) or declarative instructions (YAML that the Applicator interprets)? Recommendation: start declarative, escape to code for complex patterns.

3. **Ship CI template:** Should every ship get GitHub Actions, or should CI be provider-agnostic? Recommendation: ship GitHub Actions as default, make it a swappable catalog pattern.

4. **Telemetry scope:** Local-only metrics, or optional aggregate reporting to improve the Shipyard? Recommendation: local-only for now, aggregate later with explicit opt-in.

5. **Drift tolerance:** When a developer manually modifies code that a pattern generated, how much drift is acceptable before `shipyard status` warns? Recommendation: track via manifest checksums, warn but do not block.
