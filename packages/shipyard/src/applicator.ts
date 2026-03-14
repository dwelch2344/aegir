import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { manifestSchema, type ShipManifest, type ShipService } from './manifest-schema.js'
import { loadCatalog, collectCapabilities } from './catalog-reader.js'
import type { CatalogEntry } from './catalog-schema.js'
import * as tpl from './templates.js'

export interface ApplyOptions {
  /** Root directory of the ship */
  shipDir: string
  /** Path to the catalog directory */
  catalogDir: string
  /** Pattern ID to apply (e.g., "service.domain-subgraph") */
  patternId: string
  /** Pattern parameters (key-value pairs) */
  params: Record<string, string | number | boolean>
}

export interface ApplyResult {
  /** Pattern that was applied */
  pattern: CatalogEntry
  /** Files created or modified */
  files: string[]
  /** New capabilities added */
  newCapabilities: string[]
  /** Updated manifest */
  manifest: ShipManifest
}

/**
 * Applies a catalog pattern to an existing ship.
 *
 * Flow:
 * 1. Read and validate the ship's manifest
 * 2. Load the requested pattern from the catalog
 * 3. Check preconditions against existing capabilities
 * 4. Check the pattern hasn't already been applied (idempotency)
 * 5. Validate required parameters
 * 6. Run the pattern-specific generator
 * 7. Update the manifest with new refs, services, and capabilities
 */
export function apply(options: ApplyOptions): ApplyResult {
  const { shipDir, catalogDir, patternId, params } = options

  // 1. Read and validate manifest
  const manifestPath = join(shipDir, 'shipyard.manifest')
  if (!existsSync(manifestPath)) {
    throw new Error(`No shipyard.manifest found in ${shipDir}. Is this a ship?`)
  }
  const manifestRaw = readFileSync(manifestPath, 'utf-8')
  const manifestData = parse(manifestRaw)
  const manifestResult = manifestSchema.safeParse(manifestData)
  if (!manifestResult.success) {
    throw new Error(`Invalid manifest: ${manifestResult.error.issues.map((i) => i.message).join(', ')}`)
  }
  const manifest = manifestResult.data

  // 2. Load catalog and find pattern
  const catalog = loadCatalog(catalogDir)
  const pattern = catalog.get(patternId)
  if (!pattern) {
    const available = [...catalog.keys()].sort().join(', ')
    throw new Error(`Pattern "${patternId}" not found in catalog. Available: ${available}`)
  }

  // 3. Check preconditions
  const existingCapabilities = new Set(manifest.capabilities)
  const existingPatternIds = new Set(manifest.catalog_refs.map((r) => r.id))

  for (const precondition of pattern.preconditions) {
    if (!existingPatternIds.has(precondition)) {
      const preconditionEntry = catalog.get(precondition)
      const label = preconditionEntry ? `"${preconditionEntry.name}"` : `"${precondition}"`
      throw new Error(
        `Precondition not met: ${label} (${precondition}) must be applied before ${patternId}.\n` +
          `Run: shipyard apply ${precondition}`,
      )
    }
  }

  // 4. Idempotency check — pattern-specific
  if (patternId === 'service.domain-subgraph') {
    // This pattern can be applied multiple times (once per service).
    // Check for duplicate service name instead.
    const serviceName = params.service_name as string | undefined
    if (serviceName && manifest.services.some((s) => s.name === serviceName)) {
      throw new Error(`Service "${serviceName}" already exists in this ship. Choose a different --name.`)
    }
  } else if (patternId === 'harness.devcontainer') {
    // Devcontainer can always be re-applied (idempotent overwrite)
  } else if (existingPatternIds.has(patternId)) {
    throw new Error(
      `Pattern "${patternId}" is already applied to this ship. ` +
        `To re-apply, first remove it from catalog_refs in shipyard.manifest.`,
    )
  }

  // 4b. Auto-fill ship-derived defaults before validation
  if (patternId === 'harness.devcontainer') {
    if (!params.projectName) params.projectName = manifest.name
    if (!params.ingressPort) params.ingressPort = 7356
    if (!params.postgresVersion) params.postgresVersion = '16-alpine'
    if (!params.keycloakVersion) params.keycloakVersion = '26.5'
    if (!params.nodeVersion) params.nodeVersion = '24'
  }

  // 5. Validate required parameters
  for (const [paramName, paramDef] of Object.entries(pattern.parameters)) {
    if (paramDef.required && !(paramName in params)) {
      throw new Error(
        `Missing required parameter: --${paramName}\n` + `  ${paramDef.description?.trim().split('\n')[0] ?? ''}`,
      )
    }
    // Apply defaults
    if (!(paramName in params) && paramDef.default !== undefined) {
      let defaultVal = paramDef.default
      // Resolve ${service_name} references in defaults
      if (typeof defaultVal === 'string' && 'service_name' in params) {
        defaultVal = defaultVal.replace(/\$\{service_name\}/g, String(params.service_name))
      }
      params[paramName] = defaultVal
    }
    // Validate pattern (regex) for string params
    if (paramDef.pattern && typeof params[paramName] === 'string') {
      const regex = new RegExp(paramDef.pattern)
      if (!regex.test(params[paramName] as string)) {
        throw new Error(
          `Parameter "${paramName}" value "${params[paramName]}" does not match pattern: ${paramDef.pattern}`,
        )
      }
    }
  }

  // 6. Dispatch to pattern-specific generator
  const generator = GENERATORS[patternId]
  if (!generator) {
    throw new Error(
      `No code generator for pattern "${patternId}" yet. ` +
        `The pattern exists in the catalog but automatic application is not implemented.\n` +
        `You can apply it manually using: shipyard info ${patternId}`,
    )
  }

  const files = generator(shipDir, manifest, params)

  // 7. Update manifest
  const newCapabilities = pattern.provides.filter((c) => !existingCapabilities.has(c))

  manifest.catalog_refs.push({
    id: pattern.id,
    version: pattern.version,
    applied_at: new Date().toISOString(),
  })
  manifest.capabilities.push(...newCapabilities)

  // Write updated manifest
  const header = `# Ship Manifest — generated by Shipyard\n# This is the agent's primary source of truth about this ship.\n\n`
  writeFileSync(manifestPath, header + stringify(manifest, { lineWidth: 100 }))
  files.push('shipyard.manifest')

  return {
    pattern,
    files,
    newCapabilities,
    manifest,
  }
}

