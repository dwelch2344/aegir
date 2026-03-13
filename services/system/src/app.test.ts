import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('System Service', () => {
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

  it('responds to health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: 'system' })
  })

  it('serves the federated schema', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ _service { sdl } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data._service.sdl).toContain('type Tenant')
    expect(body.data._service.sdl).toContain('type TenantOps')
    expect(body.data._service.sdl).toContain('type SystemIntegration')
    expect(body.data._service.sdl).toContain('type System')
  })

  it('queries a tenant by key', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ tenant(key: "aegir") { id key name } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const tenant = response.json().data.tenant
    expect(tenant).toMatchObject({
      id: '1',
      key: 'aegir',
      name: 'aegir Inc.',
    })
  })

  it('queries tenant integrations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ tenant(key: "aegir") { integrations { integrationKey status name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const integrations = response.json().data.tenant.integrations
    expect(integrations).toHaveLength(3)
    expect(integrations[0]).toMatchObject({
      integrationKey: 'github',
      status: 'ACTIVE',
    })
  })

  it('searches system integrations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ system { integrations { search(input: {}) { results { id key name } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.system.integrations.search.results
    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({ id: 1, key: 'keycloak' })
  })

  it('creates a new tenant', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { createTenant(input: { key: "newco", name: "New Co" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const tenant = response.json().data.system.createTenant
    expect(tenant.key).toBe('newco')
    expect(tenant.name).toBe('New Co')
    expect(tenant.id).toBeTruthy()
  })

  it('upserts an integration', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { upsertIntegration(input: { key: "jira", name: "Jira" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const integration = response.json().data.system.upsertIntegration
    expect(integration.key).toBe('jira')
    expect(integration.name).toBe('Jira')
  })

  it('upserts a tenant integration', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { tenant(key: "aegir") { integrations { upsert(input: { integrationKey: "jira", status: ACTIVE, name: "Jira" }) { integrationKey status name } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const ti = response.json().data.tenant.integrations.upsert
    expect(ti).toMatchObject({
      integrationKey: 'jira',
      status: 'ACTIVE',
      name: 'Jira',
    })
  })

  it('updates an existing tenant', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { updateTenant(key: "aegir", input: { name: "Aegir Platform" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const tenant = response.json().data.system.updateTenant
    expect(tenant.key).toBe('aegir')
    expect(tenant.name).toBe('Aegir Platform')
  })

  // --- Seed Data Validation ---

  it('seed tenant (id=1, key=aegir) exists', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ tenant(key: "aegir") { id key name } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const tenant = response.json().data.tenant
    expect(tenant.id).toBe('1')
    expect(tenant.key).toBe('aegir')
  })

  it('seed integrations (keycloak, slack, github) exist with correct keys', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ system { integrations { search(input: {}) { results { id key name } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.system.integrations.search.results
    const keys = results.map((r: any) => r.key)
    expect(keys).toContain('keycloak')
    expect(keys).toContain('slack')
    expect(keys).toContain('github')
  })

  it('seed tenant_integrations are all ACTIVE', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ tenant(key: "aegir") { integrations { integrationKey status } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const integrations = response.json().data.tenant.integrations
    expect(integrations).toHaveLength(3)
    for (const ti of integrations) {
      expect(ti.status).toBe('ACTIVE')
    }
  })

  // --- Mutation Edge Cases ---

  it('createTenant with duplicate key returns an error', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { system { createTenant(input: { key: "aegir", name: "Duplicate" }) { id key name } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.errors).toBeDefined()
    expect(body.errors.length).toBeGreaterThan(0)
  })

  it('upsertIntegration is idempotent', async () => {
    const query =
      'mutation { system { upsertIntegration(input: { key: "idempotent-test", name: "Idempotent" }) { id key name } } }'

    const first = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query } })
    expect(first.statusCode).toBe(200)
    const firstResult = first.json().data.system.upsertIntegration

    const second = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query } })
    expect(second.statusCode).toBe(200)
    const secondResult = second.json().data.system.upsertIntegration

    expect(firstResult.id).toBe(secondResult.id)
    expect(firstResult.key).toBe(secondResult.key)
    expect(firstResult.name).toBe(secondResult.name)
  })

  it('TenantIntegration status change via upsert', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { tenant(key: "aegir") { integrations { upsert(input: { integrationKey: "slack", status: INACTIVE, name: "Slack" }) { integrationKey status } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const ti = response.json().data.tenant.integrations.upsert
    expect(ti.integrationKey).toBe('slack')
    expect(ti.status).toBe('INACTIVE')
  })

  it('searches integrations by keyIn filter', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ system { integrations { search(input: { keyIn: ["keycloak", "github"] }) { results { key } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.system.integrations.search.results
    expect(results).toHaveLength(2)
    const keys = results.map((r: any) => r.key)
    expect(keys).toContain('keycloak')
    expect(keys).toContain('github')
  })

  it('searches integrations by idIn filter', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ system { integrations { search(input: { idIn: [1, 2] }) { results { id key } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.system.integrations.search.results
    expect(results).toHaveLength(2)
    expect(results.map((r: any) => r.id)).toContain(1)
    expect(results.map((r: any) => r.id)).toContain(2)
  })

  it('query nonexistent tenant key returns error', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ tenant(key: "does-not-exist") { id key name } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.errors).toBeDefined()
    expect(body.errors.length).toBeGreaterThan(0)
  })

  // --- Todo stubs ---

  it.todo('Tenant should have Organization linkage for cross-service queries')
  it.todo('TenantIntegration should validate integrationKey exists before upsert')
  it.todo('Federation __resolveReference for Tenant works across gateway')
})
