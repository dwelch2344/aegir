# Foundational Domain Model

## Overview

All systems built on the Shipyard share five **federated root entities**. These exist at the platform level, independent of any specific domain. Every domain-specific entity builds on top of them.

---

## Root Entities

### Identity

Any actor in the ecosystem: human user, service account, AI agent. Identities are standalone, never deleted, and domain-agnostic. They don't inherently "belong" to anything — they exist independently and participate in organizations through memberships.

### Organization

The primary unit of ownership and resource grouping. Not necessarily a company — it's any logical construct that owns things (subscriptions, data, configuration). In a SaaS context, each customer entity gets an Organization. The first Organization is typically the operator itself.

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

| | Tenant | Organization |
|---|---|---|
| **Represents** | The platform instance | A logical entity using the platform |
| **Typical count** | 1 (sometimes 2–3) | Many (grows with customers) |
| **Owns** | Integrations, infrastructure config | Subscriptions, domain resources, members |
| **Isolation level** | Platform boundary | Resource/data boundary |

### Concrete Example

For HeroDevs:

- **Tenant:** "HeroDevs Universe" — the platform instance itself
- **Organization:** "HeroDevs" — the operator's own org (first org created)
- **Organization:** "CustomerCo" — created when a customer subscribes to a product like the EOL scanner

---

## Roles & Permissions

Roles attach to Memberships, not directly to Identities. The relationship between Roles and Permissions is intentionally not a simple association — this model is pending design and will be documented separately.

**Status:** Open design thread. Default roles are Admin and Member; domain-specific roles are added as needed.