// ── Pattern-specific generators ───────────────────────────────────────────────

type PatternGenerator = (
  shipDir: string,
  manifest: ShipManifest,
  params: Record<string, string | number | boolean>,
) => string[]

const GENERATORS: Record<string, PatternGenerator> = {
  'service.domain-subgraph': generateDomainSubgraph,
  'harness.devcontainer': generateDevcontainer,
}

/**
 * Generates a new federated domain subgraph service — the 12-step recipe.
 *
 * For scaffolded ships (plain Fastify + Mercurius federation), this generates:
 * - Service directory with full source code
 * - Domain type in packages/domain
 * - Gateway registration
 * - Tests
 */
function generateDomainSubgraph(
  shipDir: string,
  manifest: ShipManifest,
  params: Record<string, string | number | boolean>,
): string[] {
  const serviceName = String(params.service_name)
  const port = Number(params.port)
  const entityName = String(params.entity_name)
  const entityFields = String(params.entity_fields ?? 'key:string,name:string')

  const scope = `@${manifest.name}`
  const files: string[] = []

  const write = (relativePath: string, content: string) => {
    const fullPath = join(shipDir, relativePath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
    files.push(relativePath)
  }

  // Parse entity fields
  const fields = parseEntityFields(entityFields)
  const entitySnake = toSnakeCase(entityName)
  const entityCamel = toCamelCase(entityName)
  const entityPascal = entityName // Assumed PascalCase from user
  const servicePascal = capitalize(serviceName)
  const serviceCamel = serviceName

  // ── Step 1: Domain type ─────────────────────────────────────────────────
  const domainTypeContent = generateDomainType(entityPascal, fields)
  write(`packages/domain/src/${entitySnake}.ts`, domainTypeContent)

  // Update domain index.ts to re-export
  const domainIndexPath = join(shipDir, 'packages/domain/src/index.ts')
  if (existsSync(domainIndexPath)) {
    const existing = readFileSync(domainIndexPath, 'utf-8')
    const exportLine = `export type { ${entityPascal} } from './${entitySnake}.js'`
    if (!existing.includes(exportLine)) {
      writeFileSync(domainIndexPath, existing.trimEnd() + '\n' + exportLine + '\n')
      files.push('packages/domain/src/index.ts')
    }
  }

  // ── Step 2: Service directory ───────────────────────────────────────────
  const svcDir = `services/${serviceName}`
  write(`${svcDir}/package.json`, tpl.subgraphPackageJson(scope, serviceName))
  write(`${svcDir}/tsconfig.json`, tpl.serviceTsConfig())
  write(`${svcDir}/tsup.config.ts`, tpl.serviceTsupConfig())
  write(`${svcDir}/vitest.config.ts`, tpl.serviceVitestConfig())

  // ── Step 3: Schema ──────────────────────────────────────────────────────
  const schemaContent = generateSubgraphSchema(servicePascal, serviceCamel, entityPascal, entityCamel, fields)
  write(`${svcDir}/src/schema.ts`, schemaContent)

  // ── Step 4: Resolvers ───────────────────────────────────────────────────
  const resolversContent = generateSubgraphResolvers(servicePascal, serviceCamel, entityPascal, entityCamel, fields)
  write(`${svcDir}/src/resolvers.ts`, resolversContent)

  // ── Step 5: App + Index ─────────────────────────────────────────────────
  write(`${svcDir}/src/app.ts`, tpl.subgraphAppTs(manifest.name, serviceName))
  write(`${svcDir}/src/index.ts`, tpl.subgraphIndexTs(serviceName, port))

  // ── Step 6: Tests ───────────────────────────────────────────────────────
  const testContent = generateSubgraphTest(manifest.name, serviceName, servicePascal, serviceCamel, entityPascal)
  write(`${svcDir}/src/app.test.ts`, testContent)

  // ── Step 7: Register with gateway ───────────────────────────────────────
  const gatewayAppPath = join(shipDir, 'services/gateway/src/app.ts')
  if (existsSync(gatewayAppPath)) {
    const gatewayApp = readFileSync(gatewayAppPath, 'utf-8')
    const envVar = serviceName.toUpperCase() + '_URL'
    const newServiceEntry = `    {\n      name: '${serviceName}',\n      url: process.env.${envVar} ?? 'http://localhost:${port}/graphql',\n      mandatory: false,\n    },`

    // Insert before the closing ] of the services array
    if (!gatewayApp.includes(`name: '${serviceName}'`)) {
      const updated = gatewayApp.replace(/(\s*],\s*\n\s*pollingInterval)/, '\n' + newServiceEntry + '\n      $1')
      if (updated !== gatewayApp) {
        writeFileSync(gatewayAppPath, updated)
        files.push('services/gateway/src/app.ts')
      }
    }
  }

  // ── Step 8: Update manifest services ────────────────────────────────────
  manifest.services.push({
    name: serviceName,
    type: 'graphql-subgraph',
    port,
    schema: serviceName,
  })

  return files
}

// ── Code generators for domain subgraph ───────────────────────────────────────

interface FieldDef {
  name: string
  type: 'string' | 'number' | 'boolean'
}

function parseEntityFields(fieldsStr: string): FieldDef[] {
  return fieldsStr.split(',').map((f) => {
    const [name, type] = f.trim().split(':')
    return { name: name.trim(), type: (type?.trim() ?? 'string') as FieldDef['type'] }
  })
}

function generateDomainType(entityPascal: string, fields: FieldDef[]): string {
  const fieldLines = fields
    .map((f) => {
      const tsType = f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string'
      return `  ${f.name}: ${tsType}`
    })
    .join('\n')

  return `export interface ${entityPascal} {
  id: number
${fieldLines}
  createdAt: Date
  updatedAt: Date
}
`
}

