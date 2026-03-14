import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { scaffold } from './scaffolder.js'
import { apply } from './applicator.js'

const TEST_DIR = resolve('/tmp/shipyard-applicator-test')
const CATALOG_DIR = resolve('/workspace/catalog')
const PROFILES_DIR = resolve('/workspace/profiles')

describe('applicator', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  function scaffoldShip(name = 'test-app') {
    const outputDir = join(TEST_DIR, name)
    scaffold({
      name,
      profilePath: join(PROFILES_DIR, 'saas.yaml'),
      catalogDir: CATALOG_DIR,
      outputDir,
    })
    return outputDir
  }

  it('applies service.domain-subgraph to a scaffolded ship', () => {
    const shipDir = scaffoldShip()
    const result = apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: {
        service_name: 'billing',
        port: 4002,
        entity_name: 'Invoice',
        entity_fields: 'key:string,name:string,amount:number',
      },
    })

    expect(result.pattern.id).toBe('service.domain-subgraph')
    expect(result.files).toContain('services/billing/src/schema.ts')
    expect(result.files).toContain('services/billing/src/resolvers.ts')
    expect(result.files).toContain('services/billing/src/app.ts')
    expect(result.files).toContain('packages/domain/src/invoice.ts')
    expect(result.files).toContain('services/gateway/src/app.ts')
    expect(result.newCapabilities).toContain('domain-service')
  })

  it('generates correct domain type', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: {
        service_name: 'billing',
        port: 4002,
        entity_name: 'Invoice',
        entity_fields: 'key:string,name:string,amount:number,paid:boolean',
      },
    })

    const domainType = readFileSync(join(shipDir, 'packages/domain/src/invoice.ts'), 'utf-8')
    expect(domainType).toContain('export interface Invoice')
    expect(domainType).toContain('amount: number')
    expect(domainType).toContain('paid: boolean')
    expect(domainType).toContain('createdAt: Date')
  })

  it('generates namespaced GraphQL schema', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
    })

    const schema = readFileSync(join(shipDir, 'services/billing/src/schema.ts'), 'utf-8')
    expect(schema).toContain('type Invoice @key(fields: "id")')
    expect(schema).toContain('type BillingInvoiceSearch')
    expect(schema).toContain('input BillingInvoiceSearchInput')
    expect(schema).toContain('type BillingInvoices')
    expect(schema).toContain('type Billing')
    expect(schema).toContain('billing: Billing!')
  })

  it('registers new service in gateway', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
    })

    const gatewayApp = readFileSync(join(shipDir, 'services/gateway/src/app.ts'), 'utf-8')
    expect(gatewayApp).toContain("name: 'billing'")
    expect(gatewayApp).toContain('http://localhost:4002/graphql')
  })

  it('updates manifest with new service and capabilities', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
    })

    const manifest = parse(readFileSync(join(shipDir, 'shipyard.manifest'), 'utf-8'))
    const billingService = manifest.services.find((s: { name: string }) => s.name === 'billing')
    expect(billingService).toBeDefined()
    expect(billingService.port).toBe(4002)
    expect(billingService.type).toBe('graphql-subgraph')
    expect(manifest.capabilities).toContain('domain-service')
    const subgraphRef = manifest.catalog_refs.find((r: { id: string }) => r.id === 'service.domain-subgraph')
    expect(subgraphRef).toBeDefined()
  })

  it('allows applying multiple domain subgraphs', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
    })
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'inventory', port: 4003, entity_name: 'Product' },
    })

    expect(existsSync(join(shipDir, 'services/billing/src/schema.ts'))).toBe(true)
    expect(existsSync(join(shipDir, 'services/inventory/src/schema.ts'))).toBe(true)

    const manifest = parse(readFileSync(join(shipDir, 'shipyard.manifest'), 'utf-8'))
    expect(manifest.services).toHaveLength(4) // gateway + iam + billing + inventory
  })

  it('rejects duplicate service name', () => {
    const shipDir = scaffoldShip()
    apply({
      shipDir,
      catalogDir: CATALOG_DIR,
      patternId: 'service.domain-subgraph',
      params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
    })

    expect(() =>
      apply({
        shipDir,
        catalogDir: CATALOG_DIR,
        patternId: 'service.domain-subgraph',
        params: { service_name: 'billing', port: 4003, entity_name: 'Order' },
      }),
    ).toThrow('Service "billing" already exists')
  })

  it('rejects missing required parameters', () => {
    const shipDir = scaffoldShip()
    expect(() =>
      apply({
        shipDir,
        catalogDir: CATALOG_DIR,
        patternId: 'service.domain-subgraph',
        params: {},
      }),
    ).toThrow('Missing required parameter')
  })

  it('rejects when preconditions not met', () => {
    // Create a bare-bones ship without the required preconditions
    const shipDir = join(TEST_DIR, 'bare-ship')
    mkdirSync(shipDir, { recursive: true })
    const { stringify } = require('yaml')
    const manifestContent = `shipyard_version: "0.1"\nname: bare\ntype: api\nstack:\n  languages:\n    - typescript\n  runtime: node-22\nservices: []\ncatalog_refs: []\ncapabilities: []\n`
    require('node:fs').writeFileSync(join(shipDir, 'shipyard.manifest'), manifestContent)

    expect(() =>
      apply({
        shipDir,
        catalogDir: CATALOG_DIR,
        patternId: 'service.domain-subgraph',
        params: { service_name: 'billing', port: 4002, entity_name: 'Invoice' },
      }),
    ).toThrow('Precondition not met')
  })
})
