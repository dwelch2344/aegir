import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('IAM Service', () => {
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
    expect(response.json()).toEqual({ status: 'ok', service: 'iam' })
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
    expect(body.data._service.sdl).toContain('type Identity')
    expect(body.data._service.sdl).toContain('type Organization')
    expect(body.data._service.sdl).toContain('type Iam')
    expect(body.data._service.sdl).toContain('type Mutation')
  })

  it('returns all identities when no filters', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id type label email } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({
      id: 1,
      type: 'SUPER_USER',
      label: 'System',
      email: 'system@aegir.dev',
    })
  })

  it('filters identities by idIn', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: { idIn: [2] }) { results { id label } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    expect(results).toEqual([{ id: 2, label: 'Alice Chen' }])
  })

  it('filters identities by labelLike', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: { labelLike: "bob" }) { results { id } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.iam.identities.search.results).toEqual([{ id: 3 }])
  })

  it('returns all organizations when no filters', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: {}) { results { id key name protected } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.search.results
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      id: 1,
      key: 'system',
      name: 'System',
      protected: true,
    })
    expect(results[1]).toMatchObject({
      id: 2,
      key: 'aegir',
      name: 'aegir Inc.',
      protected: false,
    })
  })

  it('filters organizations by keyLike', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "aegir" }) { results { id key } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.iam.orgs.search.results).toEqual([{ id: 2, key: 'aegir' }])
  })

  // --- Seed Data Validation ---

  it('system org exists with key=system, protected=true', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "system" }) { results { id key name protected } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.search.results
    const systemOrg = results.find((r: { key: string }) => r.key === 'system')
    expect(systemOrg).toBeDefined()
    expect(systemOrg).toMatchObject({
      key: 'system',
      name: 'System',
      protected: true,
    })
  })

  it('aegir org exists with key=aegir, protected=false', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "aegir" }) { results { id key name protected } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.search.results
    const aegirOrg = results.find((r: { key: string }) => r.key === 'aegir')
    expect(aegirOrg).toBeDefined()
    expect(aegirOrg).toMatchObject({
      key: 'aegir',
      name: 'aegir Inc.',
      protected: false,
    })
  })

  it('SUPER_USER identity belongs to system org', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          '{ iam { identities { search(input: { labelLike: "System" }) { results { id type label organizationId } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    const superUser = results.find((r: { type: string }) => r.type === 'SUPER_USER')
    expect(superUser).toBeDefined()
    expect(superUser.label).toBe('System')
    // Verify the organizationId points to the system org
    const orgRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ iam { orgs { search(input: { idIn: [${superUser.organizationId}] }) { results { key protected } } } } }`,
      },
    })
    const org = orgRes.json().data.iam.orgs.search.results[0]
    expect(org).toMatchObject({ key: 'system', protected: true })
  })

  it('seed data includes at least 3 identities and at least 2 organizations', async () => {
    const identitiesRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id } } } } }',
      },
    })
    const orgsRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: {}) { results { id } } } } }',
      },
    })
    expect(identitiesRes.json().data.iam.identities.search.results.length).toBeGreaterThanOrEqual(3)
    expect(orgsRes.json().data.iam.orgs.search.results.length).toBeGreaterThanOrEqual(2)
  })

  it('identity types include SUPER_USER and USER among seed data', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id type } } } } }',
      },
    })
    const results = response.json().data.iam.identities.search.results
    const types = results.map((r: { type: string }) => r.type)
    expect(types).toContain('SUPER_USER')
    expect(types).toContain('USER')
  })

  // --- Organization Sync Mutation Tests ---

  it('sync creates a new org from keycloak data', async () => {
    const uniqueKey = `synctest-${Date.now()}`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          iam {
            orgs {
              sync(input: [{ keycloakId: "kc-${uniqueKey}", key: "${uniqueKey}", name: "Sync Test Org" }]) {
                id key name keycloakId
              }
            }
          }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.sync
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      key: uniqueKey,
      name: 'Sync Test Org',
      keycloakId: `kc-${uniqueKey}`,
    })
    expect(results[0].id).toBeGreaterThan(0)
  })

  it('sync is idempotent (same input twice = same result)', async () => {
    const uniqueKey = `idempotent-${Date.now()}`
    const payload = {
      query: `mutation {
        iam {
          orgs {
            sync(input: [{ keycloakId: "kc-${uniqueKey}", key: "${uniqueKey}", name: "Idempotent Org" }]) {
              id key name keycloakId
            }
          }
        }
      }`,
    }
    const first = await fastify.inject({ method: 'POST', url: '/graphql', payload })
    const second = await fastify.inject({ method: 'POST', url: '/graphql', payload })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    const firstResults = first.json().data.iam.orgs.sync
    const secondResults = second.json().data.iam.orgs.sync
    expect(firstResults[0].id).toBe(secondResults[0].id)
    expect(firstResults[0].key).toBe(secondResults[0].key)
  })

  it('sync with empty array is a no-op', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          iam {
            orgs {
              sync(input: []) {
                id
              }
            }
          }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.sync
    expect(results).toHaveLength(0)
  })

  it('sync skips protected organizations', async () => {
    // Attempt to sync with key=system (which is protected)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          iam {
            orgs {
              sync(input: [{ keycloakId: "kc-system-override-${Date.now()}", key: "system", name: "Hacked System" }]) {
                id key name
              }
            }
          }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    // Verify the system org is unchanged — still protected with original name
    const checkRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "system" }) { results { key name protected } } } } }',
      },
    })
    const systemOrg = checkRes.json().data.iam.orgs.search.results.find((r: { key: string }) => r.key === 'system')
    expect(systemOrg).toBeDefined()
    expect(systemOrg).toMatchObject({
      key: 'system',
      name: 'System',
      protected: true,
    })
  })

  // --- Identity Edge Cases ---

  it('filter by multiple idIn values returns correct subset', async () => {
    // First get all identities to know valid IDs
    const allRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id label } } } } }',
      },
    })
    const allResults = allRes.json().data.iam.identities.search.results
    expect(allResults.length).toBeGreaterThanOrEqual(2)
    const firstId = allResults[0].id
    const lastId = allResults[allResults.length - 1].id

    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ iam { identities { search(input: { idIn: [${firstId}, ${lastId}] }) { results { id label } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    if (firstId === lastId) {
      expect(results).toHaveLength(1)
    } else {
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe(firstId)
      expect(results[1].id).toBe(lastId)
    }
  })

  it('filter with no matching results returns empty array', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: { idIn: [9999] }) { results { id } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.iam.identities.search.results).toEqual([])
  })

  it('schema contains all three IdentityType enum values', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ _service { sdl } }',
      },
    })
    const sdl = response.json().data._service.sdl
    expect(sdl).toContain('USER')
    expect(sdl).toContain('SUPER_USER')
    expect(sdl).toContain('SERVICE_ACCOUNT')
  })

  it('organizationId is returned for identities', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id label organizationId } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    expect(results.length).toBeGreaterThan(0)
    // Every identity should have an organizationId field
    for (const identity of results) {
      expect(identity).toHaveProperty('organizationId')
      expect(identity.organizationId).toBeTypeOf('number')
    }
  })

  // --- Protected Organization Invariants ---

  it('system org protected flag is queryable and true', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "system" }) { results { key protected } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.search.results
    const systemOrg = results.find((r: { key: string }) => r.key === 'system')
    expect(systemOrg).toBeDefined()
    expect(systemOrg.protected).toBe(true)
  })

  it('protected field appears in schema SDL', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ _service { sdl } }',
      },
    })
    const sdl = response.json().data._service.sdl
    expect(sdl).toContain('protected')
    expect(sdl).toContain('Boolean!')
  })

  // --- Unimplemented Feature Stubs ---

  it.todo('Identity-Organization relationship should be mediated by Membership')
  it.todo('Organization should have a tenant_id foreign key')
  it.todo('Identity can belong to multiple organizations through Membership')
  it.todo('Roles and permissions should be defined on Membership')
})