function generateSubgraphSchema(
  servicePascal: string,
  serviceCamel: string,
  entityPascal: string,
  entityCamel: string,
  fields: FieldDef[],
): string {
  const gqlFields = fields
    .map((f) => {
      const gqlType = f.type === 'number' ? 'Int' : f.type === 'boolean' ? 'Boolean' : 'String'
      return `    ${f.name}: ${gqlType}!`
    })
    .join('\n')

  const inputFields = fields
    .map((f) => {
      const gqlType = f.type === 'number' ? 'Int' : f.type === 'boolean' ? 'Boolean' : 'String'
      return `    ${f.name}: ${gqlType}`
    })
    .join('\n')

  return `export const schema = \`
  type ${entityPascal} @key(fields: "id") {
    id: Int!
${gqlFields}
    createdAt: String!
    updatedAt: String!
  }

  type ${servicePascal}${entityPascal}Search {
    results: [${entityPascal}!]!
  }

  input ${servicePascal}${entityPascal}SearchInput {
${inputFields}
  }

  type ${servicePascal}${entityPascal}s {
    search(input: ${servicePascal}${entityPascal}SearchInput!): ${servicePascal}${entityPascal}Search!
  }

  type ${servicePascal} {
    ${entityCamel}s: ${servicePascal}${entityPascal}s!
  }

  extend type Query {
    ${serviceCamel}: ${servicePascal}!
  }
\`
`
}

function generateSubgraphResolvers(
  servicePascal: string,
  serviceCamel: string,
  entityPascal: string,
  entityCamel: string,
  fields: FieldDef[],
): string {
  const sampleData: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === 'number') sampleData[f.name] = '1'
    else if (f.type === 'boolean') sampleData[f.name] = 'true'
    else sampleData[f.name] = `'Example ${capitalize(f.name)}'`
  }
  const sampleFields = Object.entries(sampleData)
    .map(([k, v]) => `      ${k}: ${v},`)
    .join('\n')

  return `const SAMPLE_DATA = [
  {
    id: 1,
${sampleFields}
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const resolvers = {
  Query: {
    ${serviceCamel}: () => ({}),
  },
  ${servicePascal}: {
    ${entityCamel}s: () => ({}),
  },
  ${servicePascal}${entityPascal}s: {
    search: (_: unknown, args: { input: Record<string, unknown> }) => {
      // In-memory filtering for scaffolded services.
      // Replace with real database queries when DB is wired.
      let results = [...SAMPLE_DATA]
      for (const [key, value] of Object.entries(args.input)) {
        if (value !== undefined && value !== null) {
          results = results.filter((r) => (r as Record<string, unknown>)[key] === value)
        }
      }
      return { results }
    },
  },
  ${entityPascal}: {
    __resolveReference: (ref: { id: number }) => {
      return SAMPLE_DATA.find((d) => d.id === ref.id) ?? null
    },
  },
}
`
}

function generateSubgraphTest(
  shipName: string,
  serviceName: string,
  servicePascal: string,
  serviceCamel: string,
  entityPascal: string,
): string {
  return `import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from './app.js'

describe('${shipName} ${serviceName} service', () => {
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
    expect(response.json()).toEqual({ status: 'ok', service: '${shipName}-${serviceName}' })
  })

  it('serves the federated schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ _service { sdl } }' },
    })
    expect(response.statusCode).toBe(200)
    const sdl = response.json().data._service.sdl
    expect(sdl).toContain('type ${entityPascal}')
    expect(sdl).toContain('type ${servicePascal}')
  })

  it('resolves namespaced query', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ ${serviceCamel} { ${toCamelCase(entityPascal)}s { search(input: {}) { results { id } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const data = response.json().data
    expect(data.${serviceCamel}).toBeDefined()
  })
})
`
}

// ── Devcontainer / Drydock generator ─────────────────────────────────────────

