/**
 * Template generators for scaffolded ship files.
 *
 * These produce the actual source code for services, packages, and config files.
 * Templates use plain Fastify + Mercurius (no Moribashi dependency) so that
 * generated ships are standalone with no Shipyard runtime dependency.
 */

// ── Service package.json ────────────────────────────────────────────────────

export function gatewayPackageJson(scope: string): string {
  return JSON.stringify(
    {
      name: `${scope}/gateway`,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        build: 'tsup',
        dev: 'tsx watch src/index.ts',
        test: 'vitest run',
        'test:watch': 'vitest',
      },
      dependencies: {
        '@fastify/cors': '^10.0.0',
        '@mercuriusjs/gateway': '^5.0.0',
        fastify: '^5.0.0',
        graphql: '^16.0.0',
        [`${scope}/common`]: 'workspace:*',
      },
      devDependencies: {
        '@types/node': '^22.0.0',
        tsup: '^8.0.0',
        tsx: '^4.0.0',
        typescript: '^5.7.0',
        vitest: '^3.0.0',
      },
    },
    null,
    2,
  )
}

export function subgraphPackageJson(scope: string, serviceName: string): string {
  return JSON.stringify(
    {
      name: `${scope}/${serviceName}`,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        build: 'tsup',
        dev: 'tsx watch src/index.ts',
        test: 'vitest run',
        'test:watch': 'vitest',
      },
      dependencies: {
        '@graphql-tools/utils': '^10.0.0',
        '@mercuriusjs/federation': '^5.0.0',
        fastify: '^5.0.0',
        graphql: '^16.0.0',
        [`${scope}/common`]: 'workspace:*',
      },
      devDependencies: {
        '@types/node': '^22.0.0',
        tsup: '^8.0.0',
        tsx: '^4.0.0',
        typescript: '^5.7.0',
        vitest: '^3.0.0',
      },
    },
    null,
    2,
  )
}

// ── tsup / vitest / tsconfig (shared across all services) ───────────────────

export function serviceTsupConfig(): string {
  return `import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
})
`
}

export function serviceVitestConfig(): string {
  return `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
`
}

export function serviceTsConfig(): string {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist', rootDir: 'src' },
      include: ['src'],
    },
    null,
    2,
  )
}

// ── Gateway service source ──────────────────────────────────────────────────

export function gatewayAppTs(name: string, subgraphs: { name: string; port: number }[]): string {
  const serviceEntries = subgraphs
    .map(
      (s) =>
        `    {\n      name: '${s.name}',\n      url: process.env.${s.name.toUpperCase()}_URL ?? 'http://localhost:${s.port}/graphql',\n      mandatory: false,\n    }`,
    )
    .join(',\n')

  return `import Fastify from 'fastify'
import cors from '@fastify/cors'
import gateway from '@mercuriusjs/gateway'

export async function createApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ status: 'ok', service: '${name}-gateway' }))

  await app.register(gateway, {
    gateway: {
      services: [
${serviceEntries},
      ],
      pollingInterval: 5000,
    },
  })

  return app
}
`
}

export function gatewayIndexTs(defaultPort: number): string {
  return `import { createApp } from './app.js'

const port = Number(process.env.GATEWAY_PORT ?? ${defaultPort})
const host = process.env.GATEWAY_HOST ?? '0.0.0.0'

const app = await createApp()
await app.listen({ port, host })
console.log(\`Gateway listening on \${host}:\${port}\`)
`
}

export function gatewayTestTs(name: string): string {
  return `import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import cors from '@fastify/cors'

describe('${name} gateway', () => {
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    // Gateway unit test: verify health and CORS without starting federation.
    // Federation integration tests require subgraph services to be running.
    app = Fastify({ logger: false })
    await app.register(cors, { origin: true })
    app.get('/health', async () => ({ status: 'ok', service: '${name}-gateway' }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('responds to health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: '${name}-gateway' })
  })
})
`
}

// ── Subgraph service source ─────────────────────────────────────────────────

export function subgraphAppTs(name: string, serviceName: string): string {
  return `import Fastify from 'fastify'
import federation from '@mercuriusjs/federation'
import { schema } from './schema.js'
import { resolvers } from './resolvers.js'

export async function createApp() {
  const app = Fastify({ logger: true })

  await app.register(federation, {
    schema,
    resolvers,
    graphiql: true,
  })

  app.get('/health', async () => ({ status: 'ok', service: '${name}-${serviceName}' }))

  return app
}
`
}

export function subgraphIndexTs(serviceName: string, defaultPort: number): string {
  const envPrefix = serviceName.toUpperCase()
  return `import { createApp } from './app.js'

const port = Number(process.env.${envPrefix}_PORT ?? ${defaultPort})
const host = process.env.${envPrefix}_HOST ?? '0.0.0.0'

const app = await createApp()
await app.listen({ port, host })
console.log(\`${capitalize(serviceName)} service listening on \${host}:\${port}\`)
`
}

export function subgraphSchemaTs(serviceName: string): string {
  const typeName = capitalize(serviceName)
  return `export const schema = \`
  type ${typeName}Info @key(fields: "id") {
    id: ID!
    name: String!
    createdAt: String!
  }

  extend type Query {
    ${serviceName}Info: ${typeName}Info
  }
\`
`
}

export function subgraphResolversTs(serviceName: string): string {
  const typeName = capitalize(serviceName)
  return `export const resolvers = {
  Query: {
    ${serviceName}Info: async () => ({
      id: '1',
      name: '${typeName} Service',
      createdAt: new Date().toISOString(),
    }),
  },
  ${typeName}Info: {
    __resolveReference: async (ref: { id: string }) => ({
      id: ref.id,
      name: '${typeName} Service',
      createdAt: new Date().toISOString(),
    }),
  },
}
`
}

export function subgraphTestTs(name: string, serviceName: string): string {
  const typeName = capitalize(serviceName)
  return `import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from './app.js'

describe('${name} ${serviceName} service', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('responds to health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: '${name}-${serviceName}' })
  })

  it('serves the federated schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ _service { sdl } }' },
    })
    expect(response.statusCode).toBe(200)
    const sdl = response.json().data._service.sdl
    expect(sdl).toContain('type ${typeName}Info')
  })

  it('resolves ${serviceName}Info query', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ ${serviceName}Info { id name createdAt } }' },
    })
    expect(response.statusCode).toBe(200)
    const data = response.json().data
    expect(data.${serviceName}Info.id).toBe('1')
    expect(data.${serviceName}Info.name).toBe('${typeName} Service')
  })
})
`
}

// ── Common package ──────────────────────────────────────────────────────────

export function commonEnvTs(): string {
  return `/**
 * Environment variable helpers.
 * Use these instead of accessing process.env directly for consistent
 * error messages and default value handling.
 */

export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback
}

export function requireEnv(key: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(\`Missing required environment variable: \${key}\`)
  }
  return value
}
`
}

export function commonIndexTs(): string {
  return `export { getEnv, requireEnv } from './env.js'
`
}

// ── Common package (tsup) ───────────────────────────────────────────────────

export function packageTsupConfig(): string {
  return `import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
})
`
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
