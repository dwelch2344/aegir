# BCP: testing.contract

> Consumer-driven contract testing for cross-service safety.

**ID:** `testing.contract`
**Version:** 0.1.0
**Category:** Testing
**Status:** Active

---

## Problem

In a federated GraphQL architecture with multiple subgraphs, a change in one service can
silently break consumers in another. Traditional integration tests catch this only if all
services are running together — which is slow, flaky, and couples deployment pipelines.
Without contract tests, breaking changes are discovered in staging or production.

## Best Current Practice

### Consumer-Driven Contracts

The service that **consumes** a type or field defines the contract. The service that
**provides** it must satisfy the contract. This inverts the typical "provider publishes a
schema" model.

**Why consumer-driven:** Providers don't know which fields consumers actually use. A provider
might think removing a deprecated field is safe, but a consumer still depends on it. Consumer
contracts make these dependencies explicit.

### Contract Scope: GraphQL Federation Boundaries

In a federated graph, contracts exist at two levels:

1. **Schema contracts** — The SDL types, fields, and arguments that other subgraphs reference
   via `@key`, `@requires`, or `@external` directives.
2. **Behavioral contracts** — The expected response shapes and semantics when a field is
   resolved (e.g., "search with empty input returns all records").

### Schema Contract Testing

Use schema diffing to detect breaking changes before merge:

```typescript
describe('Schema Contract: IAM subgraph', () => {
  it('exposes Identity type with required fields for federation', async () => {
    const sdl = await getSubgraphSDL('iam')

    // These fields are referenced by other subgraphs
    expect(sdl).toContain('type Identity @key(fields: "id")')
    expect(sdl).toContain('id: Int!')
    expect(sdl).toContain('type: IdentityType!')
    expect(sdl).toContain('organizationId: Int!')
  })

  it('exposes Organization type with required fields for federation', async () => {
    const sdl = await getSubgraphSDL('iam')

    expect(sdl).toContain('type Organization @key(fields: "id")')
    expect(sdl).toContain('id: Int!')
    expect(sdl).toContain('key: String!')
  })
})
```

### Behavioral Contract Testing

Test the behaviors that consumers depend on, not just the schema:

```typescript
describe('Behavioral Contract: IAM provides identity lookup', () => {
  it('resolves identity by ID via federation reference', async () => {
    // This is what the gateway does when another subgraph references an Identity
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{
          _entities(representations: [{ __typename: "Identity", id: 1 }]) {
            ... on Identity { id label email }
          }
        }`,
      },
    })
    expect(response.json().data._entities[0]).toMatchObject({
      id: 1,
      label: expect.any(String),
    })
  })
})
```

### Contract Ownership Rules

| Role | Responsibility |
|---|---|
| **Consumer** | Defines which fields/behaviors they depend on. Writes consumer contract tests. |
| **Provider** | Runs consumer contracts in their CI. Must not break them without coordination. |
| **Gateway** | Validates schema composition. Catches type conflicts and missing fields. |

### Where Contracts Live

Contracts are co-located with the consumer, not the provider:

```
services/agents/src/
  __contracts__/
    iam-identity.contract.ts    # "I depend on IAM Identity having id, label, email"
    system-tenant.contract.ts   # "I depend on System Tenant having id, key"
```

The provider's CI runs **all consumer contracts** against its subgraph as part of the test
suite. This is achieved by importing contract test definitions from a shared package or
by running them via a contract test runner.

### Breaking Change Protocol

When a provider needs to make a breaking change:

1. **Find all consumer contracts** that reference the affected field/type.
2. **Coordinate with consumers** to update their code and contracts.
3. **Deprecate first** — add `@deprecated(reason: "...")` for at least one release cycle.
4. **Remove only after** all consumer contracts have been updated.

## Event Contracts

For Kafka/event-based communication, contracts cover message shapes:

```typescript
describe('Event Contract: agents.chat.events', () => {
  it('ChatStreamChunkEvent has required fields', () => {
    const event: ChatStreamChunkEvent = {
      type: 'chat.stream.chunk',
      conversationId: 'test',
      text: 'hello',
      done: false,
      timestamp: new Date().toISOString(),
    }
    // Validate against schema
    expect(() => ChatStreamChunkSchema.parse(event)).not.toThrow()
  })
})
```

**Event versioning strategy:**
- Use JSON Schema or Zod schemas for event validation.
- Version event schemas with the topic (e.g., `agents.chat.events.v2`).
- Consumers must be able to handle both old and new versions during migration.

## Anti-Patterns

- **Provider-only schema testing** — The provider doesn't know what consumers use.
- **Full-stack integration instead of contracts** — Too slow, too flaky, too coupled.
- **Snapshot-based schema tests** — Brittle. Additive changes (new fields) shouldn't fail.
- **Ignoring event contracts** — Events are implicit APIs. Treat them with the same rigor.

## Manifest Tracking

Ships should declare their contract relationships in the manifest:

```yaml
contracts:
  provides:
    - type: graphql
      subgraph: practices
      types: [PracticesContextFile, PracticesBcpEntry, PracticesCatalogEntry]
  consumes:
    - type: graphql
      subgraph: iam
      types: [Identity, Organization]
      contract_file: src/__contracts__/iam.contract.ts
```

## References

- Context: `topics/graphql.md` (federation), `topics/kafka.md` (events)
- Related BCP: `testing.unit-boundaries`, `testing.integration-layers`
- QA Strategy: `docs/design/qa-devex-strategy.md`