function generateDevcontainer(
  shipDir: string,
  manifest: ShipManifest,
  params: Record<string, string | number | boolean>,
): string[] {
  const projectName = String(params.projectName ?? manifest.name)
  const ingressPort = Number(params.ingressPort ?? 7356)
  const postgresVersion = String(params.postgresVersion ?? '16-alpine')
  const keycloakVersion = String(params.keycloakVersion ?? '26.5')
  const nodeVersion = String(params.nodeVersion ?? '24')

  const files: string[] = []
  const caps = new Set(manifest.capabilities)

  const write = (relativePath: string, content: string) => {
    const fullPath = join(shipDir, relativePath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
    files.push(relativePath)
  }

  // Determine which infra services the ship needs based on capabilities
  const needsPostgres = caps.has('postgres-database') || caps.has('db.postgres-schema')
  const needsRedis = caps.has('redis-cache')
  const needsKeycloak = caps.has('identity-provider') || caps.has('auth.oidc')
  const needsMinio = caps.has('s3-compatible-storage') || caps.has('object-storage')
  const needsRedpanda = caps.has('event-streaming') || caps.has('schema-registry')
  const needsConductor = caps.has('workflow-engine') || caps.has('workflow-orchestration')
  const needsDebezium = caps.has('change-data-capture')
  const needsMailhog = caps.has('email-capture-dev') || caps.has('email-sending')
  const needsObservability =
    caps.has('metrics-collection') || caps.has('log-aggregation') || caps.has('distributed-tracing')

  // ── devcontainer.json ─────────────────────────────────────────────────
  write('.devcontainer/devcontainer.json', generateDevcontainerJson(projectName, ingressPort))

  // ── Dockerfile ────────────────────────────────────────────────────────
  write('.devcontainer/Dockerfile.devcontainer', generateDockerfile(nodeVersion))

  // ── docker-compose.yml ────────────────────────────────────────────────
  write(
    '.devcontainer/docker-compose.yml',
    generateDockerCompose(projectName, manifest, ingressPort, postgresVersion, keycloakVersion, {
      postgres: needsPostgres,
      redis: needsRedis,
      keycloak: needsKeycloak,
      minio: needsMinio,
      redpanda: needsRedpanda,
      conductor: needsConductor,
      debezium: needsDebezium,
      mailhog: needsMailhog,
      observability: needsObservability,
    }),
  )

  // ── Traefik configs ───────────────────────────────────────────────────
  write('.devcontainer/traefik/traefik.yml', TRAEFIK_STATIC)
  write(
    '.devcontainer/traefik/dynamic.yml',
    generateTraefikDynamic(projectName, manifest, {
      keycloak: needsKeycloak,
      conductor: needsConductor,
      redpanda: needsRedpanda,
      mailhog: needsMailhog,
      observability: needsObservability,
    }),
  )

  // ── Postgres init ─────────────────────────────────────────────────────
  if (needsPostgres) {
    write(
      '.devcontainer/postgres/init-databases.sql',
      generatePostgresInit(projectName, manifest, {
        keycloak: needsKeycloak,
        conductor: needsConductor,
        debezium: needsDebezium,
      }),
    )
    if (needsDebezium) {
      write('.devcontainer/postgres/01-enable-replication.sh', ENABLE_REPLICATION_SH)
    }
  }

  // ── Conductor configs ─────────────────────────────────────────────────
  if (needsConductor) {
    write('.devcontainer/conductor/Dockerfile', CONDUCTOR_DOCKERFILE)
    write('.devcontainer/conductor/config.properties', CONDUCTOR_CONFIG)
    write('.devcontainer/conductor-ui/Dockerfile', CONDUCTOR_UI_DOCKERFILE)
    write('.devcontainer/conductor-ui/nginx.conf', CONDUCTOR_UI_NGINX)
  }

  // ── Observability configs ─────────────────────────────────────────────
  if (needsObservability) {
    write('.devcontainer/grafana/datasources.yml', GRAFANA_DATASOURCES)
    write('.devcontainer/grafana/dashboards.yml', GRAFANA_DASHBOARDS)
    write('.devcontainer/tempo/tempo.yml', TEMPO_CONFIG)
    write('.devcontainer/promtail/config.yml', PROMTAIL_CONFIG)
  }

  // ── scripts/ ──────────────────────────────────────────────────────────
  write('scripts/init.sh', generateInitScript(projectName))
  write('scripts/destroy.sh', generateDestroyScript(projectName))

  // ── .gitignore additions ──────────────────────────────────────────────
  const gitignorePath = join(shipDir, '.gitignore')
  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, 'utf-8')
    if (!existing.includes('.devcontainer/data')) {
      writeFileSync(gitignorePath, existing.trimEnd() + '\n\n# Devcontainer persistent data\n.devcontainer/data/\n')
      files.push('.gitignore')
    }
  }

  return files
}

function generateDevcontainerJson(name: string, port: number): string {
  return JSON.stringify(
    {
      name: `${name}-devcontainer`,
      dockerComposeFile: './docker-compose.yml',
      service: `${name}-dev`,
      workspaceFolder: '/workspace',
      shutdownAction: 'stopCompose',
      overrideCommand: true,
      remoteUser: 'node',
      updateRemoteUserUID: true,
      mounts: [
        'source=../,target=//workspace,type=bind',
        `source=\${localEnv:HOME}/.devcontainers/mount/${name}/secrets,target=/home/node/.secrets,type=bind`,
        `source=\${localEnv:HOME}/.devcontainers/mount/${name}/claude,target=/home/node/.claude,type=bind`,
        'source=${localEnv:HOME}/.ssh,target=/home/node/.ssh,type=bind',
        'source=${localEnv:HOME}/.git,target=/home/node/.git,type=bind',
      ],
      forwardPorts: [port],
      containerEnv: { POD_NAME: 'local', LANE: 'local' },
      runArgs: ['--cap-add=NET_ADMIN', '--cap-add=NET_RAW'],
      customizations: {
        vscode: {
          settings: {
            'terminal.integrated.defaultProfile.linux': 'bash',
            'remote.autoForwardPorts': true,
            'remote.autoForwardPortsSource': 'process',
          },
          extensions: ['biomejs.biome', 'anthropic.claude-code', 'apollographql.vscode-apollo', 'Vue.volar'],
        },
      },
    },
    null,
    2,
  )
}

function generateDockerfile(nodeVersion: string): string {
  return `FROM mcr.microsoft.com/devcontainers/javascript-node:dev-${nodeVersion}

RUN apt-get update \\
  && apt-get install -y \\
  docker.io \\
  postgresql-client \\
  direnv \\
  && rm -rf /var/lib/apt/lists/* \\
  && curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh | sh -s -- --install-method standalone \\
  && echo 'eval "$(direnv hook bash)"' >> /home/node/.bashrc \\
  && npm install -g @anthropic-ai/claude-code

RUN usermod -aG docker node

RUN mkdir -p /workspace && chown node:node /workspace

USER node

WORKDIR /workspace

CMD [ "sleep", "infinity" ]
`
}

