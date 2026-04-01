# Domain Model Audit

**Date:** 2026-04-01 (updated), originally 2026-03-13
**Scope:** All five federated root entities defined in the foundational domain model

---

## Entity Audit

### 1. Identity

**Service:** IAM (`services/iam`)
**DB Table:** `identity`

#### Field Comparison

| Field            | Documented | Domain Type (`identity.ts`) | DB Column          | GraphQL Field    | Status    |
| ---------------- | ---------- | --------------------------- | ------------------ | ---------------- | --------- |
| id               | Yes        | `number`                    | `SERIAL PK`        | `Int!`           | Aligned   |
| type             | Yes        | `IdentityType` (union)      | `VARCHAR(50) NOT NULL DEFAULT 'USER'` | `IdentityType!` (enum) | Aligned |
| label            | Yes        | `string`                    | `VARCHAR(255) NOT NULL` | `String!`    | Aligned   |
| email            | Yes        | `string`                    | `VARCHAR(255) NOT NULL` | `String!`    | Aligned   |
| organizationId   | Yes        | `number?` (optional)        | `INTEGER REFERENCES organization(id)` | `Int` (nullable) | Aligned |
| created_at       | No         | Not modeled                 | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |
| updated_at       | No         | Not modeled                 | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |

#### Database Constraints

| Constraint                | Exists | Notes                                                        |
| ------------------------- | ------ | ------------------------------------------------------------ |
| Primary Key (id)          | Yes    | SERIAL                                                       |
| FK (organization_id)      | Yes    | References `organization(id)`                                |
| NOT NULL (type)           | Yes    | Default `'USER'`                                             |
| NOT NULL (label)          | Yes    |                                                              |
| NOT NULL (email)          | Yes    |                                                              |
| UNIQUE (email)            | Yes    | Added in V1.0.0 baseline                                     |
| CHECK (type enum)         | Yes    | `CHECK (type IN ('USER', 'SUPER_USER', 'SERVICE_ACCOUNT'))` — added in V1.0.0 baseline |
| Index (email)             | Yes    | `idx_identity_email`                                         |
| Index (organization_id)   | Yes    | `idx_identity_organization_id`                               |

#### GraphQL Coverage

| Operation                         | Available | Notes                                     |
| --------------------------------- | --------- | ----------------------------------------- |
| Query: search by idIn             | Yes       | Via `iam.identities.search`               |
| Query: search by labelLike        | Yes       | Via `iam.identities.search`               |
| Mutation: create identity         | **No**    | `IamIdentitiesOps` has only `_placeholder`|
| Mutation: update identity         | **No**    |                                           |
| Mutation: delete identity         | **No**    |                                           |

#### Test Coverage

- Search all identities: covered
- Filter by `idIn` (single and multiple): covered
- Filter by `labelLike`: covered
- Filter with no matches (empty result): covered
- Seed data validation (SUPER_USER, type enum values): covered
- `organizationId` field returned correctly: covered
- **Gaps:** No mutation tests (mutations not yet implemented). No edge cases for email uniqueness or type validation.

#### Status: **Partially Implemented**

Search/query is functional. No create/update/delete mutations exist for Identity.

---

### 2. Organization

**Service:** IAM (`services/iam`)
**DB Table:** `organization`

#### Field Comparison

| Field       | Documented | Domain Type (`organization.ts`) | DB Column                  | GraphQL Field | Status    |
| ----------- | ---------- | ------------------------------- | -------------------------- | ------------- | --------- |
| id          | Yes        | `number`                        | `SERIAL PK`               | `Int!`        | Aligned   |
| key         | Yes        | `string`                        | `VARCHAR(100) NOT NULL UNIQUE` | `String!` | Aligned   |
| name        | Yes        | `string`                        | `VARCHAR(255) NOT NULL`    | `String!`     | Aligned   |
| keycloakId  | Not in doc | `string?` (optional)            | `VARCHAR(255) UNIQUE`            | `String` | Implementation-only |
| protected   | Yes        | `boolean`                       | `BOOLEAN NOT NULL DEFAULT false`  | `Boolean!` | Aligned |
| created_at  | No         | Not modeled                     | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |
| updated_at  | No         | Not modeled                     | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |

