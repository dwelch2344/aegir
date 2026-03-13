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
 │         └── → Role[] (Admin, Member, domain-specific)
 └── TenantIntegration (many)
      └── → Integration
```

- **Identity ↔ Organization** — mediated by **Membership**. An Identity can be a member of multiple Organizations. Each Membership carries **Role assignments** (Admin and Member are defaults; additional roles are defined as domains require).
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

| id  | key         | name           | protected | Purpose                                                                                                                                       |
| --- | ----------- | -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `system`    | System         | `true`    | Platform-level concerns. Cannot be modified or deleted via normal APIs. Owns the SUPER_USER identity and any platform-level service accounts. |
| 2   | `{project}` | {Project Name} | `false`   | The operator's own organization. First "real" org in the system.                                                                              |

The **System organization** is special:

- `protected = true` — sync and mutation operations skip it
- Stable id (1) and key (`system`) across all ships
- Used for platform-internal actors and configuration that should never be scoped to a customer

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

## Roles & Permissions

Roles attach to Memberships, not directly to Identities. The relationship between Roles and Permissions is intentionally not a simple association — this model is pending design and will be documented separately.

**Status:** Open design thread. Default roles are Admin and Member; domain-specific roles are added as needed.
