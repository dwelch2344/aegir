# BCP: testing.adversarial

> Systematic adversarial testing and QA probing for domain services.

**ID:** `testing.adversarial`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

Standard tests verify that code works correctly with valid inputs. Production systems fail
from unexpected inputs, missing constraints, race conditions, and edge cases that no one
thought to test. Without systematic adversarial testing, these bugs surface as security
vulnerabilities, data corruption, or silent failures in production.

## Best Current Practice

### The `__qa__/` Directory Pattern

Every domain service has a `__qa__/` directory containing adversarial tests. These tests are
separate from `app.test.ts` (which tests happy-path behavior) and focus exclusively on probing
for weaknesses.

```
services/<service>/src/
  app.test.ts                         # Happy path: "it works correctly"
  __qa__/
    seed-invariants.test.ts           # "seed data is consistent and complete"
    mutation-attacks.test.ts          # "mutations handle bad input safely"
    cross-entity-invariants.test.ts   # "referential integrity holds"
```

### Seed Invariant Testing

Seed data is the foundation of a working system. If seeds are wrong, everything downstream
is wrong. Test them explicitly:

```typescript
describe('Seed Invariants', () => {
  it('has exactly N context files seeded', async () => {
    const { results } = await contextService.searchFiles({ organizationId: 1 })
    expect(results).toHaveLength(5)  // 3 global + 2 project
  })

  it('has exactly N topics seeded', async () => {
    const { results } = await contextService.searchTopics({ organizationId: 1 })
    expect(results).toHaveLength(5)  // graphql, kafka, conductor, infra, testing
  })

  it('all seeded files have non-empty content', async () => {
    const { results } = await contextService.searchFiles({ organizationId: 1 })
    for (const file of results) {
      expect(file.content, `${file.path} has empty content`).toBeTruthy()
    }
  })

  it('seed data is idempotent — running twice produces same counts', async () => {
    const before = await contextService.searchFiles({ organizationId: 1 })
    await seedFromDisk(services, { workspace, orgId: 1 })
    const after = await contextService.searchFiles({ organizationId: 1 })
    expect(after.results).toHaveLength(before.results.length)
  })
})
```

### Mutation Attack Patterns

Systematically probe every mutation with adversarial inputs:

#### 1. Extreme String Lengths

```typescript
it('handles extremely long input strings', async () => {
  const longString = 'x'.repeat(10000)
  const response = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: `mutation { practices { context { files {
        upsert(input: { organizationId: 1, tier: "global", path: "${longString}" }) { id }
      } } } }`,
    },
  })
  // Should either succeed (if no length constraint) or return a clear error
  // Should NOT crash the server
  expect(response.statusCode).toBe(200)
})
```

#### 2. SQL Injection Attempts

```typescript
it('is safe from SQL injection in search inputs', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: `{ practices { catalog { entries {
        search(input: { patternIdIn: ["'; DROP TABLE catalog_entry; --"] }) {
          results { id }
        }
      } } } }`,
    },
  })
  expect(response.statusCode).toBe(200)
  // Verify table still exists by running another query
  const verify = await fastify.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: '{ practices { catalog { entries { search(input: {}) { results { id } } } } } }',
    },
  })
  expect(verify.json().data.practices.catalog.entries.search.results.length).toBeGreaterThan(0)
})
```

#### 3. Special Characters

```typescript
const SPECIAL_CHARS = [
  '<script>alert("xss")</script>',
  '"; DROP TABLE users; --',
  'Robert\'); DROP TABLE students;--',
  '{{template injection}}',
  '${process.env.SECRET}',
  '\x00\x01\x02',  // null bytes
  '\\n\\r\\t',      // escape sequences
  '\u202E\u0041\u0042',  // Unicode RTL override
]

for (const input of SPECIAL_CHARS) {
  it(`safely handles special characters: ${input.slice(0, 30)}...`, async () => {
    // ... test each input through relevant mutations
  })
}
```

#### 4. Boundary Values

```typescript
it('handles zero, negative, and extreme numeric inputs', async () => {
  for (const orgId of [0, -1, 999999999, Number.MAX_SAFE_INTEGER]) {
    const response = await service.searchFiles({ organizationId: orgId })
    expect(response.results).toEqual([])  // No crash, just empty results
  }
})
```

### Cross-Entity Invariant Testing

Verify that relationships between entities remain consistent:

```typescript
describe('Cross-Entity Invariants', () => {
  it('every BCP entry references a valid category', async () => {
    const { results: entries } = await bcpService.searchEntries({})
    const { results: categories } = await bcpService.searchCategories({})
    const categoryIds = new Set(categories.map(c => c.id))

    for (const entry of entries) {
      expect(categoryIds.has(entry.categoryId),
        `Entry ${entry.entryId} references non-existent category ${entry.categoryId}`
      ).toBe(true)
    }
  })

  it('deleting a category cascades to its entries', async () => {
    // Create a temporary category with entries
    const cat = await bcpService.upsertCategory({ ... })
    await bcpService.upsertEntry({ categoryId: cat.id, ... })

    // Delete category
    await bcpService.deleteCategory(cat.id)

    // Entries should be gone too
    const { results } = await bcpService.searchEntries({ categoryIdIn: [cat.id] })
    expect(results).toHaveLength(0)
  })
})
```

### Finding Documentation Pattern

When a test reveals a missing constraint, data issue, or unexpected behavior, document it
inline with a `// FINDING:` comment:

```typescript
it('accepts empty string for entry title', async () => {
  const result = await bcpService.upsertEntry({
    organizationId: 1,
    categoryId: catId,
    entryId: 'empty-title',
    title: '',
  })
  // FINDING: Empty titles are accepted. Consider adding a CHECK constraint
  // or application-level validation: title VARCHAR(255) NOT NULL CHECK (length(title) > 0)
  expect(result.title).toBe('')
})
```

Findings are triaged into:
- **Critical** — Data corruption, security vulnerability. Fix immediately.
- **Important** — Missing constraint, surprising behavior. Fix before ship.
- **Informational** — Unexpected but harmless. Document and decide later.

### Coverage Targets for Adversarial Tests

For each domain service, ensure coverage of:

| Attack Surface | Minimum Tests |
|---|---|
| Each mutation with extreme strings | 1 per mutation |
| SQL injection on each search input | 1 per search field |
| Special characters in text fields | 1 set across all text inputs |
| Boundary numerics (0, negative, max) | 1 per numeric input |
| Missing required fields | 1 per mutation (GraphQL handles this, but verify) |
| Idempotency of upserts | 1 per upsert mutation |
| Cascade behavior on deletes | 1 per FK relationship |
| Seed data consistency | Full suite in seed-invariants.test.ts |

## Anti-Patterns

- **Skipping adversarial tests because "GraphQL validates input"** — GraphQL type validation
  is necessary but not sufficient. It won't catch SQL injection in string fields, missing DB
  constraints, or semantic violations.
- **Random fuzzing without assertions** — Each adversarial test must assert a specific
  expected behavior (safe error, empty result, unchanged data).
- **Adversarial tests that modify shared state** — Use unique keys/IDs to avoid interfering
  with other tests. Clean up test data or use transactions.
- **Testing only for crashes** — A non-crashing but incorrect response (e.g., returning
  another user's data) is worse than a crash.

## References

- Context: `project/topics/testing.md` (QA phases)
- Related BCP: `testing.unit-boundaries`, `testing.integration-layers`
- Prior Art: `services/iam/src/__qa__/` (first implementation of this pattern)
