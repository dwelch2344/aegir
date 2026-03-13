# Recipe: Adding a New Domain Service

This recipe covers every step needed to add a new federated GraphQL subgraph service to the platform. Follow these steps in order.

---

## Prerequisites

- Working devcontainer with Postgres, Traefik, and gateway running
- Familiarity with the Moribashi framework (DI, plugins, service scanning)

---

## 1. Choose a Port

Services use sequential ports starting at 4000:

| Port | Service |
|------|---------|
| 4000 | gateway |
| 4001 | iam |
| 4002 | system |
| 4003 | agents |
| 4010 | orchestration |

Pick the next available port for your service.

---

## 2. Domain Types (`packages/domain/src/`)

Add TypeScript interfaces for your domain entities:

```typescript
// packages/domain/src/my-entity.ts
export interface MyEntity {
  id: number
  key: string
  name: string
}
```

Re-export from `packages/domain/src/index.ts`:

```typescript
export type { MyEntity } from './my-entity.js'
```

---

## 3. Terraform — DB Schema & Role

Three files need changes in `infra/local/tf/`:

### `modules/postgres/main.tf` — add a new block:

```hcl
# ---------- YOUR_SERVICE ----------

resource "postgresql_role" "yoursvc_svc" {
  name     = "yoursvc_svc"
  login    = true
  password = var.yoursvc_svc_password
}

resource "postgresql_schema" "yoursvc" {
  name     = "yoursvc"
  owner    = postgresql_role.yoursvc_svc.name
  database = var.database
}

resource "postgresql_grant" "yoursvc_schema_usage" {
  role        = postgresql_role.yoursvc_svc.name
  database    = var.database
  schema      = postgresql_schema.yoursvc.name
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}

resource "postgresql_default_privileges" "yoursvc_tables" {
  role     = postgresql_role.yoursvc_svc.name
  database = var.database
  schema   = postgresql_schema.yoursvc.name
  owner    = postgresql_role.yoursvc_svc.name
  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}
```

### `modules/postgres/variables.tf` — add:

```hcl
variable "yoursvc_svc_password" {
  description = "Password for the yoursvc_svc role"
  type        = string
  sensitive   = true
}
```

### Root `variables.tf` — add:

```hcl
variable "yoursvc_svc_password" {
  default   = "yoursvc_dev"
  sensitive = true
}
```

### Root `main.tf` — pass to module:

```hcl
module "postgres" {
  # ... existing vars ...
  yoursvc_svc_password = var.yoursvc_svc_password
}
```

Run `tofu apply` to provision.

---

## 4. Scaffold the Service Directory

Create `services/yoursvc/` with these boilerplate files:

### `package.json`

```json
{
  "name": "@aegir/yoursvc",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsup",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mercuriusjs/federation": "*",
    "@moribashi/common": "^0.1.11",
    "@moribashi/core": "^0.1.11",
    "@moribashi/graphql": "^0.1.11",
    "@moribashi/pg": "^0.1.11",
    "@moribashi/web": "^0.1.11",
    "@aegir/common": "workspace:*",
    "fastify": "^5.0.0",
    "graphql": "^16.0.0",
    "mercurius": "^16.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

### `tsup.config.ts`

```typescript
import { defineConfig } from 'tsup'
export default defineConfig({ entry: ['src/index.ts'], format: ['esm'], clean: true })
```

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true } })
```

Directory structure:

```
services/yoursvc/
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  data/migrations/
  src/
    index.ts
    app.ts
    app.test.ts
    schema.ts
    resolvers.ts
    your-entity/
      your-entity.svc.ts
```

---

## 5. Migrations (`data/migrations/`)

Versioned SQL files using the pattern `V0.0.N__description.sql`:

```sql
-- V0.0.1__create_my_entity.sql
CREATE TABLE my_entity (
    id         SERIAL       PRIMARY KEY,
    key        VARCHAR(100) NOT NULL UNIQUE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

Include a seed file last:

```sql
-- V0.0.N__seed.sql
INSERT INTO my_entity (id, key, name) VALUES (1, 'example', 'Example');
SELECT setval('my_entity_id_seq', (SELECT max(id) FROM my_entity));
```

Moribashi's pgPlugin runs these automatically on startup.

---

## 6. Service Classes (`src/your-entity/your-entity.svc.ts`)

Follow the DI pattern — Moribashi auto-discovers `*.svc.ts` files:

```typescript
import type { Db } from '@moribashi/pg'

export default class YourEntityService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[] }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{ id: number; key: string; name: string }>(
      `SELECT id, key, name FROM my_entity ${where} ORDER BY id`,
      params,
    )
    return { results }
  }
}
```

Key conventions:
- Default export, PascalCase class name
- Constructor accepts `{ db }` from DI cradle
- Use named params (`:paramName`) in SQL
- `db.query<T>()` returns camelCase-mapped rows

---

## 7. GraphQL Schema (`src/schema.ts`)

### Naming Conventions

All types are **domain-prefixed PascalCase**:

| Pattern | Example |
|---------|---------|
| Entity types | `YourEntity` |
| Search wrapper | `YourEntitySearch` |
| Search input | `YourEntitySearchInput` |
| Query namespace | `YourDomain` (e.g., `Iam`, `System`) |
| Mutation namespace | `YourDomainOps` |
| Sub-namespaces | `YourDomainEntities`, `YourDomainEntitiesOps` |

### Federation

- Add `@key(fields: "id")` to entity types that other services may reference
- Add `__resolveReference` in resolvers for those types

### Mounting on Tenant

If your service should be accessed under tenant context (most services), extend `Tenant` and `TenantOps`:

```graphql
extend type Tenant @key(fields: "id") {
  yoursvc: YourSvcTenant!
}