#### Database Constraints

| Constraint                | Exists | Notes                                      |
| ------------------------- | ------ | ------------------------------------------ |
| Primary Key (id)          | Yes    | SERIAL                                     |
| UNIQUE (key)              | Yes    |                                            |
| UNIQUE (keycloak_id)      | Yes    |                                            |
| NOT NULL (key)            | Yes    |                                            |
| NOT NULL (name)           | Yes    |                                            |
| NOT NULL (protected)      | Yes    | Default `false`                            |
| CHECK (key format/length) | **No** | No validation on key format at DB level    |
| FK (tenant_id)            | **No** | Design says Organization belongs to Tenant — no FK exists |

#### GraphQL Coverage

| Operation                         | Available | Notes                                     |
| --------------------------------- | --------- | ----------------------------------------- |
| Query: search by idIn             | Yes       | Via `iam.orgs.search`                     |
| Query: search by keycloakIdIn     | Yes       | Via `iam.orgs.search`                     |
| Query: search by keyLike          | Yes       | Via `iam.orgs.search`                     |
| Query: search by nameLike         | Yes       | Via `iam.orgs.search`                     |
| Mutation: sync (from Keycloak)    | Yes       | `iam.orgs.sync` — upsert by keycloakId/key, skips protected |
| Mutation: create organization     | **No**    | Only sync path exists                     |
| Mutation: update organization     | **No**    |                                           |
| Mutation: delete organization     | **No**    |                                           |

#### Test Coverage

- Search all organizations: covered
- Filter by `idIn`, `keyLike`: covered
- Seed validation (system org protected): covered
- Sync mutation (create, idempotency, empty array, skip protected): covered
- Protected flag queryable: covered
- **Gaps:** No direct CRUD mutations. No tests for `nameLike` or `keycloakIdIn` search filters.

#### Status: **Partially Implemented**

Search and sync are functional. Missing standalone CRUD mutations and tenant_id FK.

---

### 3. Tenant

**Service:** System (`services/system`)
**DB Table:** `tenant`

#### Field Comparison

| Field      | Documented | Domain Type (`tenant.ts`) | DB Column                      | GraphQL Field | Status  |
| ---------- | ---------- | ------------------------- | ------------------------------ | ------------- | ------- |
| id         | Yes        | `number`                  | `SERIAL PK`                   | `ID!`         | Aligned (type mismatch: `number` vs `ID!`) |
| key        | Yes        | `string`                  | `VARCHAR(100) NOT NULL UNIQUE` | `String!`     | Aligned |
| name       | Yes        | `string`                  | `VARCHAR(255) NOT NULL`        | `String!`     | Aligned |
| created_at | No         | Not modeled               | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |
| updated_at | No         | Not modeled               | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |

#### Database Constraints

| Constraint       | Exists | Notes         |
| ---------------- | ------ | ------------- |
| Primary Key (id) | Yes    | SERIAL        |
| UNIQUE (key)     | Yes    |               |
| NOT NULL (key)   | Yes    |               |
| NOT NULL (name)  | Yes    |               |

#### GraphQL Coverage

| Operation                  | Available | Notes                                |
| -------------------------- | --------- | ------------------------------------ |
| Query: tenant by key       | Yes       | `tenant(key: String!)`               |
| Query: list tenants        | **No**    | No search/list operation             |
| Mutation: createTenant     | Yes       | `system.createTenant`                |
| Mutation: updateTenant     | Yes       | `system.updateTenant`                |
| Mutation: deleteTenant     | **No**    |                                      |
| Nested: integrations       | Yes       | `tenant.integrations` returns `[TenantIntegration!]!` |

#### Test Coverage