function generateDockerCompose(
  name: string,
  manifest: ShipManifest,
  port: number,
  pgVersion: string,
  kcVersion: string,
  needs: Record<string, boolean>,
): string {
  const lines: string[] = [`name: ${name}`, '', 'services:']

  // Dev container
  const envVars: string[] = ['      SHELL: /bin/bash', '      WORKDIR: /workspace']
  if (needs.minio) {
    envVars.push('      S3_ENDPOINT: http://minio:9000')
    envVars.push('      S3_ACCESS_KEY: minioadmin')
    envVars.push('      S3_SECRET_KEY: minioadmin')
    envVars.push(`      S3_BUCKET: ${name}-docs`)
  }
  if (needs.conductor) envVars.push('      CONDUCTOR_URL: http://conductor:8080/api')
  if (needs.postgres) envVars.push(`      DATABASE_URL: postgresql://${name}:${name}_dev@postgres:5432/${name}`)
  if (needs.redpanda) {
    envVars.push('      KAFKA_BROKERS: redpanda:29092')
    envVars.push('      SCHEMA_REGISTRY_URL: http://redpanda:8083')
  }
  if (needs.mailhog) {
    envVars.push('      SMTP_HOST: mailhog')
    envVars.push('      SMTP_PORT: "1025"')
    envVars.push('      SMTP_SECURE: "false"')
  }
  if (needs.keycloak) {
    envVars.push(`      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: ${name}-app`)
    envVars.push(`      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: "${name}-local-dev-oidc-secret"`)
    envVars.push(
      `      NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: http://localhost:${port}/infra/idp/realms/global/protocol/openid-connect/auth`,
    )
    envVars.push(
      '      NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: http://keycloak:8080/infra/idp/realms/global/protocol/openid-connect/token',
    )
    envVars.push(
      '      NUXT_OIDC_PROVIDERS_OIDC_USERINFO_URL: http://keycloak:8080/infra/idp/realms/global/protocol/openid-connect/userinfo',
    )
    envVars.push(
      `      NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL: http://localhost:${port}/infra/idp/realms/global/protocol/openid-connect/logout`,
    )
    envVars.push(`      NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: http://localhost:${port}/app/auth/oidc/callback`)
    envVars.push(
      '      NUXT_OIDC_PROVIDERS_OIDC_OPENID_CONFIGURATION: http://keycloak:8080/infra/idp/realms/global/.well-known/openid-configuration',
    )
    envVars.push(`      KEYCLOAK_ADMIN_API_CLIENT_ID: ${name}-admin-api`)
    envVars.push(`      KEYCLOAK_ADMIN_API_CLIENT_SECRET: "${name}-local-dev-admin-api-secret"`)
    envVars.push('      KEYCLOAK_ADMIN_API_URL: http://keycloak:8080/infra/idp')
  }
  // Per-service env vars for subgraph URLs
  for (const svc of manifest.services) {
    if (svc.type === 'graphql-subgraph') {
      envVars.push(`      ${svc.name.toUpperCase()}_URL: http://localhost:${svc.port}/graphql`)
    }
  }

  lines.push(`  ${name}-dev:`)
  lines.push(`    container_name: ${name}-dev`)
  lines.push('    stdin_open: true')
  lines.push('    tty: true')
  lines.push('    build:')
  lines.push('      context: "../"')
  lines.push('      dockerfile: ".devcontainer/Dockerfile.devcontainer"')
  lines.push('    environment:')
  lines.push(envVars.join('\n'))
  lines.push('    volumes:')
  lines.push('      - ..:/workspace')
  lines.push('      - /var/run/docker.sock:/var/run/docker.sock')
  lines.push('')

  // Traefik
  lines.push('  traefik:')
  lines.push('    image: traefik:v3.3')
  lines.push(`    container_name: ${name}-traefik`)
  lines.push('    restart: unless-stopped')
  lines.push('    ports:')
  lines.push(`      - "${port}:80"`)
  lines.push('    volumes:')
  lines.push('      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro')
  lines.push('      - ./traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro')
  lines.push('    depends_on:')
  lines.push(`      - ${name}-dev`)
  lines.push('')

  if (needs.postgres) {
    lines.push('  postgres:')
    lines.push(`    image: postgres:${pgVersion}`)
    lines.push(`    container_name: ${name}-postgres`)
    lines.push('    restart: unless-stopped')
    if (needs.debezium) {
      lines.push('    command: postgres -c wal_level=logical -c max_replication_slots=4 -c max_wal_senders=4')
    }
    lines.push('    environment:')
    lines.push(`      POSTGRES_USER: ${name}`)
    lines.push(`      POSTGRES_PASSWORD: ${name}_dev`)
    lines.push(`      POSTGRES_DB: ${name}`)
    lines.push('    volumes:')
    lines.push('      - ./data/postgres:/var/lib/postgresql/data')
    lines.push('      - ./postgres/init-databases.sql:/docker-entrypoint-initdb.d/01-init-databases.sql:ro')
    if (needs.debezium) {
      lines.push('      - ./postgres/01-enable-replication.sh:/docker-entrypoint-initdb.d/02-enable-replication.sh:ro')
    }
    lines.push('    healthcheck:')
    lines.push(`      test: ["CMD-SHELL", "pg_isready -U ${name}"]`)
    lines.push('      interval: 10s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 5')
    lines.push('')
  }

  if (needs.redis) {
    lines.push('  redis:')
    lines.push('    image: redis:7-alpine')
    lines.push(`    container_name: ${name}-redis`)
    lines.push('    restart: unless-stopped')
    lines.push('    volumes:')
    lines.push('      - ./data/redis:/data')
    lines.push('    healthcheck:')
    lines.push('      test: ["CMD", "redis-cli", "ping"]')
    lines.push('      interval: 10s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 5')
    lines.push('')
  }

  if (needs.minio) {
    lines.push('  minio:')
    lines.push('    image: minio/minio:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    environment:')
    lines.push('      MINIO_ROOT_USER: minioadmin')
    lines.push('      MINIO_ROOT_PASSWORD: minioadmin')
    lines.push('    command: server /data --console-address ":9001"')
    lines.push('    volumes:')
    lines.push('      - ./data/s3:/data')
    lines.push('    healthcheck:')
    lines.push('      test: ["CMD", "mc", "ready", "local"]')
    lines.push('      interval: 10s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 5')
    lines.push('')
  }

  if (needs.keycloak) {
    lines.push('  keycloak:')
    lines.push(`    image: quay.io/keycloak/keycloak:${kcVersion}`)
    lines.push('    command:')
    lines.push('      - start-dev')
    lines.push('      - --http-relative-path=/infra/idp')
    lines.push('      - --features=preview,admin-fine-grained-authz,token-exchange,impersonation')
    lines.push('      - --hostname-strict=false')
    lines.push('      - --health-enabled=true')
    lines.push('      - --http-management-health-enabled=false')
    lines.push('    environment:')
    lines.push('      KC_DB: postgres')
    lines.push('      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak')
    lines.push('      KC_DB_USERNAME: keycloak')
    lines.push('      KC_DB_PASSWORD: keycloak_dev')
    lines.push('      KC_HTTP_ENABLED: "true"')
    lines.push('      KC_HOSTNAME_STRICT: "false"')
    lines.push('      KC_BOOTSTRAP_ADMIN_USERNAME: admin')
    lines.push('      KC_BOOTSTRAP_ADMIN_PASSWORD: admin')
    lines.push('      KC_PROXY: edge')
    lines.push('      KC_MAIL_HOST: mailhog')
    lines.push('      KC_MAIL_PORT: 1025')
    lines.push(`      KC_MAIL_FROM: "noreply@${name}.local"`)
    lines.push('    restart: unless-stopped')
    lines.push('    depends_on:')
    lines.push('      postgres:')
    lines.push('        condition: service_healthy')
    lines.push('    volumes:')
    lines.push('      - ./data/keycloak:/opt/keycloak/data')
    lines.push('    healthcheck:')
    lines.push(
      '      test: ["CMD-SHELL", "{ printf \'HEAD /infra/idp/health/ready HTTP/1.0\\\\r\\\\n\\\\r\\\\n\' >&0; grep \'HTTP/1.0 200\'; } 0<>/dev/tcp/localhost/8080"]',
    )
    lines.push('      interval: 10s')
    lines.push('      timeout: 20s')
    lines.push('      retries: 5')
    lines.push('')
  }

  if (needs.mailhog) {
    lines.push('  mailhog:')
    lines.push('    image: mailhog/mailhog:latest')
    lines.push('    restart: unless-stopped')
    lines.push('')
  }

  if (needs.redpanda) {
    lines.push('  redpanda:')
    lines.push('    image: docker.redpanda.com/redpandadata/redpanda:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    command:')
    lines.push('      - redpanda start')
    lines.push('      - --overprovisioned')
    lines.push('      - --smp 1')
    lines.push('      - --memory 1G')
    lines.push('      - --reserve-memory 0M')
    lines.push('      - --node-id 0')
    lines.push('      - --check=false')
    lines.push('      - --kafka-addr PLAINTEXT://0.0.0.0:29092,OUTSIDE://0.0.0.0:9092')
    lines.push('      - --advertise-kafka-addr PLAINTEXT://redpanda:29092,OUTSIDE://localhost:9092')
    lines.push('      - --pandaproxy-addr 0.0.0.0:8082')
    lines.push('      - --advertise-pandaproxy-addr redpanda:8082')
    lines.push('      - --schema-registry-addr 0.0.0.0:8083')
    lines.push('      - --mode dev-container')
    lines.push('    volumes:')
    lines.push('      - ./data/redpanda:/var/lib/redpanda/data')
    lines.push('    healthcheck:')
    lines.push('      test: ["CMD-SHELL", "rpk cluster health --api-urls localhost:9644 | grep -q \'Healthy:.*true\'"]')
    lines.push('      interval: 10s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 5')
    lines.push('')

    lines.push('  redpanda-console:')
    lines.push('    image: docker.redpanda.com/redpandadata/console:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    entrypoint: /bin/sh')
    lines.push('    command: -c \'echo "$$CONSOLE_CONFIG_FILE" > /tmp/config.yml && /app/console\'')
    lines.push('    environment:')
    lines.push('      CONFIG_FILEPATH: /tmp/config.yml')
    lines.push('      CONSOLE_CONFIG_FILE: |')
    lines.push('        kafka:')
    lines.push('          brokers: ["redpanda:29092"]')
    lines.push('        schemaRegistry:')
    lines.push('          enabled: true')
    lines.push('          urls: ["http://redpanda:8083"]')
    lines.push('        server:')
    lines.push('          basePath: /infra/redpanda')
    lines.push('          setBasePathFromXForwardedPrefix: false')
    lines.push('          stripPrefix: true')
    lines.push('    depends_on:')
    lines.push('      redpanda:')
    lines.push('        condition: service_healthy')
    lines.push('')
  }

  if (needs.conductor) {
    lines.push('  conductor:')
    lines.push('    build:')
    lines.push('      context: ./conductor')
    lines.push(`    image: ${name}-conductor:local`)
    lines.push('    restart: unless-stopped')
    lines.push('    environment:')
    lines.push('      CONFIG_PROP: /app/config/config.properties')
    lines.push('    volumes:')
    lines.push('      - ./conductor/config.properties:/app/config/config.properties:ro')
    lines.push('    depends_on:')
    if (needs.postgres) {
      lines.push('      postgres:')
      lines.push('        condition: service_healthy')
    }
    if (needs.redis) {
      lines.push('      redis:')
      lines.push('        condition: service_healthy')
    }
    lines.push('    healthcheck:')
    lines.push('      test: ["CMD-SHELL", "curl -sf http://localhost:8080/health || exit 1"]')
    lines.push('      interval: 15s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 10')
    lines.push('')

    lines.push('  conductor-ui:')
    lines.push('    build:')
    lines.push('      context: ./conductor-ui')
    lines.push(`    image: ${name}-conductor-ui:local`)
    lines.push('    restart: unless-stopped')
    lines.push('    depends_on:')
    lines.push('      - conductor')
    lines.push('')
  }

  if (needs.debezium) {
    lines.push('  debezium-connect:')
    lines.push('    image: debezium/connect:2.5')
    lines.push('    restart: unless-stopped')
    lines.push('    environment:')
    lines.push('      BOOTSTRAP_SERVERS: redpanda:29092')
    lines.push('      GROUP_ID: 1')
    lines.push('      CONFIG_STORAGE_TOPIC: _debezium_connect_configs')
    lines.push('      OFFSET_STORAGE_TOPIC: _debezium_connect_offsets')
    lines.push('      STATUS_STORAGE_TOPIC: _debezium_connect_statuses')
    lines.push('      CONFIG_STORAGE_REPLICATION_FACTOR: 1')
    lines.push('      OFFSET_STORAGE_REPLICATION_FACTOR: 1')
    lines.push('      STATUS_STORAGE_REPLICATION_FACTOR: 1')
    lines.push('    depends_on:')
    lines.push('      postgres:')
    lines.push('        condition: service_healthy')
    lines.push('      redpanda:')
    lines.push('        condition: service_healthy')
    lines.push('    healthcheck:')
    lines.push('      test: ["CMD-SHELL", "curl -sf http://localhost:8083/ || exit 1"]')
    lines.push('      interval: 15s')
    lines.push('      timeout: 5s')
    lines.push('      retries: 10')
    lines.push('')
  }

  if (needs.observability) {
    lines.push('  tempo:')
    lines.push('    image: grafana/tempo:2.7.2')
    lines.push('    restart: unless-stopped')
    lines.push('    volumes:')
    lines.push('      - ./tempo/tempo.yml:/etc/tempo/tempo.yml:ro')
    lines.push('      - ./data/tempo:/var/tempo')
    lines.push('    command: ["-config.file=/etc/tempo/tempo.yml"]')
    lines.push('')

    lines.push('  prometheus:')
    lines.push('    image: prom/prometheus:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    entrypoint:')
    lines.push('      - sh')
    lines.push('      - -c')
    lines.push('      - |')
    lines.push("        cat <<'EOF' > /etc/prometheus/prometheus.yml")
    lines.push('        global:')
    lines.push('          scrape_interval: 5s')
    lines.push('        scrape_configs:')
    if (needs.conductor) {
      lines.push('          - job_name: "conductor"')
      lines.push('            metrics_path: "/actuator/prometheus"')
      lines.push('            static_configs:')
      lines.push('              - targets: ["conductor:8080"]')
    }
    lines.push('        EOF')
    lines.push('        exec /bin/prometheus --config.file=/etc/prometheus/prometheus.yml')
    lines.push('')

    lines.push('  loki:')
    lines.push('    image: grafana/loki:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    command: -config.file=/etc/loki/local-config.yaml')
    lines.push('')

    lines.push('  promtail:')
    lines.push('    image: grafana/promtail:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    volumes:')
    lines.push('      - ./promtail/config.yml:/etc/promtail/config.yml:ro')
    lines.push('      - /var/lib/docker/containers:/var/lib/docker/containers:ro')
    lines.push('      - /var/run/docker.sock:/var/run/docker.sock:ro')
    lines.push('    command: -config.file=/etc/promtail/config.yml')
    lines.push('    depends_on:')
    lines.push('      - loki')
    lines.push('')

    lines.push('  grafana:')
    lines.push('    image: grafana/grafana:latest')
    lines.push('    restart: unless-stopped')
    lines.push('    environment:')
    lines.push(`      GF_SERVER_ROOT_URL: http://localhost:${port}/infra/grafana`)
    lines.push('      GF_SERVER_SERVE_FROM_SUB_PATH: "true"')
    lines.push('      GF_AUTH_ANONYMOUS_ENABLED: "true"')
    lines.push('      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin')
    lines.push('    volumes:')
    lines.push('      - ./grafana/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro')
    lines.push('      - ./grafana/dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml:ro')
    lines.push('      - ./data/grafana:/var/lib/grafana')
    lines.push('    depends_on:')
    lines.push('      - prometheus')
    lines.push('      - loki')
    lines.push('      - tempo')
    lines.push('')
  }

  return lines.join('\n') + '\n'
}

