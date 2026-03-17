/**
 * Contract: agents service depends on System subgraph.
 *
 * These tests verify that the System service's schema contains the types and
 * fields that the agents service references via federation. Run these tests
 * in the System service's CI, not the agents service's CI.
 *
 * Consumer: agents
 * Provider: system
 */
import type { FastifyInstance } from 'fastify'
import { describe, expect, it } from 'vitest'

export function defineSystemSchemaContract(fastify: FastifyInstance) {
  describe('Schema Contract: System subgraph', () => {
    it('exposes Tenant type with federation key', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      expect(response.statusCode).toBe(200)
      const sdl = response.json().data._service.sdl
      expect(sdl).toContain('type Tenant')
      expect(sdl).toContain('@key(fields: "id")')
    })

    it('exposes required Tenant fields: id, key, name', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      const sdl = response.json().data._service.sdl
      expect(sdl).toContain('id: Int!')
      expect(sdl).toContain('key: String!')
      expect(sdl).toContain('name: String!')
    })

    it('exposes SystemIntegration type with federation key', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      const sdl = response.json().data._service.sdl
      expect(sdl).toContain('type SystemIntegration')
      expect(sdl).toContain('@key(fields: "id")')
    })
  })
}

export function defineSystemBehavioralContract(fastify: FastifyInstance) {
  describe('Behavioral Contract: System subgraph', () => {
    it('tenant query by key returns a valid tenant', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: '{ tenant(key: "aegir") { id key name } }',
        },
      })
      expect(response.statusCode).toBe(200)
      const tenant = response.json().data.tenant
      expect(tenant).toBeTruthy()
      expect(tenant.key).toBe('aegir')
      expect(tenant.name).toBeTruthy()
    })
  })
}
