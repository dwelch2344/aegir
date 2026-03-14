import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { loadCatalog, resolvePatternOrder, collectCapabilities } from './catalog-reader.js'

const catalogDir = resolve(import.meta.dirname, '../../../catalog')

describe('Catalog Reader', () => {
  it('loads all catalog entries', () => {
    const catalog = loadCatalog(catalogDir)
    expect(catalog.size).toBeGreaterThanOrEqual(14)
    expect(catalog.has('build.pnpm-turbo')).toBe(true)
    expect(catalog.has('auth.oidc-keycloak')).toBe(true)
  })

  it('resolves pattern order respecting preconditions', () => {
    const catalog = loadCatalog(catalogDir)
    const sorted = resolvePatternOrder(['auth.oidc-keycloak', 'harness.devcontainer'], catalog)

    // harness.devcontainer must come before auth.oidc-keycloak
    const harnesIdx = sorted.findIndex((p) => p.id === 'harness.devcontainer')
    const authIdx = sorted.findIndex((p) => p.id === 'auth.oidc-keycloak')
    expect(harnesIdx).toBeLessThan(authIdx)
  })

  it('throws on missing precondition', () => {
    const catalog = loadCatalog(catalogDir)
    // auth.oidc-keycloak requires harness.devcontainer
    expect(() => resolvePatternOrder(['auth.oidc-keycloak'], catalog)).toThrow(/precondition.*harness\.devcontainer/)
  })

  it('throws on missing pattern', () => {
    const catalog = loadCatalog(catalogDir)
    expect(() => resolvePatternOrder(['nonexistent.pattern'], catalog)).toThrow(/not found in catalog/)
  })

  it('collects capabilities from entries', () => {
    const catalog = loadCatalog(catalogDir)
    const entries = [catalog.get('build.pnpm-turbo')!, catalog.get('auth.oidc-keycloak')!]
    const caps = collectCapabilities(entries)
    expect(caps).toContain('monorepo.workspace')
    expect(caps).toContain('auth.oidc')
  })

  it('resolves the full saas profile pattern set', () => {
    const catalog = loadCatalog(catalogDir)
    const saasPatterns = [
      'build.pnpm-turbo',
      'harness.devcontainer',
      'db.postgres-isolated',
      'api.graphql-federation',
      'auth.oidc-keycloak',
      'tenancy.org-based',
      'frontend.nuxt-spa',
      'orchestration.conductor',
      'cdc.debezium-kafka',
      'observability.grafana-stack',
      'storage.s3',
      'email.smtp',
      'agents.ai-conversation',
    ]

    const sorted = resolvePatternOrder(saasPatterns, catalog)
    expect(sorted).toHaveLength(13)

    // Verify ordering constraints
    const indexOf = (id: string) => sorted.findIndex((p) => p.id === id)
    expect(indexOf('build.pnpm-turbo')).toBeLessThan(indexOf('harness.devcontainer'))
    expect(indexOf('harness.devcontainer')).toBeLessThan(indexOf('auth.oidc-keycloak'))
    expect(indexOf('auth.oidc-keycloak')).toBeLessThan(indexOf('tenancy.org-based'))
  })
})
