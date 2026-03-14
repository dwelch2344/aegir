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
      throw new Error(`Service "${serviceName}" already exists in this ship. ` + `Choose a different --name.`)
    }
  } else if (existingPatternIds.has(patternId)) {
    throw new Error(
      `Pattern "${patternId}" is already applied to this ship. ` +
        `To re-apply, first remove it from catalog_refs in shipyard.manifest.`,
    )
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