- Query tenant by key: covered
- Query tenant integrations: covered
- Create tenant: covered
- Update tenant: covered
- **Gaps:** No delete test (mutation not implemented). No list/search tenants test (query not implemented).

#### Status: **Fully Implemented** (for current scope)

Core CRUD (minus delete) is present. Querying and nested integration access works.

---

### 4. Integration (SystemIntegration)

**Service:** System (`services/system`)
**DB Table:** `integration`

#### Field Comparison

| Field    | Documented      | Domain Type (`integration.ts`) | DB Column                      | GraphQL Field | Status  |
| -------- | --------------- | ------------------------------ | ------------------------------ | ------------- | ------- |
| id       | Yes             | `number`                       | `SERIAL PK`                   | `Int!`        | Aligned |
| key      | Yes             | `string`                       | `VARCHAR(100) NOT NULL UNIQUE` | `String!`     | Aligned |
| name     | Yes             | `string`                       | `VARCHAR(255) NOT NULL`        | `String!`     | Aligned |
| metadata | Not in doc      | `string`                       | `TEXT NOT NULL DEFAULT '{}'`   | `String!`     | Aligned (but see data integrity note) |
| created_at | No            | Not modeled                    | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |
| updated_at | No            | Not modeled                    | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |

**Note:** Domain type is named `SystemIntegration`, while DB table is `integration` and design document uses `Integration`. Naming divergence.

#### Database Constraints

| Constraint       | Exists | Notes              |
| ---------------- | ------ | ------------------ |
| Primary Key (id) | Yes    | SERIAL             |
| UNIQUE (key)     | Yes    |                    |
| NOT NULL (key)   | Yes    |                    |
| NOT NULL (name)  | Yes    |                    |
| NOT NULL (metadata) | Yes | Default `'{}'`     |

#### GraphQL Coverage

| Operation                       | Available | Notes                              |
| ------------------------------- | --------- | ---------------------------------- |
| Query: search by idIn           | Yes       | `system.integrations.search`       |
| Query: search by keyIn          | Yes       | `system.integrations.search`       |
| Mutation: upsertIntegration     | Yes       | `system.upsertIntegration`         |
| Mutation: deleteIntegration     | **No**    |                                    |

#### Test Coverage

- Search all integrations: covered
- Upsert integration: covered
- **Gaps:** No delete test. No search filter tests (by `idIn` or `keyIn` specifically).

#### Status: **Fully Implemented** (for current scope)

---

### 5. TenantIntegration

**Service:** System (`services/system`)
**DB Table:** `tenant_integration`

#### Field Comparison

| Field          | Documented       | Domain Type (`tenant-integration.ts`) | DB Column                     | GraphQL Field | Status  |
| -------------- | ---------------- | ------------------------------------- | ----------------------------- | ------------- | ------- |
| tenantId       | Yes              | `number`                              | `INTEGER NOT NULL FK`         | Not directly exposed | Implicit via `tenant` query |
| integrationId  | Yes              | `number`                              | `INTEGER NOT NULL FK`         | Not directly exposed | Via nested `integration` |
| integrationKey | Not in doc       | `string`                              | Not in DB (derived)           | `String!`     | Implementation-only |
| status         | Yes              | `TenantIntegrationStatus` (union)     | `VARCHAR(20) NOT NULL DEFAULT 'PENDING'` | `TenantIntegrationStatus!` | Aligned |
| name           | Not in doc       | `string`                              | `VARCHAR(255) NOT NULL`       | `String!`     | Implementation-only |
| metadata       | Yes (implied)    | `string`                              | `TEXT NOT NULL DEFAULT '{}'`  | `String!`     | Aligned |
| ordinal        | Not in doc       | `number | null`                       | `INTEGER` (nullable)          | `Int`         | Implementation-only |
| created_at     | No               | Not modeled                           | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |
| updated_at     | No               | Not modeled                           | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Not exposed | DB-only |

#### Database Constraints

