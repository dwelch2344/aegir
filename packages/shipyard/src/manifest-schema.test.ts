import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { manifestSchema } from './manifest-schema.js'

describe('Manifest Schema', () => {
  it('validates a minimal manifest', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'my-ship',
      type: 'api',
      stack: {
        languages: ['typescript'],
        runtime: 'node-22',
      },
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(true)
  })

  it("validates aegir's own manifest", () => {
    const raw = readFileSync(resolve(import.meta.dirname, '../../../shipyard.manifest'), 'utf-8')
    const data = parse(raw)
    const result = manifestSchema.safeParse(data)

    if (!result.success) {
      console.error(result.error.issues)
    }

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.name).toBe('aegir')
      expect(result.data.type).toBe('web-app')
      expect(result.data.services).toHaveLength(5)
      expect(result.data.catalog_refs).toHaveLength(14)
      expect(result.data.capabilities).toContain('graphql-federation')
      expect(result.data.capabilities).toContain('oidc-auth')
      expect(result.data.conventions.graphql_naming).toBe('moribashi')
    }
  })

  it('rejects empty name', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: '',
      type: 'api',
      stack: { languages: ['typescript'], runtime: 'node-22' },
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid name format (uppercase)', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'MyShip',
      type: 'api',
      stack: { languages: ['typescript'], runtime: 'node-22' },
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid service port (below 1024)', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'my-ship',
      type: 'api',
      stack: { languages: ['typescript'], runtime: 'node-22' },
      services: [{ name: 'api', type: 'graphql-subgraph', port: 80 }],
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid catalog ref ID format', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'my-ship',
      type: 'api',
      stack: { languages: ['typescript'], runtime: 'node-22' },
      catalog_refs: [{ id: 'invalid', version: '0.1.0' }],
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid semver in catalog ref', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'my-ship',
      type: 'api',
      stack: { languages: ['typescript'], runtime: 'node-22' },
      catalog_refs: [{ id: 'auth.keycloak', version: 'v1' }],
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })

  it('rejects missing stack languages', () => {
    const manifest = {
      shipyard_version: '0.1',
      name: 'my-ship',
      type: 'api',
      stack: { languages: [], runtime: 'node-22' },
    }

    const result = manifestSchema.safeParse(manifest)
    expect(result.success).toBe(false)
  })
})
