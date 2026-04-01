# Foundational Domain Model

## Overview

All systems built on the Shipyard share five **federated root entities**. These exist at the platform level, independent of any specific domain. Every domain-specific entity builds on top of them.

---

## Root Entities

### Identity

Any actor in the ecosystem: human user, service account, AI agent. Identities are standalone, never deleted, and domain-agnostic. They don't inherently "belong" to anything — they exist independently and participate in organizations through memberships.

### Organization

The primary unit of ownership and resource grouping. Not necessarily a company — it's any logical construct that owns things (subscriptions, data, configuration). In a SaaS context, each customer entity gets an Organization. Organizations may be marked as `protected` — protected organizations cannot be modified or deleted through normal API operations. The System organization (id=1, key=`system`) is always protected.

### Tenant

The top-level boundary representing a distinct deployment or instance of the platform itself. Most systems have exactly one Tenant (the system itself). Multi-tenancy at this level is for true platform-of-platforms scenarios, not customer isolation — that's what Organizations are for.

### Integration

An abstract capability provider. "Keycloak" as a concept, "Stripe" as a concept — the _what_, not any specific instance. Think of it as a catalog entry for an external system the platform can connect to.

### TenantIntegration

A concrete instance of an Integration, scoped to a Tenant. "Our production Keycloak," "our staging Stripe." This is where connection details, configuration, and lifecycle live.

---

## Relationships

```
Tenant
 ├── Organization (many)
 │    └── Membership (many)
 │         ├── → Identity
 │         └── → Role[] (Owner, Admin, Member, domain-specific)
 └── TenantIntegration (many)
      └── → Integration
```

- **Identity ↔ Organization** — mediated by **Membership**. An Identity can be a member of multiple Organizations. Each Membership carries **Role assignments** (Owner, Admin, and Member are the three default roles; additional roles are defined as domains require).
- **Organization → Tenant** — every Organization exists within a Tenant.
- **TenantIntegration → Tenant** — each TenantIntegration belongs to exactly one Tenant.
- **TenantIntegration → Integration** — each TenantIntegration references exactly one Integration.

---

## Tenant vs. Organization

|                     | Tenant                              | Organization                             |
| ------------------- | ----------------------------------- | ---------------------------------------- |
| **Represents**      | The platform instance               | A logical entity using the platform      |
| **Typical count**   | 1 (sometimes 2–3)                   | Many (grows with customers)              |
| **Owns**            | Integrations, infrastructure config | Subscriptions, domain resources, members |
| **Isolation level** | Platform boundary                   | Resource/data boundary                   |

### Concrete Example

For Maelle:

- **Tenant:** "Maelleverse" — the platform instance itself
- **Organization:** "System" — the protected platform org (id=1, always exists)
- **Organization:** "Maelle" — the operator's own org (id=1000)
- **Organization:** "MakeupCo" — created when a customer subscribes to Maelle's services.

---

## Ship Bootstrap Contract

Every ship is initialized with the following seed data. This is the minimum viable state for the platform to operate.

### Tenant (system service, id=1)

One tenant representing the ship itself. Key matches the project name (e.g., `aegir`).

### Organizations (IAM service)

| id  | key      | name   | protected | Purpose                                                                                                                                       |
| --- | -------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `system` | System | `true`    | Platform-level concerns. Cannot be modified or deleted via normal APIs. Owns the SUPER_USER identity and any platform-level service accounts. |