| Constraint                          | Exists | Notes                                   |
| ----------------------------------- | ------ | --------------------------------------- |
| Composite PK (tenant_id, integration_id) | Yes | Enforces one integration per tenant     |
| FK (tenant_id → tenant.id)          | Yes    |                                         |
| FK (integration_id → integration.id)| Yes    |                                         |
| NOT NULL (status)                   | Yes    | Default `'PENDING'`                     |
| NOT NULL (name)                     | Yes    |                                         |
| NOT NULL (metadata)                 | Yes    | Default `'{}'`                          |
| CHECK (status enum)                 | **No** | No DB-level enforcement of status values|
| Index (tenant_id)                   | Yes    | `idx_tenant_integration_tenant`         |
| Index (status)                      | Yes    | `idx_tenant_integration_status`         |

#### GraphQL Coverage

| Operation                              | Available | Notes                                |
| -------------------------------------- | --------- | ------------------------------------ |
| Query: via tenant.integrations         | Yes       | Nested under `tenant(key)` query     |
| Mutation: upsert                       | Yes       | `tenant(key).integrations.upsert`    |
| Mutation: delete                       | **No**    |                                      |

#### Test Coverage

- Query integrations via tenant: covered
- Upsert tenant integration: covered
- **Gaps:** No delete test. No status transition tests. No error handling tests.

#### Status: **Fully Implemented** (for current scope)

---

## Previously Missing Entities (Now Implemented)

### Membership

**Design status:** Documented in domain model as the mediating entity between Identity and Organization.

**Implementation status:** Implemented in V1.0.0 baseline. The `membership` table mediates Identity-Organization relationships, allowing an identity to belong to multiple organizations. The `membership_role` join table assigns roles to each membership. The legacy `identity.organization_id` FK still exists but the canonical relationship is now via Membership.

**Keycloak note:** Organization membership is partially externalized to Keycloak (evidenced by the `keycloak_id` column on organization and the sync mutation). The boundary between Keycloak-managed membership and platform-managed membership needs clarification.

### Role / Permissions (ReBAC)

**Design status:** Fully documented in the domain model with a relationship-based access control (ReBAC) model including OrgRelationship, Role, RolePermission, and Membership.

**Implementation status:** Implemented in V1.0.0 baseline. DB tables `role`, `role_permission`, `org_relationship`, `membership`, and `membership_role` all exist. Three default roles are seeded: Owner (full SELF + SYS_CHILD permissions), Admin (org management SELF permissions), and Member (read-only SELF permissions). The System org has a SELF relationship; child orgs receive a SYS_CHILD relationship to enable system-wide administration. The first user to log in is auto-bootstrapped as Owner of the System org.

---

## Cross-Entity Relationships

| Relationship                      | Design                                      | Implementation                            | Status |
| --------------------------------- | ------------------------------------------- | ----------------------------------------- | ------ |
| Tenant → Organization (1:many)    | Every Organization exists within a Tenant   | **No FK exists** — Organization table has no `tenant_id` column. Services are separate (IAM vs System) which creates a cross-service boundary. | Gap |
| Identity → Organization           | Mediated by Membership (many-to-many)       | **Membership table implemented** — `membership(identity_id, organization_id)` with unique constraint. Legacy `identity.organization_id` FK still exists. | Aligned (with legacy column) |
| Organization → Membership         | One Organization has many Memberships       | **Implemented** — `membership` table with FK to `organization(id)`, indexed by `organization_id` | Aligned |
| TenantIntegration → Tenant        | Each TenantIntegration belongs to one Tenant| **Properly enforced** — FK `tenant_id → tenant(id)` with composite PK | Aligned |
| TenantIntegration → Integration   | Each TenantIntegration references one Integration | **Properly enforced** — FK `integration_id → integration(id)` with composite PK | Aligned |

### Cross-Service Boundary Note

The Tenant-Organization relationship spans service boundaries (Tenant in `system` service, Organization in `iam` service). This is an intentional federation boundary but means the relationship cannot be enforced at the DB level. It will need to be enforced at the application/gateway level or via eventual consistency mechanisms.

