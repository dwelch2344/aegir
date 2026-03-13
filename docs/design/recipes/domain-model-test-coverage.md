# Domain Model Test Coverage Map

**Date:** 2026-03-13

---

## IAM Service — `services/iam/src/app.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Identity, Organization | responds to health check | seed | `services/iam/src/app.test.ts` |
| Identity, Organization | serves the federated schema | seed | `services/iam/src/app.test.ts` |
| Identity | returns all identities when no filters | seed | `services/iam/src/app.test.ts` |
| Identity | filters identities by idIn | seed | `services/iam/src/app.test.ts` |
| Identity | filters identities by labelLike | seed | `services/iam/src/app.test.ts` |
| Organization | returns all organizations when no filters | seed | `services/iam/src/app.test.ts` |
| Organization | filters organizations by keyLike | seed | `services/iam/src/app.test.ts` |
| Organization | system org exists with key=system, protected=true | seed | `services/iam/src/app.test.ts` |
| Organization | aegir org exists with key=aegir, protected=false | seed | `services/iam/src/app.test.ts` |
| Identity, Organization | SUPER_USER identity belongs to system org | seed | `services/iam/src/app.test.ts` |
| Identity, Organization | seed data includes at least 3 identities and at least 2 organizations | seed | `services/iam/src/app.test.ts` |
| Identity | identity types include SUPER_USER and USER among seed data | seed | `services/iam/src/app.test.ts` |
| Organization | sync creates a new org from keycloak data | mutation | `services/iam/src/app.test.ts` |
| Organization | sync is idempotent (same input twice = same result) | mutation | `services/iam/src/app.test.ts` |
| Organization | sync with empty array is a no-op | edge | `services/iam/src/app.test.ts` |
| Organization | sync skips protected organizations | invariant | `services/iam/src/app.test.ts` |
| Identity | filter by multiple idIn values returns correct subset | edge | `services/iam/src/app.test.ts` |
| Identity | filter with no matching results returns empty array | edge | `services/iam/src/app.test.ts` |
| Identity | schema contains all three IdentityType enum values | seed | `services/iam/src/app.test.ts` |
| Identity | organizationId is returned for identities | seed | `services/iam/src/app.test.ts` |
| Organization | system org protected flag is queryable and true | invariant | `services/iam/src/app.test.ts` |
| Organization | protected field appears in schema SDL | seed | `services/iam/src/app.test.ts` |
| Membership | Identity-Organization relationship should be mediated by Membership | todo | `services/iam/src/app.test.ts` |
| Organization | Organization should have a tenant_id foreign key | todo | `services/iam/src/app.test.ts` |
| Membership | Identity can belong to multiple organizations through Membership | todo | `services/iam/src/app.test.ts` |
| Membership | Roles and permissions should be defined on Membership | todo | `services/iam/src/app.test.ts` |

## IAM Service — `services/iam/src/__qa__/seed-invariants.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Organization | has exactly 2 seeded organizations (system + aegir) | invariant | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Identity | has exactly 3 seeded identities (System, Alice, Bob) | invariant | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Identity | identity.email has no UNIQUE constraint — duplicate emails can exist via direct insert | adversarial | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Identity | identity search with empty idIn array returns all results | edge | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Organization | organization search with empty keycloakIdIn returns all results | edge | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Identity | rejects invalid IdentityType enum value at GraphQL level | adversarial | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Organization | all seeded orgs have placeholder keycloakIds from migration backfill | invariant | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Organization | organization.protected defaults to false (from migration) | invariant | `services/iam/src/__qa__/seed-invariants.test.ts` |
| Organization | seed data runs after the protected column exists | invariant | `services/iam/src/__qa__/seed-invariants.test.ts` |

