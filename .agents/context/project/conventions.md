# Project Context: Aegir Conventions

## Monorepo Layout

```
packages/    — shared libraries (@aegir/common, @aegir/domain, @aegir/kafka)
services/    — backend GraphQL subgraph services
apps/        — frontend applications (Nuxt SPA)
infra/       — OpenTofu / Terraform (local + distributed)
catalog/     — Shipyard catalog patterns (reviewed, versioned)
```

## Naming

- **Packages**: `@aegir/<name>` (lowercase, hyphens)
- **Services**: `services/<name>/` — lowercase, hyphens
- **Service classes**: `*.svc.ts`, default export, PascalCase class, constructor DI
- **GraphQL types**: Moribashi namespace-nesting (e.g., `IamIdentities`, `AgentsConversation`)
- **Migrations**: Flyway format `V{semver}__{snake_case}.sql`
- **Catalog IDs**: `{category}.{pattern}` (e.g., `auth.oidc-keycloak`)

## Service Ports

Gateway: 4000, IAM: 4001, System: 4002, Agents: 4003, Orchestration: 4010, CDC: 4020

## Stack

TypeScript, Node 22, pnpm + Turborepo, Fastify, Mercurius (federation), Moribashi framework

## Protected Paths

Do not modify without explicit approval:
- `packages/domain/` — foundational domain model
- `catalog/` — reviewed patterns only
- `shipyard.manifest` — updated by tooling
