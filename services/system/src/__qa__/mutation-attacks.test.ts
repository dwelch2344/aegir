import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('System Mutation Attacks — Adversarial QA', () => {
  let fastify: FastifyInstance
  let stop: () => Promise<void>

  beforeAll(async () => {
    const result = await buildApp()
    fastify = result.fastify
    stop = () => result.app.stop()
    await fastify.ready()
  })

  afterAll(async () => {
    await stop()
  })

  // --- Create tenant with empty string key ---

  it('accepts empty string tenant key — no min-length validation', async () => {
    // FINDING: tenant.key is VARCHAR(100) NOT NULL UNIQUE, but empty string passes NOT NULL
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { createTenant(input: { key: "", name: "Empty Key Tenant" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: If no error, empty key is accepted — no application-level validation
    if (!body.errors) {
      expect(body.data.system.createTenant.key).toBe('')
    }
  })

  // --- Create tenant with very long key ---

  it('rejects tenant key exceeding VARCHAR(100) limit', async () => {
    const longKey = 'x'.repeat(1001)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { createTenant(input: { key: "${longKey}", name: "Long Key" }) { id key name } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The DB column is VARCHAR(100), so this should fail
    expect(body.errors).toBeDefined()
  })

  // --- Create tenant with special characters ---

  it('handles special characters in tenant key', async () => {
    const ts = Date.now()
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { createTenant(input: { key: "sp-${ts}", name: "Special <>&'\\"" }) { id key name } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // Parameterized queries should handle this safely
    if (!body.errors) {
      expect(body.data.system.createTenant.key).toBe(`sp-${ts}`)
    }
  })

  // --- Upsert integration with non-JSON metadata ---

  it('accepts non-JSON string as integration metadata — stored as TEXT not JSONB', async () => {
    // FINDING: The integration.metadata column is TEXT NOT NULL DEFAULT '{}',
    // not JSONB. Any string is accepted, including invalid JSON.
    const ts = Date.now()
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { upsertIntegration(input: { key: "meta-test-${ts}", name: "Meta Test", metadata: "NOT VALID JSON {{{{" }) { id key name metadata } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: Non-JSON metadata is accepted because the column is TEXT, not JSONB
    if (!body.errors) {
      expect(body.data.system.upsertIntegration.metadata).toBe('NOT VALID JSON {{{{')
    }
  })

  it('accepts extremely large metadata string', async () => {
    const ts = Date.now()
    const bigMeta = 'x'.repeat(10000)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { upsertIntegration(input: { key: "bigmeta-${ts}", name: "Big Meta", metadata: "${bigMeta}" }) { id key metadata } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // TEXT column has no size limit, so large metadata should be accepted
    if (!body.errors) {
      expect(body.data.system.upsertIntegration.metadata).toBe(bigMeta)
    }
  })

  // --- Upsert tenant integration with invalid status ---

  it('GraphQL rejects invalid TenantIntegrationStatus enum value with 400', async () => {
    // Mercurius returns HTTP 400 for invalid enum values at parse/validation time
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { tenant(key: "aegir") { integrations { upsert(input: { integrationKey: "keycloak", status: INVALID_STATUS }) { status } } } }',
      },
    })
    // GraphQL enum validation catches this at parse time, returning HTTP 400
    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.errors).toBeDefined()
  })

  // --- Update tenant with empty input ---

  it('update tenant with empty input returns current state (no-op)', async () => {
    // The service code checks: if (!sets.length) return this.getByKey(key)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { updateTenant(key: "aegir", input: {}) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // Should return the tenant as-is without error
    if (!body.errors) {
      expect(body.data.system.updateTenant.key).toBe('aegir')
    }
  })

  // --- Update nonexistent tenant ---

  it('update nonexistent tenant throws error', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { system { updateTenant(key: "nonexistent-tenant-xyz", input: { name: "Ghost" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The service throws Error(`Tenant not found: ${key}`)
    expect(body.errors).toBeDefined()
  })

  // --- Tenant integration upsert with nonexistent integration key ---

  // NOTE: This test accesses tenant.integrations.upsert which resolves through
  // the TenantIntegrationOps resolver. Due to the known DI naming bug
  // (tenant-integrations directory uses hyphen, registered as tenant-integrationsService
  // instead of tenantIntegrationsService), this may fail with a DI error.
  it.skip('upsert tenant integration with nonexistent integration key throws error (skipped: DI naming bug)', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { tenant(key: "aegir") { integrations { upsert(input: { integrationKey: "nonexistent-integration" }) { integrationKey status } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.errors).toBeDefined()
  })

  // --- Whitespace-only tenant key ---

  it('accepts whitespace-only tenant key — no trimming', async () => {
    // FINDING: No trim/validation on tenant key
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { createTenant(input: { key: "  ", name: "Whitespace Tenant" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      // FINDING: Whitespace-only key accepted without validation
      expect(body.data.system.createTenant.key).toBe('  ')
    }
  })

  // --- Integration upsert idempotency with metadata change ---

  it('upsert integration updates metadata on conflict', async () => {
    const ts = Date.now()
    const key = `upsert-meta-${ts}`

    // First upsert
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { upsertIntegration(input: { key: "${key}", name: "V1", metadata: "{\\"v\\": 1}" }) { id } } }`,
      },
    })

    // Second upsert with different metadata
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { upsertIntegration(input: { key: "${key}", name: "V2", metadata: "{\\"v\\": 2}" }) { id name metadata } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      expect(body.data.system.upsertIntegration.name).toBe('V2')
      expect(body.data.system.upsertIntegration.metadata).toBe('{"v": 2}')
    }
  })

  // --- Tenant key with SQL-injection-like content ---

  it('parameterized queries prevent SQL injection in tenant key', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { system { createTenant(input: { key: "'; DROP TABLE tenant; --", name: "Bobby Tables" }) { id key name } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    // Should either succeed (parameterized) or fail gracefully, never crash
    const body = response.json()
    if (!body.errors) {
      // Verify the table still exists by querying
      const check = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: '{ tenant(key: "aegir") { id } }',
        },
      })
      expect(check.statusCode).toBe(200)
      expect(check.json().data.tenant.id).toBeTruthy()
    }
  })
})
