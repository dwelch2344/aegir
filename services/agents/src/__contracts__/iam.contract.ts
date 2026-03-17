/**
 * Contract: agents service depends on IAM subgraph.
 *
 * These tests verify that the IAM service's schema contains the types and
 * fields that the agents service references via federation. Run these tests
 * in the IAM service's CI, not the agents service's CI.
 *
 * Consumer: agents
 * Provider: iam
 */
import type { FastifyInstance } from 'fastify'
import { describe, expect, it } from 'vitest'

export function defineIamSchemaContract(fastify: FastifyInstance) {
  describe('Schema Contract: IAM subgraph', () => {
    let sdl: string

    it('exposes the federated schema', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      expect(response.statusCode).toBe(200)
      sdl = response.json().data._service.sdl
      expect(sdl).toBeTruthy()
    })

    it('exposes Identity type with federation key', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      sdl = response.json().data._service.sdl
      expect(sdl).toContain('type Identity')
      expect(sdl).toContain('@key(fields: "id")')
    })

    it('exposes required Identity fields: id, type, label, email, organizationId', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      sdl = response.json().data._service.sdl
      expect(sdl).toContain('id: Int!')
      expect(sdl).toContain('label: String!')
      expect(sdl).toContain('email: String')
      expect(sdl).toContain('organizationId: Int!')
    })

    it('exposes Organization type with federation key', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _service { sdl } }' },
      })
      sdl = response.json().data._service.sdl
      expect(sdl).toContain('type Organization')
      expect(sdl).toContain('id: Int!')
      expect(sdl).toContain('key: String!')
      expect(sdl).toContain('name: String!')
    })
  })
}

export function defineIamBehavioralContract(fastify: FastifyInstance) {
  describe('Behavioral Contract: IAM subgraph', () => {
    it('identity search with empty input returns seeded records', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: '{ iam { identities { search(input: {}) { results { id label } } } } }',
        },
      })
      expect(response.statusCode).toBe(200)
      const results = response.json().data.iam.identities.search.results
      expect(results.length).toBeGreaterThan(0)
    })

    it('organization search with empty input returns seeded records', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: '{ iam { organizations { search(input: {}) { results { id key name } } } } }',
        },
      })
      expect(response.statusCode).toBe(200)
      const results = response.json().data.iam.organizations.search.results
      expect(results.length).toBeGreaterThan(0)
    })
  })
}