function generateTraefikDynamic(name: string, manifest: ShipManifest, needs: Record<string, boolean>): string {
  const routers: string[] = []
  const middlewares: string[] = []
  const services: string[] = []

  // Root redirect
  routers.push(`    root-redirect:
      rule: "Path(\`/\`)"
      entryPoints: [web]
      service: noop@internal
      middlewares: [redirect-to-app]`)

  middlewares.push(`    redirect-to-app:
      redirectRegex:
        regex: "^(https?://[^/]*)/$"
        replacement: "\${1}/app/"
        permanent: false`)

  // App frontend
  routers.push(`    app:
      rule: "PathPrefix(\`/app\`)"
      entryPoints: [web]
      service: app`)

  services.push(`    app:
      loadBalancer:
        servers:
          - url: "http://${name}-dev:3000"`)

  // Gateway
  const gateway = manifest.services.find((s) => s.type === 'graphql-gateway')
  if (gateway) {
    routers.push(`    api-gateway:
      rule: "PathPrefix(\`/api/graphql\`) || PathPrefix(\`/api/graphiql\`)"
      entryPoints: [web]
      service: gateway
      middlewares: [strip-api]`)

    middlewares.push(`    strip-api:
      stripPrefix:
        prefixes: ["/api"]`)

    services.push(`    gateway:
      loadBalancer:
        servers:
          - url: "http://${name}-dev:${gateway.port}"`)
  }

  // Subgraph services
  for (const svc of manifest.services) {
    if (svc.type === 'graphql-subgraph') {
      routers.push(`    api-${svc.name}:
      rule: "PathPrefix(\`/api/${svc.name}\`)"
      entryPoints: [web]
      service: ${svc.name}
      middlewares: [strip-api-${svc.name}]`)

      middlewares.push(`    strip-api-${svc.name}:
      stripPrefix:
        prefixes: ["/api/${svc.name}"]`)

      services.push(`    ${svc.name}:
      loadBalancer:
        servers:
          - url: "http://${name}-dev:${svc.port}"`)
    }
  }

  // Infrastructure services
  if (needs.keycloak) {
    routers.push(`    infra-idp:
      rule: "PathPrefix(\`/infra/idp\`)"
      entryPoints: [web]
      service: keycloak`)
    services.push(`    keycloak:
      loadBalancer:
        servers:
          - url: "http://keycloak:8080"`)
  }

  if (needs.mailhog) {
    routers.push(`    infra-mailhog:
      rule: "PathPrefix(\`/infra/mailhog\`)"
      entryPoints: [web]
      service: mailhog
      middlewares: [strip-infra-mailhog]`)
    middlewares.push(`    strip-infra-mailhog:
      stripPrefix:
        prefixes: ["/infra/mailhog"]`)
    services.push(`    mailhog:
      loadBalancer:
        servers:
          - url: "http://mailhog:8025"`)
  }

  if (needs.observability) {
    routers.push(`    infra-grafana:
      rule: "PathPrefix(\`/infra/grafana\`)"
      entryPoints: [web]
      service: grafana`)
    services.push(`    grafana:
      loadBalancer:
        servers:
          - url: "http://grafana:3000"`)
  }

  if (needs.conductor) {
    routers.push(`    infra-conductor:
      rule: "PathPrefix(\`/infra/conductor\`)"
      entryPoints: [web]
      service: conductor-ui`)
    services.push(`    conductor-ui:
      loadBalancer:
        servers:
          - url: "http://conductor-ui:5000"`)
  }

  if (needs.redpanda) {
    routers.push(`    infra-redpanda:
      rule: "PathPrefix(\`/infra/redpanda\`)"
      entryPoints: [web]
      service: redpanda-console`)
    services.push(`    redpanda-console:
      loadBalancer:
        servers:
          - url: "http://redpanda-console:8080"`)
  }

  return `http:
  routers:
${routers.join('\n\n')}

  middlewares:
${middlewares.join('\n\n')}

  services:
${services.join('\n\n')}
`
}

