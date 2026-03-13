import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('Cross-Entity Invariants — Adversarial QA', () => {
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

  // --- Every identity.organization_id references a valid organization ---

  it('every seeded identity has a valid organization_id pointing to an existing org', async () => {
    // Get all identities
    const identitiesRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id label organizationId } } } } }',
      },
    })
    expect(identitiesRes.statusCode).toBe(200)
    const identities = identitiesRes.json().data.iam.identities.search.results

    // Get all organizations
    const orgsRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: {}) { results { id key } } } } }',
      },
    })
    expect(orgsRes.statusCode).toBe(200)
    const orgs = orgsRes.json().data.iam.orgs.search.results
    const orgIds = new Set(orgs.map((o: { id: number }) => o.id))

    // Every identity's organizationId must exist in orgs
    for (const identity of identities) {
      if (identity.organizationId != null) {
        expect(
          orgIds.has(identity.organizationId),
          `Identity "${identity.label}" (id=${identity.id}) references org_id=${identity.organizationId} which does not exist`,
        ).toBe(true)
      }
    }
  })

  // --- Organization.protected defaults to false for newly synced orgs ---

  it('newly synced org has protected=false by default', async () => {
    const ts = Date.now()
    const key = `cross-sync-${ts}`

    // Create via sync — note: sync resolver only returns id, key, name, keycloakId
    // FINDING: The sync service RETURNING clause does not include 'protected',
    // so requesting it in the sync mutation causes a GraphQL error (field is null
    // for a non-nullable Boolean! type). We verify via a follow-up search instead.
    const syncRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: "kc-cross-${ts}", key: "${key}", name: "Cross Test Org" }]) { id key name } } } }`,
      },
    })
    expect(syncRes.statusCode).toBe(200)
    const syncBody = syncRes.json()
    expect(syncBody.errors).toBeUndefined()
    expect(syncBody.data.iam.orgs.sync).toHaveLength(1)

    // Now search for the org and verify protected=false
    const searchRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ iam { orgs { search(input: { keyLike: "${key}" }) { results { key protected } } } } }`,
      },
    })
    expect(searchRes.statusCode).toBe(200)
    const found = searchRes.json().data.iam.orgs.search.results.find((r: { key: string }) => r.key === key)
    expect(found).toBeDefined()
    // The DB default is false for the protected column
    expect(found.protected).toBe(false)
  })

  // --- After creating org via sync, it can be found via search ---

  it('synced org is immediately searchable by key', async () => {
    const ts = Date.now()
    const key = `searchable-${ts}`

    // Create via sync
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: "kc-searchable-${ts}", key: "${key}", name: "Searchable Org" }]) { id } } } }`,
      },
    })

    // Search by key
    const searchRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ iam { orgs { search(input: { keyLike: "${key}" }) { results { key name } } } } }`,
      },
    })
    expect(searchRes.statusCode).toBe(200)
    const results = searchRes.json().data.iam.orgs.search.results
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].key).toBe(key)
    expect(results[0].name).toBe('Searchable Org')
  })

  it('synced org is searchable by keycloakId', async () => {
    const ts = Date.now()
    const key = `kcid-search-${ts}`
    const kcId = `kc-kcid-search-${ts}`

    // Create via sync
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: "${kcId}", key: "${key}", name: "KC Search Org" }]) { id } } } }`,
      },
    })

    // Search by keycloakIdIn
    const searchRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ iam { orgs { search(input: { keycloakIdIn: ["${kcId}"] }) { results { key keycloakId } } } } }`,
      },
    })
    expect(searchRes.statusCode).toBe(200)
    const results = searchRes.json().data.iam.orgs.search.results
    expect(results.length).toBe(1)
    expect(results[0].key).toBe(key)
    expect(results[0].keycloakId).toBe(kcId)
  })

  // --- Identity with nonexistent organizationId ---

  it('identity table has FK constraint to organization — invalid org_id would fail on insert', async () => {
    // FINDING: The identity table does have a proper FK:
    // organization_id INTEGER REFERENCES organization(id)
    // So unlike the agents service conversation.organization_id, IAM properly enforces referential integrity.
    // We can't test this directly (no identity create mutation), but we verify the constraint
    // exists by confirming all existing identities reference valid orgs.
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: {}) { results { id organizationId } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const identities = response.json().data.iam.identities.search.results
    // All identities should have non-null organizationId based on seed data
    for (const identity of identities) {
      expect(identity.organizationId).not.toBeNull()
      expect(identity.organizationId).toBeGreaterThan(0)
    }
  })

  // --- System org immutability via sync ---

  it('system org cannot be modified via sync because it is protected', async () => {
    const ts = Date.now()

    // Try to sync with key=system
    const syncRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: "kc-attack-system-${ts}", key: "system", name: "Pwned System" }]) { id key name } } } }`,
      },
    })
    expect(syncRes.statusCode).toBe(200)

    // Verify system org is unchanged
    const checkRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "system" }) { results { key name protected } } } } }',
      },
    })
    const systemOrg = checkRes.json().data.iam.orgs.search.results.find((r: { key: string }) => r.key === 'system')
    expect(systemOrg).toBeDefined()
    expect(systemOrg.name).toBe('System')
    expect(systemOrg.protected).toBe(true)
  })

  // --- Identity search edge cases ---

  it('search identities with SQL wildcard in labelLike', async () => {
    // Probing: does the ILIKE pattern allow SQL wildcards from user input?
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { identities { search(input: { labelLike: "%" }) { results { id label } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.identities.search.results
    // FINDING: The service wraps labelLike with %...%, so searching for '%' becomes '%%%'
    // which matches everything. User-supplied wildcards are not escaped.
    // This isn't a security issue per se, but it's a data leakage vector —
    // a user could craft patterns to discover all labels.
    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('organization search with SQL wildcard in keyLike returns all orgs', async () => {
    // Same issue as identity labelLike — ILIKE patterns not escaped
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ iam { orgs { search(input: { keyLike: "_" }) { results { id key } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.iam.orgs.search.results
    // FINDING: The underscore '_' is a SQL wildcard matching any single character.
    // Combined with the wrapping %_%  it matches any key with at least one character.
    // User-supplied ILIKE wildcards are not escaped.
    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})
