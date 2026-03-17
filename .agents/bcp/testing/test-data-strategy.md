# BCP: testing.test-data-strategy

> Managing test data across domain services: seeds, factories, fixtures, and isolation.

**ID:** `testing.test-data-strategy`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

As the number of domain services grows, test data management becomes a first-class concern. Seed
data sprawls across services, test fixtures diverge, and mutation tests pollute shared state.
Without a deliberate strategy, tests become order-dependent, flaky, and impossible to reason about
in isolation.

## Best Current Practice

### Three Tiers of Test Data

#### Tier 1: Seed Data (Shared Foundation)

Seed data represents the minimum viable world: the identities, organizations, and reference data
that every service assumes exist. Seeds are loaded once before the test suite runs and are
**read-only** during tests.

```
Seeds provide the "given" in every test's arrange-act-assert.
Tests should never modify seed data — only read from it.
```

**Rules:**
- Seeds are idempotent — running the seed function twice produces the same state.
- Seeds are declared in code (not SQL dumps) using service upsert methods.
- Each service seeds its own domain; cross-service seeds use shared identities/orgs from IAM.
- Seed counts are asserted in `__qa__/seed-invariants.test.ts` — if counts change, tests break
  intentionally.

**Standard seed data set:**

| Entity | Records | Purpose |
|--------|---------|---------|
| Identities | 3 (System, Alice, Bob) | Auth context for all services |
| Organizations | 2 (system, aegir) | Multi-tenancy baseline |
| Service-specific | Varies | Domain seed per service |

#### Tier 2: Factory Functions (Per-Test Creation)

For mutation tests and edge cases, create data within the test using factory functions.
Factory-created data uses timestamp-suffixed keys to avoid collisions.

```typescript
// Factory pattern: create unique test data
function createTestContextFile(overrides: Partial<ContextFileInput> = {}) {
  return {
    organizationId: 1,
    tier: 'project',
    path: `test/factory-${Date.now()}-${Math.random().toString(36).slice(2)}.md`,
    description: 'Factory-created test file',
    content: '# Factory content',
    ...overrides,
  }
}
```

**Rules:**
- Factory functions live in the test file or a shared `test-utils.ts` within the service.
- Every factory-created record must be cleaned up in the test (delete after assert).
- Factory functions accept overrides for all fields — this enables edge case testing.
- Never use factory functions where seed data suffices (queries, read paths).

#### Tier 3: Fixtures (Complex Scenarios)

For tests that require a specific multi-entity state (e.g., "a category with 3 entries, one
of which references a catalog pattern"), use fixture functions that compose factories.

```typescript
async function setupBcpFixture(fastify: FastifyInstance) {
  const category = await createCategory({ categoryId: `fixture-${Date.now()}` })
  const entries = await Promise.all([
    createEntry({ categoryId: category.id, entryId: 'entry-a' }),
    createEntry({ categoryId: category.id, entryId: 'entry-b' }),
  ])
  return { category, entries, cleanup: () => deleteCategory(category.id) }
}
```

**Rules:**
- Fixtures return a cleanup function.
- Fixtures are used in `beforeAll` or at the top of a `describe` block.
- Fixtures document their shape — a reader should understand the data topology from the code.

### Data Isolation Between Tests

Tests must not depend on execution order. Achieve this through:

1. **Unique keys** — Every created record uses `Date.now()` or UUID suffixes.
2. **Cleanup** — Every mutation test cleans up its own data.
3. **Organization scoping** — Use a dedicated test org ID for mutation tests if needed.
4. **Schema isolation** — Each service owns its Postgres schema; no cross-service DB access.

### Cross-Service Test Data

When testing service interactions (e.g., agents depends on IAM identities):

- **Contract tests** reference seed data by known values, not dynamic IDs.
- **Never create test data in one service for another service's tests.** Instead, contract tests
  verify the provider's seed data matches the consumer's expectations.
- **The IAM seed set (3 identities, 2 orgs) is the canonical shared fixture** — all services
  build on top of it.

### Seed Data Versioning

When seed data changes:

1. Update the seed function in the affected service.
2. Update `__qa__/seed-invariants.test.ts` with the new expected counts.
3. Update the project context topic (`project/topics/testing.md`) with new counts.
4. If the change affects cross-service seeds (identities, orgs), coordinate with all services.

## Anti-Patterns

- **SQL dump seeds** — Hard to maintain, version, or make idempotent. Use code-based seeds.
- **Shared mutable test data** — If test A creates a record that test B reads, you have ordering
  dependency. Use seed data for reads, factories for writes.
- **Magic numbers in tests** — `expect(results).toHaveLength(5)` without explaining why 5.
  Comment seed composition: `// 3 global + 2 project = 5`.
- **Cross-service database writes** — Service A should never INSERT into Service B's tables.
  Use APIs or contract tests.
- **Resetting the database between tests** — Too slow. Use unique keys and cleanup instead.

## References

- Context: `project/topics/testing.md` (seed data section)
- Related BCP: `testing.unit-boundaries`, `testing.adversarial`
