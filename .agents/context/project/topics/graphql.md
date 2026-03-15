# Topic: GraphQL — Aegir Project

## Stack

- **Gateway**: Mercurius federation on Fastify (:4000)
- **Subgraphs**: IAM (:4001), System (:4002), Agents (:4003)
- **Framework**: Moribashi — enforces namespace-nesting and service conventions

## Moribashi Naming

All GraphQL types are namespace-prefixed by service domain:
- IAM: `IamIdentity`, `IamOrganization`, `IamIdentities`, `IamOrganizations`
- System: `SystemTenant`, `SystemIntegration`, `SystemTenantIntegration`
- Agents: `AgentsConversation`, `AgentsMessage`

Plurals for query types (list returns), singulars for entities.

## Service Class Pattern

Each entity has a `*.svc.ts` file:
- Default-exported PascalCase class
- Constructor DI (dependencies injected via constructor)
- Methods: `findAll(filter?)`, `findById(id)`, `create(input)`, `update(id, input)`, `delete(id)`

## Federation

- Each subgraph defines its types independently
- Gateway composes at runtime — no shared schema file
- `@key(fields: "id")` on entity types
- `__resolveReference` for cross-subgraph hydration

## Known Issues

- DI naming bug: `tenant-integrations` should be `tenantIntegrations`
- No input validation beyond GraphQL type system (min-length, pattern escaping missing)
- message.role has case mismatch between GraphQL String and DB CHECK constraint
