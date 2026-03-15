# Topic: GraphQL (System)

> General GraphQL best practices for federated architectures.
> Project-specific conventions are in `project/topics/graphql.md`.

## Federation Fundamentals

- Each subgraph owns its types and resolvers independently
- The gateway composes subgraphs at runtime — no shared schema file
- `@key(fields: "id")` marks an entity as resolvable across subgraphs
- `__resolveReference` is called by the gateway to hydrate foreign references
- `extend type` is used to add fields to types owned by other subgraphs

## Schema Design

- Input types for mutations and filtered queries (not raw scalars)
- Non-null (`!`) by default; nullable only when the field is genuinely optional
- Use enums for closed sets; avoid string-typing status/role fields
- Pagination: prefer cursor-based for lists; offset is acceptable for admin UIs

## Resolver Patterns

- Resolvers should be thin — delegate to service classes for business logic
- N+1 prevention: use DataLoader or batch-query patterns
- Error handling: throw typed errors; let the framework serialize them

## Security

- Disable introspection in production
- Enforce query depth and complexity limits at the gateway
- Validate all input types; GraphQL's type system is necessary but not sufficient
- Subscription auth must be checked at connection time, not just at subscribe
