# BCP: testing.integration-layers

> Defining the integration test layers and when to use each.

**ID:** `testing.integration-layers`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

"Integration test" is overloaded. A test that uses `fastify.inject()` with a real database is
called an integration test. A test that starts three services and hits them through the gateway
is also called an integration test. Without clear layer definitions, teams either under-test
(skipping cross-boundary verification) or over-test (running slow full-stack tests for
everything).

## Best Current Practice

### Four Integration Layers

Each layer tests a broader scope. Use the narrowest layer that catches the bug class you care
about.

#### Layer 1: In-Process (Service + Database)

**Scope:** One service, real database, no network.
**Tool:** `fastify.inject()` with Moribashi `pgPlugin`.
**Speed:** ~50-200ms per test.
**Use for:** Query correctness, mutation behavior, seed data validation, input edge cases.

```typescript
// Layer 1: In-process integration
const response = await fastify.inject({
  method: 'POST',
  url: '/graphql',
  payload: { query: '{ practices { bcp { categories { search(input: {}) { results { id } } } } } }' },
})
expect(response.json().data.practices.bcp.categories.search.results.length).toBeGreaterThan(0)
```

**This is the workhorse layer.** 80%+ of your integration tests should be here.

#### Layer 2: Database Constraint Verification

**Scope:** Database schema, constraints, migrations.
**Tool:** Direct SQL via the service's database connection.
**Speed:** ~10-50ms per test.
**Use for:** UNIQUE constraints, FK integrity, CHECK constraints, migration ordering.

```typescript
// Layer 2: Database constraint verification
it('enforces unique organization_id + entry_id on bcp_entry', async () => {
  // First insert succeeds
  await bcpService.upsertEntry({ organizationId: 1, entryId: 'test', ... })
  // Second insert with same key should upsert, not duplicate
  await bcpService.upsertEntry({ organizationId: 1, entryId: 'test', ... })
  const { results } = await bcpService.searchEntries({ entryIdIn: ['test'] })
  expect(results.filter(e => e.entryId === 'test')).toHaveLength(1)
})
```

#### Layer 3: Cross-Service (Federation / Gateway)

**Scope:** Multiple services via the federated gateway.
**Tool:** HTTP requests to the gateway (port 4000) or `fastify.inject()` on the gateway.
**Speed:** ~500ms-2s per test.
**Use for:** Federation entity resolution, cross-subgraph queries, schema composition.

```typescript
// Layer 3: Cross-service federation
it('gateway composes IAM and System subgraphs', async () => {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        iam { identities { search(input: {}) { results { id } } } }
        system { tenants { search(input: {}) { results { id } } } }
      }`,
    }),
  })
  const body = await response.json()
  expect(body.data.iam).toBeDefined()
  expect(body.data.system).toBeDefined()
})
```

**Run sparingly.** These tests require all services to be running. Reserve for CI or manual
verification, not `test:watch`.

#### Layer 4: Event-Driven (Kafka / Conductor)

**Scope:** Async message flow across services.
**Tool:** Kafka producer/consumer with Redpanda test instance.
**Speed:** ~1-5s per test (message delivery latency).
**Use for:** Command/event flow, CDC pipeline integrity, workflow orchestration.

```typescript
// Layer 4: Event-driven integration
it('chat command triggers workflow and produces events', async () => {
  await producer.send({
    topic: TOPICS.AGENT_CHAT_COMMANDS,
    messages: [{ key: 'conv-1', value: encode({ type: 'chat.start', ... }) }],
  })

  // Wait for response event
  const events = await consumeMessages(TOPICS.AGENT_CHAT_EVENTS, { timeout: 5000 })
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'chat.workflow.started' })
  )
})
```

**Most expensive layer.** Use only for critical async flows. Prefer contract tests (BCP:
`testing.contract`) for message shape validation.

### Layer Selection Guide

| Bug Class | Layer | Example |
|---|---|---|
| Wrong SQL query | 1 (In-Process) | Search returns wrong records |
| Missing DB constraint | 2 (Database) | Duplicate entries allowed |
| Federation type mismatch | 3 (Cross-Service) | `__resolveReference` returns null |
| Event shape mismatch | 4 (Event) + Contract | Consumer can't parse producer's event |
| Missing auth on endpoint | 1 (In-Process) | 401 not returned for protected query |
| Resolver wiring bug | 1 (In-Process) | GraphQL field returns null |
| Migration breaks existing data | 2 (Database) | ALTER COLUMN drops values |
| Gateway composition error | 3 (Cross-Service) | Subgraph types conflict |

### Test Organization by Layer

```
services/<service>/src/
  app.test.ts                         # Layer 1: Core queries, mutations, health
  __qa__/
    seed-invariants.test.ts           # Layer 1+2: Seed data + constraint checks
    *-attacks.test.ts                 # Layer 1: Adversarial input probing
    cross-entity-invariants.test.ts   # Layer 2: FK integrity, cross-table checks
  __contracts__/
    <other-service>.contract.ts       # Schema + behavioral contracts (consumer side)

# Gateway-level tests (Layer 3) — in the gateway service
services/gateway/src/
  federation.test.ts                  # Layer 3: Cross-subgraph queries
  composition.test.ts                 # Layer 3: Schema composition validation

# Event tests (Layer 4) — in the consuming service
services/orchestration/src/
  kafka-bridge.test.ts                # Layer 4: Message flow tests
```

## CI Configuration

```yaml
# Fast (every PR): Layers 1 + 2
unit-and-integration:
  steps:
    - pnpm test  # Runs all Layer 1+2 tests via Turborepo

# Moderate (merge to main): Layer 3
federation:
  services: [postgres, gateway, iam, system, agents, practices]
  steps:
    - pnpm --filter gateway test:federation

# Slow (nightly): Layer 4
event-integration:
  services: [postgres, redpanda, conductor, all-services]
  steps:
    - pnpm test:events
```

## Anti-Patterns

- **Layer 3 tests for Layer 1 bugs** — Don't start the gateway to test a single service's query logic.
- **No Layer 2 tests** — Database constraints are your safety net. Test them explicitly.
- **Layer 4 tests for shape validation** — Use contract tests for message schemas; reserve Layer 4 for flow tests.
- **Mixing layers in one test file** — Keep each test file at one layer for clear execution requirements.

## References

- Context: `project/topics/testing.md`, `project/topics/infrastructure.md`
- Related BCP: `testing.unit-boundaries`, `testing.contract`, `testing.adversarial`