extend type TenantOps @key(fields: "id") {
  yoursvc: YourSvcTenantOps!
}
```

This provides tenant context to all your resolvers automatically.

### Root Query/Mutation

```graphql
extend type Query {
  yoursvc: YourSvc!
}

extend type Mutation {
  yoursvc: YourSvcOps!
}
```

---

## 8. Resolvers (`src/resolvers.ts`)

```typescript
import type { ResolverMap } from '@moribashi/graphql'
import type YourEntityService from './your-entity/your-entity.svc.js'

export interface RequestCradle {
  yourEntityService: YourEntityService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    yoursvc: () => ({}),
  },
  YourSvc: {
    entities: () => ({}),
  },
  YourSvcEntities: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.yourEntityService.search(args.input as any)
    },
  },
  YourEntity: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      // resolve by primary key for federation
    },
  },
  Mutation: {
    yoursvc: () => ({}),
  },
  // ... mutation resolvers
}
```

Key pattern: namespace resolvers (`Query.yoursvc`, `YourSvc.entities`) return `({})` — they're just passthrough objects for nested field resolution.

---

## 9. App Bootstrap (`src/app.ts`)

Copy from any existing service (e.g., `services/iam/src/app.ts`). Key things to change:

| Setting | Value |
|---------|-------|
| Port env var | `YOURSVC_PORT` / default `40XX` |
| Host env var | `YOURSVC_HOST` / default `0.0.0.0` |
| PG user | `yoursvc_svc` |
| PG password | `yoursvc_dev` |
| PG schema | `yoursvc` |
| Health service name | `"yoursvc"` |

The `bindResolversToScope()` function must be copied into each service (it binds resolver `this` to the Moribashi DI cradle).

### `src/index.ts`

```typescript
import { buildApp } from './app.js'
const { app } = await buildApp()
await app.start()
```

---

## 10. Gateway Registration

### `services/gateway/src/config.ts`

```typescript
services: {
  // ...existing...
  yoursvc: getEnv("YOURSVC_URL", "http://localhost:40XX/graphql")!,
}
```

### `services/gateway/src/app.ts`

```typescript
services: [
  // ...existing...
  { name: 'yoursvc', url: config.services.yoursvc },
]
```

---

## 11. Traefik Routing (`.devcontainer/traefik/dynamic.yml`)

Add three entries:

```yaml
# In routers:
api-yoursvc:
  rule: "PathPrefix(`/api/yoursvc`)"
  entryPoints: [web]
  service: yoursvc
  middlewares: [strip-api-yoursvc]

# In middlewares:
strip-api-yoursvc:
  stripPrefix:
    prefixes: ["/api/yoursvc"]

# In services:
yoursvc:
  loadBalancer:
    servers:
      - url: "http://aegir-dev:40XX"
```

---

## 12. Tests (`src/app.test.ts`)

Standard test cases for every service:

1. **Health check** — `GET /health` returns `{ status: "ok", service: "yoursvc" }`
2. **Schema introspection** — `{ _service { sdl } }` contains your entity types
3. **Query tests** — verify seeded data returns correctly
4. **Mutation tests** — verify create/update/upsert operations

Pattern:

```typescript
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("YourSvc Service", () => {
  let fastify: FastifyInstance;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const result = await buildApp();
    fastify = result.fastify;
    stop = () => result.app.stop();
    await fastify.ready();
  });

  afterAll(async () => { await stop(); });

  it("responds to health check", async () => {
    const response = await fastify.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "yoursvc" });
  });

  // ... query and mutation tests via fastify.inject POST /graphql
});
```

---

## 13. Final Steps

1. `pnpm install` — workspace auto-detects new service
2. `pnpm --filter @aegir/yoursvc build` — verify compilation
3. `npx tsc --noEmit` in service dir — verify types
4. `pnpm --filter @aegir/yoursvc test` — run tests (requires DB)
5. `tofu apply` in `infra/local/tf/` — provision DB schema

---

## Checklist

- [ ] Domain types in `packages/domain/src/`
- [ ] Terraform role + schema + grants
- [ ] Service directory scaffolded
- [ ] Migration SQL files
- [ ] Service classes (`*.svc.ts`)
- [ ] GraphQL schema (`schema.ts`)
- [ ] Resolvers (`resolvers.ts`)
- [ ] App bootstrap (`app.ts` + `index.ts`)
- [ ] Gateway config + app updated
- [ ] Traefik routing added
- [ ] Tests written and passing
- [ ] `pnpm install && build` succeeds