function generatePostgresInit(name: string, _manifest: ShipManifest, needs: Record<string, boolean>): string {
  const lines: string[] = []

  if (needs.keycloak) {
    lines.push(`-- Keycloak database
CREATE DATABASE keycloak;
CREATE USER keycloak WITH ENCRYPTED PASSWORD 'keycloak_dev';
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
ALTER DATABASE keycloak OWNER TO keycloak;
`)
  }

  if (needs.conductor) {
    lines.push(`-- Conductor database
CREATE DATABASE conductor;
CREATE USER conductor WITH ENCRYPTED PASSWORD 'conductor_dev' REPLICATION;
GRANT ALL PRIVILEGES ON DATABASE conductor TO conductor;
ALTER DATABASE conductor OWNER TO conductor;
`)
  }

  if (needs.debezium) {
    lines.push(`-- CDC database
CREATE DATABASE conductor_cdc;
GRANT ALL PRIVILEGES ON DATABASE conductor_cdc TO ${name};
ALTER USER conductor WITH REPLICATION;
`)
  }

  // Per-service schemas and roles
  for (const svc of _manifest.services) {
    if (svc.type === 'graphql-subgraph' && svc.schema) {
      lines.push(`-- ${svc.name} service
CREATE USER ${svc.name}_svc WITH ENCRYPTED PASSWORD '${svc.name}_dev';
GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${svc.name}_svc;
`)
    }
  }

  return lines.join('\n')
}

