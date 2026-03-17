# Topic: Testing (System)

> General testing best practices.
> Project-specific conventions are in `project/topics/testing.md`.

## Test Pyramid

- **Unit**: Fast, isolated, test pure logic — most numerous
- **Integration**: Test real dependencies (DB, APIs) — moderate count
- **E2E**: Full system behavior — few, focused on critical paths

## Principles

- Tests document behavior — a reader should understand intent from the test name
- Test observable behavior, not implementation details
- Each test should have one clear reason to fail
- Tests must be deterministic — no flaky tests in CI
- Prefer real dependencies over mocks at integration boundaries

## Unit Boundaries

- The **unit** is a service method, not a function or class
- Use real databases within the service's owned schema — do not mock the data layer
- Mock at the service boundary: external HTTP APIs, message brokers, other services
- Test through `fastify.inject()` for API contract verification (black-box)
- See BCP: `testing.unit-boundaries` for the full decision matrix

## Integration Layers

Four layers, each testing a broader scope:

1. **In-Process** (service + DB): `fastify.inject()`, ~50-200ms/test. Workhorse layer.
2. **Database Constraints**: Direct SQL, ~10-50ms/test. UNIQUE, FK, CHECK validation.
3. **Cross-Service** (federation): Gateway HTTP, ~500ms-2s/test. Schema composition.
4. **Event-Driven** (Kafka): Producer/consumer, ~1-5s/test. Async flow verification.

Use the narrowest layer that catches the bug class. 80%+ of tests should be Layer 1.
See BCP: `testing.integration-layers` for the full guide.

## Contract Testing

- **Consumer-driven**: The consuming service defines which fields/behaviors it depends on.
- **Schema contracts**: Verify SDL types, fields, federation directives exist.
- **Behavioral contracts**: Verify expected responses (search returns results, etc.).
- **Event contracts**: Validate Kafka message schemas with Zod or JSON Schema.
- Contracts live with the consumer in `__contracts__/` directory.
- Providers run consumer contracts in their CI.
- See BCP: `testing.contract` for the full pattern.

## Patterns

- **Arrange-Act-Assert**: Setup, execute, verify (one assert block per test)
- **Factory functions**: Create test fixtures with sensible defaults
- **In-process testing**: Use framework injection (e.g., `fastify.inject()`) over HTTP
- **Seed data**: Known fixtures loaded before test suite; tests assert against them
- **Schema isolation**: Each service owns its test database/schema
- **Idempotency verification**: Run upserts twice, verify same result

## Adversarial / QA Testing

- Probe system boundaries with extreme inputs (long strings, special chars, SQL injection)
- Document findings inline — `// FINDING: {description}`
- Test for missing constraints (UNIQUE, FK, NOT NULL, CHECK)
- Verify error responses are safe (no stack traces, no internal details)
- Organized in `__qa__/` directory: seed-invariants, mutation-attacks, cross-entity-invariants
- See BCP: `testing.adversarial` for the full methodology.

## Test Data Strategy

- **Seed data** (Tier 1): Shared foundation, loaded once, read-only during tests. Assert exact
  counts in `__qa__/seed-invariants.test.ts`.
- **Factory functions** (Tier 2): Per-test data creation with timestamp-suffixed keys.
  Clean up after assertions. Used for mutation tests and edge cases.
- **Fixtures** (Tier 3): Multi-entity scenarios. Return a cleanup function.
  Used in `beforeAll` for complex test setups.
- Unique keys prevent ordering dependencies. Never share mutable state between tests.
- Cross-service test data uses shared IAM seed set (3 identities, 2 orgs).
- See BCP: `testing.test-data-strategy` for the full pattern.

## CI Pipeline Integration

Three CI stages aligned with integration layers:

1. **PR Checks** (every push): Layer 1 + 2 tests. Postgres only. < 2 min.
2. **Merge Gate** (merge to main): + Layer 3 + contracts. All services. < 5 min.
3. **Nightly** (scheduled): + Layer 4 event-driven tests. Full stack. < 15 min.

Use consistent `describe` prefixes for CI filtering:
- `"Schema Contract: <provider>"` — contract tests
- `"Seed Invariants — Adversarial QA"` — seed invariant tests
- `"Federation: <description>"` — federation tests

See BCP: `testing.ci-pipeline` for the full stage configuration.

## Anti-Patterns to Avoid

- Mocking the database (diverges from production behavior)
- Shared mutable state between tests (ordering dependencies)
- Testing framework internals instead of your code
- Ignoring test performance — slow tests get skipped
- Provider-only schema testing (doesn't know what consumers use)
- Snapshot-based schema tests (brittle, additive changes shouldn't fail)
- SQL dump seeds (use code-based idempotent seeds instead)
- Running Layer 3+ tests on every PR (too slow, save for merge gate)
- Skipping nightly test failures (triage within 24h)
