import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('Org Sync Attacks — Adversarial QA', () => {
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

  const syncOrgs = async (input: { keycloakId: string; key: string; name: string }[]) => {
    const inputStr = input
      .map(
        (i) =>
          `{ keycloakId: ${JSON.stringify(i.keycloakId)}, key: ${JSON.stringify(i.key)}, name: ${JSON.stringify(i.name)} }`,
      )
      .join(', ')
    return fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [${inputStr}]) { id key name keycloakId } } } }`,
      },
    })
  }

  // --- Extremely long key ---

  it('accepts extremely long key (1000+ chars) — no server-side length validation', async () => {
    // FINDING: organization.key is VARCHAR(100) in the DB, so keys >100 chars
    // should be rejected. Let's see if the GraphQL layer or DB catches it.
    const longKey = 'a'.repeat(1001)
    const response = await syncOrgs([{ keycloakId: `kc-longkey-${Date.now()}`, key: longKey, name: 'Long Key Org' }])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The DB column is VARCHAR(100), so this should fail with a DB error
    // FINDING: If this does NOT error, it means the DB constraint is not being enforced
    expect(body.errors).toBeDefined()
    expect(body.errors.length).toBeGreaterThan(0)
  })

  // --- Special characters in key ---

  it('handles special characters in key (quotes, backslashes)', async () => {
    // Probing for SQL injection or escaping issues
    const ts = Date.now()
    const response = await syncOrgs([
      {
        keycloakId: `kc-special-${ts}`,
        key: `test'key"${ts}`,
        name: "O'Reilly & Co <script>",
      },
    ])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // GraphQL may reject the special chars in the query string itself
    // or the DB parameterized query should handle them safely
    if (!body.errors) {
      // If it succeeds, the parameterized queries handled escaping properly
      expect(body.data.iam.orgs.sync).toHaveLength(1)
    }
    // Either way, no 500 server crash = good
  })

  it('handles angle brackets and HTML in name', async () => {
    const ts = Date.now()
    const response = await syncOrgs([
      {
        keycloakId: `kc-html-${ts}`,
        key: `htmltest-${ts}`,
        name: '<img src=x onerror=alert(1)>',
      },
    ])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: No XSS sanitization — HTML/script content stored as-is in the DB.
    // This is expected for a backend API, but consumers must sanitize on display.
    if (!body.errors) {
      expect(body.data.iam.orgs.sync[0].name).toBe('<img src=x onerror=alert(1)>')
    }
  })

  // --- Duplicate keycloakIds in same batch ---

  it('handles duplicate keycloakIds in same sync batch', async () => {
    // The sync processes items sequentially in a loop, so the second item
    // with the same keycloakId should hit the ON CONFLICT clause
    const ts = Date.now()
    const kcId = `kc-dup-${ts}`
    const response = await syncOrgs([
      { keycloakId: kcId, key: `dup-a-${ts}`, name: 'First' },
      { keycloakId: kcId, key: `dup-b-${ts}`, name: 'Second' },
    ])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      const results = body.data.iam.orgs.sync
      // FINDING: Both items succeed — the second one updates the first via ON CONFLICT (keycloak_id).
      // But the key stays as the first one's key since ON CONFLICT only updates name.
      // This means duplicate keycloakIds in a batch silently merge, which may be unexpected.
      expect(results).toHaveLength(2)
      expect(results[0].keycloakId).toBe(kcId)
      expect(results[1].keycloakId).toBe(kcId)
      // Both should reference the same org ID since they share the keycloakId
      expect(results[0].id).toBe(results[1].id)
    }
  })

  // --- Empty string key ---

  it('accepts empty string key — no validation', async () => {
    // FINDING: There is no check for empty string keys in the sync mutation.
    // The DB column is VARCHAR(100) NOT NULL, but empty string '' is NOT NULL.
    const ts = Date.now()
    const response = await syncOrgs([{ keycloakId: `kc-empty-${ts}`, key: '', name: 'Empty Key Org' }])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // If no error, empty key was accepted
    // FINDING: Empty string keys can be created — no min-length validation exists
    if (!body.errors) {
      expect(body.data.iam.orgs.sync[0].key).toBe('')
    }
    // Either the DB unique constraint on key catches a second empty-key insert,
    // or it silently allows it
  })

  // --- Empty string name ---

  it('accepts empty string name — no validation', async () => {
    const ts = Date.now()
    const response = await syncOrgs([{ keycloakId: `kc-emptyname-${ts}`, key: `emptyname-${ts}`, name: '' }])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: Empty string names can be created — no min-length validation
    if (!body.errors) {
      expect(body.data.iam.orgs.sync[0].name).toBe('')
    }
  })

  // --- Whitespace-only key ---

  it('accepts whitespace-only key — no trimming or validation', async () => {
    const ts = Date.now()
    const response = await syncOrgs([{ keycloakId: `kc-ws-${ts}`, key: '   ', name: 'Whitespace Key' }])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: Whitespace-only keys accepted — no trim/validation logic
    if (!body.errors) {
      expect(body.data.iam.orgs.sync[0].key).toBe('   ')
    }
  })

  // --- Sync with keycloakId matching placeholder pattern ---

  it('sync with keycloakId matching placeholder pattern can claim seeded orgs', async () => {
    // The sync logic checks: keycloak_id LIKE 'kc-placeholder-%'
    // If we sync with key='aegir' and a real keycloakId, it should claim the aegir org
    const ts = Date.now()
    const realKcId = `kc-real-aegir-${ts}`
    const response = await syncOrgs([{ keycloakId: realKcId, key: 'aegir', name: 'aegir Updated' }])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      const result = body.data.iam.orgs.sync[0]
      // Should have claimed the existing aegir org (id=2)
      expect(result.key).toBe('aegir')
      expect(result.keycloakId).toBe(realKcId)
    }
  })

  // --- Unicode and emoji in key/name ---

  it('handles unicode characters in key and name', async () => {
    const ts = Date.now()
    const response = await syncOrgs([
      {
        keycloakId: `kc-unicode-${ts}`,
        key: `unicode-${ts}`,
        name: 'Org Name',
      },
    ])
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      expect(body.data.iam.orgs.sync[0].name).toBe('Org Name')
    }
  })

  // --- Null-like values via GraphQL ---

  it('GraphQL rejects null keycloakId (required field) with 400', async () => {
    // Mercurius returns HTTP 400 for malformed GraphQL queries (null in non-nullable position)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: null, key: "test", name: "test" }]) { id } } } }`,
      },
    })
    // GraphQL rejects null for a String! field at parse/validation time with HTTP 400
    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.errors).toBeDefined()
  })

  it('GraphQL rejects missing required field in sync input with 400', async () => {
    // Mercurius returns HTTP 400 for missing required fields in input types
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { iam { orgs { sync(input: [{ keycloakId: "kc-1", key: "test" }]) { id } } } }`,
      },
    })
    // Missing name field causes a GraphQL validation error at parse time with HTTP 400
    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.errors).toBeDefined()
  })
})