function generateInitScript(name: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

# Idempotent bootstrap for ${name} local dev environment

echo "[init] Installing dependencies..."
pnpm install

echo "[init] Building packages..."
pnpm build

echo "[init] Done. Run 'pnpm dev' to start."
`
}

function generateDestroyScript(name: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

# Tear down all persistent state for ${name}

echo "[destroy] Removing devcontainer data volumes..."
rm -rf .devcontainer/data

echo "[destroy] Done. Rebuild with 'docker compose up --build'."
`
}

// ── Static config file contents ─────────────────────────────────────────────

const TRAEFIK_STATIC = `entryPoints:
  web:
    address: ":80"

api:
  dashboard: true
  insecure: true

providers:
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

log:
  level: INFO
`

const ENABLE_REPLICATION_SH = `#!/bin/bash
# Allow replication connections from the Docker network for Debezium CDC
echo "host replication conductor 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
`

const CONDUCTOR_DOCKERFILE = `FROM conductoross/conductor:3.22.0

RUN curl -sSL -o /opt/opentelemetry-javaagent.jar \\
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.12.0/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:/opt/opentelemetry-javaagent.jar" \\
    OTEL_SERVICE_NAME=conductor \\
    OTEL_TRACES_EXPORTER=otlp \\
    OTEL_METRICS_EXPORTER=none \\
    OTEL_LOGS_EXPORTER=none \\
    OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317
`

const CONDUCTOR_CONFIG = `# Conductor Server Configuration
conductor.db.type=postgres
spring.datasource.url=jdbc:postgresql://postgres:5432/conductor
spring.datasource.username=conductor
spring.datasource.password=conductor_dev

conductor.queue.type=redis_standalone
conductor.redis.hosts=redis:6379
conductor.redis-lock.serverAddress=redis://redis:6379

conductor.indexing.enabled=false

conductor.metrics-prometheus.enabled=true
management.endpoints.web.exposure.include=health,info,prometheus
management.endpoint.health.show-details=always

conductor.app.workflowOffsetTimeout.seconds=5
conductor.app.activeWorkerLastPollTimeout.seconds=5
`

const CONDUCTOR_UI_DOCKERFILE = `FROM node:18-alpine AS build
RUN apk add --no-cache git python3 make g++
WORKDIR /app
RUN git clone --depth 1 https://github.com/conductor-oss/conductor.git /tmp/conductor && \\
    cp -r /tmp/conductor/ui/. /app/ && \\
    rm -rf /tmp/conductor

RUN sed -i '/"name"/a\\  "homepage": "http://localhost/infra/conductor/",' package.json

RUN corepack enable && yarn install --frozen-lockfile
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html/infra/conductor
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5000
`

const CONDUCTOR_UI_NGINX = `server {
    listen 5000;

    location /infra/conductor/static {
        alias /usr/share/nginx/html/infra/conductor/static;
    }

    location /infra/conductor/api {
        proxy_pass http://conductor:8080/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /infra/conductor {
        alias /usr/share/nginx/html/infra/conductor;
        try_files $uri $uri/ /infra/conductor/index.html;
    }
}
`

const GRAFANA_DATASOURCES = `apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    editable: true
`

const GRAFANA_DASHBOARDS = `apiVersion: 1
providers:
  - name: default
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
`

const TEMPO_CONFIG = `stream_over_http_enabled: true

server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: "0.0.0.0:4317"
        http:
          endpoint: "0.0.0.0:4318"

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
    wal:
      path: /var/tempo/wal
`

const PROMTAIL_CONFIG = `server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: container
        regex: '/(.*)'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: stream
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, (_, c, i) => (i === 0 ? c.toLowerCase() : `_${c.toLowerCase()}`))
}

function toCamelCase(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