The `it.todo('Organization should have a tenant_id foreign key')` test stub suggests this is a recognized future requirement.

---

## Data Integrity Gaps

### 1. ~~identity.email — No UNIQUE Constraint~~ RESOLVED

The `email` column now has a UNIQUE constraint (added in V1.0.0 baseline).

### 2. metadata Columns Use TEXT Instead of JSONB

Both `integration.metadata` and `tenant_integration.metadata` columns use `TEXT` with a default of `'{}'`. This provides no structural validation of the JSON content. Using `JSONB` would:
- Validate JSON structure on insert/update
- Enable JSON-specific query operators
- Provide more efficient storage and indexing

### 3. ~~No CHECK Constraint on identity.type Enum~~ RESOLVED

The `type` column now has `CHECK (type IN ('USER', 'SUPER_USER', 'SERVICE_ACCOUNT'))` (added in V1.0.0 baseline).

### 4. No CHECK Constraint on tenant_integration.status Enum

The `status` column is `VARCHAR(20)` with no CHECK constraint. Valid values (`ACTIVE`, `INACTIVE`, `PENDING`, `ERROR`, `SUSPENDED`) are only enforced at the GraphQL layer.

### 5. organization.key — No Format CHECK

The `key` column has a UNIQUE constraint but no CHECK for format rules (e.g., lowercase, no spaces, max length within reason). Format enforcement is application-level only.

### 6. Conversation organization_id — No FK to Organization

The `agents` service `conversation` table has an `organization_id INTEGER NOT NULL` column (added in V0.0.4) but no FK constraint to `organization(id)` — this is expected since they are in different databases, but it means referential integrity is not enforced.

---

## Recommendations

Prioritized list of improvements:

### P0 — Critical (Data Integrity)

1. ~~**Add UNIQUE constraint on `identity.email`**~~ — **DONE** (V1.0.0 baseline).

2. ~~**Add CHECK constraints for enum columns**~~ — **DONE** for `identity.type` (V1.0.0 baseline). Still needed for `tenant_integration.status`.

### P1 — High (Design Alignment)

3. ~~**Implement Membership entity**~~ — **DONE** (V1.0.0 baseline). `membership` and `membership_role` tables exist. Legacy `identity.organization_id` FK remains but is no longer the canonical relationship.

4. **Add `tenant_id` to Organization** — Either as a DB column (if co-located) or as an application-level field with eventual consistency. The Tenant-Organization relationship is fundamental to the domain model.

5. **Migrate metadata columns from TEXT to JSONB** — `ALTER TABLE integration ALTER COLUMN metadata TYPE JSONB USING metadata::jsonb` (and same for `tenant_integration`). Update domain types from `string` to a proper JSON type.

### P2 — Medium (API Completeness)

6. **Implement Identity CRUD mutations** — The `IamIdentitiesOps` type currently has only a `_placeholder` field. Add create, update, and delete mutations.

7. **Implement Organization CRUD mutations** — Beyond `sync`, add standalone create, update, and delete operations.

8. **Add tenant list/search query** — Currently only `tenant(key)` single-lookup exists. Add a search endpoint similar to IAM patterns.

9. **Add delete mutations** — No entity currently supports deletion (Tenant, Integration, TenantIntegration).

### P3 — Low (Consistency)

10. **Normalize Integration naming** — Domain type is `SystemIntegration`, DB table is `integration`, design doc says `Integration`. Pick one and align across all layers.

11. **Add format CHECK on organization.key** — e.g., `CHECK (key ~ '^[a-z0-9_-]+$')` to enforce a machine-friendly format.

12. **Expose `created_at`/`updated_at` in GraphQL** — Currently these are DB-only columns. Consider exposing them as read-only fields for audit purposes.

13. **Align Tenant.id GraphQL type** — Domain type uses `number`, GraphQL uses `ID!` (string). IAM entities use `Int!`. Standardize across services.