The V1.0.0 baseline migration seeds only the System organization. Additional organizations (the operator's own org, customer orgs, etc.) are created at runtime via Keycloak sync or direct API operations. There is no hardcoded "project org" in the seed data.

The **System organization** is special:

- `protected = true` — sync and mutation operations skip it
- Stable id (1) and key (`system`) across all ships
- Used for platform-internal actors and configuration that should never be scoped to a customer
- The first user to log in is auto-bootstrapped as **Owner** of the System org, establishing initial platform administration

### Identity (IAM service)

| id  | type         | label  | org        | Purpose                                                                                                                         |
| --- | ------------ | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SUPER_USER` | System | System (1) | Platform super-user. Not a human — represents the system itself for audit trails, ownership, and operations that need an actor. |

### Identity Types

| Type              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `USER`            | Human user                                              |
| `SUPER_USER`      | Platform-level system identity with elevated privileges |
| `SERVICE_ACCOUNT` | Machine-to-machine identity for integrations            |

### Integrations (system service)

Seed integrations represent the platform's own infrastructure dependencies (e.g., Keycloak, Slack, GitHub). These are linked to the tenant via TenantIntegration records.

---

## Implementation Status

_Last audited: 2026-04-01. See [domain-model-audit.md](domain-model-audit.md) for full details._

### Identity
- **Service:** IAM (`services/iam`)
- **DB Table:** `identity`
- **Status:** Partially Implemented
- **Deviations:**
  - `organization_id` is a direct FK to `organization` — legacy column; the canonical relationship is now via the Membership entity
  - No create/update/delete mutations — only search queries are available

### Organization
- **Service:** IAM (`services/iam`)
- **DB Table:** `organization`
- **Status:** Partially Implemented
- **Deviations:**
  - No `tenant_id` column — design says every Organization belongs to a Tenant, but this FK does not exist (cross-service boundary)
  - `keycloak_id` column exists in implementation but is not documented in design
  - Only `sync` mutation available (from Keycloak) — no standalone CRUD mutations

### Tenant
- **Service:** System (`services/system`)
- **DB Table:** `tenant`
- **Status:** Fully Implemented
- **Deviations:**
  - GraphQL uses `ID!` for `id` field while domain type uses `number` (minor type mismatch with IAM convention of `Int!`)
  - No list/search query — only single-lookup by key
  - No delete mutation

### Integration
- **Service:** System (`services/system`)
- **DB Table:** `integration`
- **Status:** Fully Implemented
- **Deviations:**
  - Domain type is named `SystemIntegration` while DB table is `integration` and design uses `Integration`
  - `metadata` field uses `TEXT` type instead of `JSONB`
  - No delete mutation

### TenantIntegration
- **Service:** System (`services/system`)
- **DB Table:** `tenant_integration`
- **Status:** Fully Implemented
- **Deviations:**
  - `name`, `ordinal`, and `integrationKey` fields exist in implementation but are not documented in design
  - `metadata` field uses `TEXT` type instead of `JSONB`
  - No CHECK constraint on `status` enum at DB level
  - No delete mutation

### Membership
- **Service:** IAM (`services/iam`)
- **DB Tables:** `membership`, `membership_role`
- **Status:** Implemented (V1.0.0 baseline)
- **Notes:** Mediates the Identity-Organization relationship with role assignments. Each membership links an identity to an organization (unique pair). Roles are assigned via the `membership_role` join table. The `identity.organization_id` FK still exists as a legacy column but membership is the canonical relationship.

### Roles & Permissions / ReBAC
- **Service:** IAM (`services/iam`)
- **DB Tables:** `role`, `role_permission`, `org_relationship`
- **Status:** Implemented (V1.0.0 baseline)
- **Notes:** Full ReBAC model is implemented. Three default roles seeded: Owner, Admin, Member. Permissions are scoped by relationship type (SELF, SYS_CHILD). The System org has a SELF relationship, and child orgs get a SYS_CHILD relationship to the System org, enabling system-wide Owner permissions to cascade.

---

## Roles & Permissions (ReBAC)

Access control is **Relationship-Based** (ReBAC). Permissions are never assigned directly to identities or even to roles in isolation — they fan out through typed relationships between organizations.

### Core Concepts

**OrgRelationship** — a directed edge between two organizations: an **owner org** and a **related org**, connected by a **relationship type** (a string, e.g., `SELF`, `SYS_CHILD`, `SUBSCRIBER`, `SUBSIDIARY`). Every organization has a `SELF` relationship with itself. The `SYS_CHILD` relationship type connects child organizations to the System org, enabling system-level Owner roles to manage all child orgs through the standard ReBAC resolution. Relationships are **transitive** — if AcmeCorp owns a `SUBSIDIARY` relationship to AcmeCorp US, and AcmeCorp US owns a `SUBSIDIARY` relationship to AcmeCorp US East, the chain resolves.

**Role** — assigned to an Identity at a specific Organization via Membership. A Role is a named bundle of **(Permission, RelationshipType)** pairs. The relationship type determines _where_ the permission applies, not just _what_ it grants.

**Permission** — the actual capability (e.g., `UPDATE_ORG`, `SUBSCRIPTION_READ`). Always scoped by a relationship type.

### Data Model

```
OrgRelationship(owner_org, related_org, relationship_type)
Role(name)
RolePermission(role, permission, relationship_type)
Membership(identity, organization, roles[])
```

### Access Check

Checking access requires three inputs:

1. **Identity** — who is acting
2. **Operating context** — the org the identity is working out of (their membership org)
3. **Target resource owner** — the org that owns the resource being accessed

Resolution:

```
1. Get Identity's Roles at Operating Context org (via Membership)
2. For each Role, get (Permission, RelationshipType) pairs
3. Walk OrgRelationships from Operating Context org:
   find all orgs related by that RelationshipType (transitively)
4. If Target Resource Owner is in that set → access granted
```

### Why the System Org Matters for ReBAC

System-wide permissions (e.g., "platform admins can do X everywhere") resolve through the same mechanism. The System org (id=1) is the **default org for the tenant** — if a role needs to grant a permission "system-wide," the resolution is: find orgs that have a relationship with the System org. No special-casing needed.

### Examples

**Dave — Admin at AcmeCorp:**

```
Dave → Membership(AcmeCorp) → Role(Admin)
Admin grants: (UPDATE_ORG, SELF)
AcmeCorp —SELF→ AcmeCorp
∴ Dave has UPDATE_ORG at AcmeCorp ✓
```

Access check: Identity=Dave, Operating Context=AcmeCorp, Target=AcmeCorp → granted.

**Jim — CSR at AcmeCorp:**

```
Jim → Membership(AcmeCorp) → Role(CSR)
CSR grants: (SUBSCRIPTION_READ, SUBSCRIBER)
WidgetCo —SUBSCRIBER→ AcmeCorp
GadgetInc —SUBSCRIBER→ AcmeCorp
∴ Jim has SUBSCRIPTION_READ at WidgetCo, GadgetInc ✓
```

Access check: Identity=Jim, Operating Context=AcmeCorp, Target=WidgetCo → granted.

**Transitive example — subsidiary:**

```
AcmeCorp US —SUBSIDIARY→ AcmeCorp
AcmeCorp US East —SUBSIDIARY→ AcmeCorp US

Admin grants: (VIEW_FINANCIALS, SUBSIDIARY)
∴ AcmeCorp Admin has VIEW_FINANCIALS at AcmeCorp US and AcmeCorp US East
```
