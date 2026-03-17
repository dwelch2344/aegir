# BCP: testing.unit-boundaries

> Defining what constitutes a "unit" in domain service testing.

**ID:** `testing.unit-boundaries`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

The term "unit test" is ambiguous. In a system with dependency injection, database-backed
services, and GraphQL resolvers, developers waste time arguing about isolation levels instead
of writing useful tests. Over-isolation (mocking the database) hides real bugs. Under-isolation
(testing through the full HTTP stack for everything) makes tests slow and hard to debug.

## Best Current Practice

### The Unit Is the Service Method

In domain service architectures, a **unit** is a single service method invoked through its
public interface. The boundary is:

- **Inside the unit:** The service class, its SQL queries, the database schema it owns.
- **Outside the unit:** Other services, external HTTP APIs, message brokers, the GraphQL
  resolver layer.

### Use Real Dependencies Within the Boundary

A `ContextService.upsertFile()` call should hit a real Postgres database with real migrations
applied. This is not an integration test — it is a unit test with a real collaborator that the
service owns and controls.

**Why:** Mocked databases diverge from production. SQL query bugs, constraint violations, and
migration errors are the most common production failures. A test that mocks `db.query()` proves
nothing about the query itself.

### Mock at the Service Boundary

When Service A calls Service B, mock Service B. When a service calls an external API, mock the
HTTP client. The boundary is ownership: if you own it, use the real thing. If you don't, mock it.

```typescript
// GOOD: Real database, testing the actual SQL
const result = await contextService.searchFiles({ organizationId: 1 })
expect(result.results).toHaveLength(3)

// GOOD: Mocked external service
const mockKeycloak = { getOrgs: vi.fn().mockResolvedValue([...]) }
const service = new OrgService({ db, keycloak: mockKeycloak })

// BAD: Mocked database — proves nothing about the query
const mockDb = { query: vi.fn().mockResolvedValue([{ id: 1 }]) }
```

### Test Through GraphQL for Observable Behavior

For verifying what the API consumer sees, test through `fastify.inject()` with GraphQL queries.
This is not an integration test — it is a black-box unit test of the API contract:

```typescript
const response = await fastify.inject({
  method: 'POST',
  url: '/graphql',
  payload: { query: '{ practices { context { files { search(input: {}) { results { id } } } } } }' },
})
expect(response.json().data.practices.context.files.search.results).toHaveLength(5)
```

### Decision Matrix

| What You're Testing | Approach | Database | Other Services |
|---|---|---|---|
| SQL query correctness | Service method call | Real | N/A |
| Business logic in service | Service method call | Real | Mocked |
| API contract (response shape) | `fastify.inject()` | Real | N/A (same service) |
| Cross-service interaction | Contract test | Real | Consumer contract |
| Input validation / edge cases | `fastify.inject()` | Real | N/A |

## Anti-Patterns

- **Mocking the database** — Hides SQL bugs. Use real Postgres with schema isolation.
- **Testing private methods** — If you need to test internals, the service needs refactoring.
- **One assertion per test dogma** — Multiple related assertions in one test are fine when they
  test a single behavior (e.g., "upsert returns all fields correctly").
- **Test-per-method** — Test behaviors, not methods. A service with 5 methods might need 15 tests
  because some methods have multiple important behaviors.

## When to Deviate

- **Pure utility functions** (string formatting, date math) can be tested without a database.
- **Complex algorithmic logic** extracted into pure functions should be tested in isolation.
- **Performance-sensitive code** where database round-trips dominate — benchmark separately.

## References

- Context: `topics/testing.md` (system), `project/topics/testing.md` (project)
- Related BCP: `testing.integration-layers`, `testing.contract`
