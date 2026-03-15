# Project Context: Domain Model

## Root Entities

| Entity              | Service | Schema   | Status      |
|---------------------|---------|----------|-------------|
| Identity            | iam     | iam      | Implemented |
| Organization        | iam     | iam      | Implemented |
| Tenant              | system  | system   | Implemented |
| Integration         | system  | system   | Implemented |
| TenantIntegration   | system  | system   | Implemented |
| AgentsConversation  | agents  | agents   | Implemented |
| AgentsMessage       | agents  | agents   | Implemented |

## Key Relationships

- Identity ↔ Organization: many-to-many via Keycloak memberships
- Organization → Tenant: FK (org_id on tenant)
- Tenant → Integration: many-to-many via TenantIntegration
- Conversation → Organization: scoped by org_id

## Active Constraints

- Schema-per-service isolation (each service owns its Postgres schema)
- Multi-tenancy scoped via Keycloak organizations
- All GraphQL types namespace-prefixed per Moribashi conventions

## Known Issues (from 2026-03-13 audit)

- No UNIQUE on identity.email
- Empty string keys/names accepted (missing min-length)
- conversation.organization_id has no FK constraint
- integration.metadata is TEXT not JSONB
- See `docs/design/domain-model-audit.md` for full list