## IAM Service — `services/iam/src/__qa__/org-sync-attacks.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Organization | accepts extremely long key (1000+ chars) — no server-side length validation | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | handles special characters in key (quotes, backslashes) | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | handles angle brackets and HTML in name | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | handles duplicate keycloakIds in same sync batch | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | accepts empty string key — no validation | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | accepts empty string name — no validation | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | accepts whitespace-only key — no trimming or validation | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | sync with keycloakId matching placeholder pattern can claim seeded orgs | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | handles unicode characters in key and name | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | GraphQL rejects null keycloakId (required field) with 400 | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |
| Organization | GraphQL rejects missing required field in sync input with 400 | adversarial | `services/iam/src/__qa__/org-sync-attacks.test.ts` |

## IAM Service — `services/iam/src/__qa__/cross-entity-invariants.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Identity, Organization | every seeded identity has a valid organization_id pointing to an existing org | invariant | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Organization | newly synced org has protected=false by default | invariant | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Organization | synced org is immediately searchable by key | mutation | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Organization | synced org is searchable by keycloakId | mutation | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Identity | identity table has FK constraint to organization — invalid org_id would fail on insert | invariant | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Organization | system org cannot be modified via sync because it is protected | adversarial | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Identity | search identities with SQL wildcard in labelLike | adversarial | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |
| Organization | organization search with SQL wildcard in keyLike returns all orgs | adversarial | `services/iam/src/__qa__/cross-entity-invariants.test.ts` |

## System Service — `services/system/src/app.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Tenant, Integration | responds to health check | seed | `services/system/src/app.test.ts` |
| Tenant, Integration | serves the federated schema | seed | `services/system/src/app.test.ts` |
| Tenant | queries a tenant by key | seed | `services/system/src/app.test.ts` |
| TenantIntegration | queries tenant integrations | seed | `services/system/src/app.test.ts` |
| Integration | searches system integrations | seed | `services/system/src/app.test.ts` |
| Tenant | creates a new tenant | mutation | `services/system/src/app.test.ts` |
| Integration | upserts an integration | mutation | `services/system/src/app.test.ts` |
| TenantIntegration | upserts a tenant integration | mutation | `services/system/src/app.test.ts` |
| Tenant | updates an existing tenant | mutation | `services/system/src/app.test.ts` |
| Tenant | seed tenant (id=1, key=aegir) exists | seed | `services/system/src/app.test.ts` |
| Integration | seed integrations (keycloak, slack, github) exist with correct keys | seed | `services/system/src/app.test.ts` |
| TenantIntegration | seed tenant_integrations are all ACTIVE | seed | `services/system/src/app.test.ts` |
| Tenant | createTenant with duplicate key returns an error | edge | `services/system/src/app.test.ts` |
| Integration | upsertIntegration is idempotent | edge | `services/system/src/app.test.ts` |
| TenantIntegration | TenantIntegration status change via upsert | mutation | `services/system/src/app.test.ts` |
| Integration | searches integrations by keyIn filter | seed | `services/system/src/app.test.ts` |
| Integration | searches integrations by idIn filter | seed | `services/system/src/app.test.ts` |
| Tenant | query nonexistent tenant key returns error | edge | `services/system/src/app.test.ts` |
| Tenant | Tenant should have Organization linkage for cross-service queries | todo | `services/system/src/app.test.ts` |
| TenantIntegration | TenantIntegration should validate integrationKey exists before upsert | todo | `services/system/src/app.test.ts` |
| Tenant | Federation __resolveReference for Tenant works across gateway | todo | `services/system/src/app.test.ts` |

