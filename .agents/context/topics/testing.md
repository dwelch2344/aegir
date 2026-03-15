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

## Patterns

- **Arrange-Act-Assert**: Setup → execute → verify (one assert block per test)
- **Factory functions**: Create test fixtures with sensible defaults
- **In-process testing**: Use framework injection (e.g., `fastify.inject()`) over HTTP
- **Seed data**: Known fixtures loaded before test suite; tests assert against them
- **Schema isolation**: Each service owns its test database/schema

## Adversarial / QA Testing

- Probe system boundaries with extreme inputs (long strings, special chars, SQL injection)
- Document findings inline — `// FINDING: {description}`
- Test for missing constraints (UNIQUE, FK, NOT NULL, CHECK)
- Verify error responses are safe (no stack traces, no internal details)

## Anti-Patterns to Avoid

- Mocking the database (diverges from production behavior)
- Shared mutable state between tests (ordering dependencies)
- Testing framework internals instead of your code
- Ignoring test performance — slow tests get skipped