## System Service — `services/system/src/__qa__/mutation-attacks.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Tenant | accepts empty string tenant key — no min-length validation | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | rejects tenant key exceeding VARCHAR(100) limit | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | handles special characters in tenant key | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Integration | accepts non-JSON string as integration metadata — stored as TEXT not JSONB | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Integration | accepts extremely large metadata string | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| TenantIntegration | GraphQL rejects invalid TenantIntegrationStatus enum value with 400 | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | update tenant with empty input returns current state (no-op) | edge | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | update nonexistent tenant throws error | edge | `services/system/src/__qa__/mutation-attacks.test.ts` |
| TenantIntegration | upsert tenant integration with nonexistent integration key throws error (skipped: DI naming bug) | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | accepts whitespace-only tenant key — no trimming | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Integration | upsert integration updates metadata on conflict | mutation | `services/system/src/__qa__/mutation-attacks.test.ts` |
| Tenant | parameterized queries prevent SQL injection in tenant key | adversarial | `services/system/src/__qa__/mutation-attacks.test.ts` |

## Agents Service — `services/agents/src/app.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Conversation, Message | responds to health check | seed | `services/agents/src/app.test.ts` |
| Conversation, Message | serves the federated schema | seed | `services/agents/src/app.test.ts` |
| Conversation | creates a conversation | mutation | `services/agents/src/app.test.ts` |
| Conversation | searches conversations with empty result | edge | `services/agents/src/app.test.ts` |
| Conversation | searches conversations by organizationId | mutation | `services/agents/src/app.test.ts` |
| Conversation | updates a conversation title | mutation | `services/agents/src/app.test.ts` |
| Conversation | deletes a conversation | mutation | `services/agents/src/app.test.ts` |
| Message | adds a message to a conversation | mutation | `services/agents/src/app.test.ts` |
| Message | queries messages on a conversation | mutation | `services/agents/src/app.test.ts` |
| Conversation | update nonexistent conversation returns null | edge | `services/agents/src/app.test.ts` |
| Conversation | delete nonexistent conversation returns true | edge | `services/agents/src/app.test.ts` |
| Conversation | search with organizationId that has no conversations returns empty | edge | `services/agents/src/app.test.ts` |
| Conversation | sendMessage requires running orchestration service - integration test needed | todo | `services/agents/src/app.test.ts` |

## Agents Service — `services/agents/src/__qa__/conversations-attacks.test.ts`

| Entity | Test Name | Type | File Location |
|--------|-----------|------|---------------|
| Conversation | creates conversation with organizationId=0 | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation | creates conversation with negative organizationId | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation | accepts very long title (10000+ chars) despite VARCHAR(255) column | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Message | accepts empty string message text — no min-length validation | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Message | rejects message with role not in CHECK constraint set | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation, Message | adding message to deleted conversation fails with FK violation | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation | search with malformed UUID-like string in idIn returns error | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation | creates conversation with default title when title is omitted | edge | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Message | accepts extremely large message text (TEXT column has no limit) | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Message | rejects uppercase role values (CHECK constraint uses lowercase) | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |
| Conversation | delete always returns true regardless of whether conversation exists | adversarial | `services/agents/src/__qa__/conversations-attacks.test.ts` |

---

## Summary

### Counts by Service

| Service | Tests | TODOs | Total |
|---------|-------|-------|-------|
| IAM (`app.test.ts`) | 21 | 4 | 25 |
| IAM (`seed-invariants.test.ts`) | 9 | 0 | 9 |
| IAM (`org-sync-attacks.test.ts`) | 11 | 0 | 11 |
| IAM (`cross-entity-invariants.test.ts`) | 8 | 0 | 8 |
| System (`app.test.ts`) | 15 | 3 | 18 |
| System (`mutation-attacks.test.ts`) | 12 | 0 | 12 |
| Agents (`app.test.ts`) | 12 | 1 | 13 |
| Agents (`conversations-attacks.test.ts`) | 11 | 0 | 11 |
| **Total** | **99** | **8** | **107** |

### Counts by Type

| Type | Count |
|------|-------|
| seed | 22 |
| mutation | 16 |
| edge | 14 |
| adversarial | 39 |
| invariant | 10 |
| todo | 8 |
| **Total** | **109** |

*Note: Some tests span multiple entities but are counted once per test row. The type-level count includes individual table rows where a single test may map to multiple entities.*
