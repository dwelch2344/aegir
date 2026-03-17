import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { seedFromDisk } from '../seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = join(__dirname, '..', '..', '..', '..', '..')

describe('Mutation Attacks — Adversarial QA', () => {
  let fastify: FastifyInstance
  let stop: () => Promise<void>

  beforeAll(async () => {
    const result = await buildApp()
    fastify = result.fastify
    stop = () => result.app.stop()
    await fastify.ready()

    const contextService = result.app.resolve<any>('contextService')
    const bcpService = result.app.resolve<any>('bcpService')
    const catalogService = result.app.resolve<any>('catalogService')
    await seedFromDisk({ contextService, bcpService, catalogService }, { workspace: WORKSPACE })
  })

  afterAll(async () => {
    await stop()
  })

  // --- SQL Injection Probing ---

  it('context file upsert is safe from SQL injection in path', async () => {
    const injection = "'; DROP TABLE context_file; --"
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            upsert(input: {
              organizationId: 1,
              tier: "project",
              path: "${injection}",
              description: "SQL injection test"
            }) { id path }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)

    // Verify tables still exist
    const verify = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { context { files { search(input: { organizationId: 1 }) { results { id } } } } } }',
      },
    })
    expect(verify.json().data.practices.context.files.search.results.length).toBeGreaterThan(0)

    // Clean up injected record if it was created
    const data = response.json().data
    if (data?.practices?.context?.files?.upsert?.id) {
      await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `mutation { practices { context { files { delete(id: "${data.practices.context.files.upsert.id}") } } } }`,
        },
      })
    }
  })

  it('catalog search is safe from SQL injection in patternIdIn', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries {
          search(input: { patternIdIn: ["'; DROP TABLE catalog_entry; --"] }) {
            results { id }
          }
        } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)

    // Verify table still exists and has data
    const verify = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { catalog { entries { search(input: {}) { results { id } } } } } }',
      },
    })
    expect(verify.json().data.practices.catalog.entries.search.results.length).toBeGreaterThan(0)
  })

  // --- XSS / Special Character Probing ---

  it('handles HTML/XSS in context file content', async () => {
    const xss = '<script>alert(1)</script><img onerror=alert(1) src=x>'
    const uniquePath = `test/xss-${Date.now()}.md`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            upsert(input: {
              organizationId: 1,
              tier: "project",
              path: "${uniquePath}",
              content: "${xss}"
            }) { id content }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const file = response.json().data.practices.context.files.upsert
    // Content should be stored as-is (no server-side sanitization — that's the frontend's job)
    expect(file.content).toContain('<script>')

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { context { files { delete(id: "${file.id}") } } } }`,
      },
    })
  })

  it('handles template injection strings', async () => {
    const templateInjection = '${process.env.SECRET} {{constructor.constructor}}'
    const uniquePath = `test/template-${Date.now()}.md`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            upsert(input: {
              organizationId: 1,
              tier: "project",
              path: "${uniquePath}",
              content: "${templateInjection}"
            }) { id content }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)

    // Clean up
    const data = response.json().data
    if (data?.practices?.context?.files?.upsert?.id) {
      await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `mutation { practices { context { files { delete(id: "${data.practices.context.files.upsert.id}") } } } }`,
        },
      })
    }
  })

  // --- Extreme String Lengths ---

  it('handles extremely long path strings', async () => {
    const longPath = `test/${'x'.repeat(400)}-${Date.now()}.md`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            upsert(input: {
              organizationId: 1,
              tier: "project",
              path: "${longPath}",
              description: "Long path test"
            }) { id path }
          } } }
        }`,
      },
    })
    // Should either succeed or return a GraphQL error — should NOT crash
    expect(response.statusCode).toBe(200)

    // Clean up if created
    const data = response.json().data
    if (data?.practices?.context?.files?.upsert?.id) {
      await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `mutation { practices { context { files { delete(id: "${data.practices.context.files.upsert.id}") } } } }`,
        },
      })
    }
  })

  it('handles extremely long content in BCP entry', async () => {
    // First get a category ID
    const catRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { bcp { categories { search(input: { organizationId: 1 }) { results { id categoryId } } } } } }',
      },
    })
    const catId = catRes.json().data.practices.bcp.categories.search.results[0].id

    const longContent = 'x'.repeat(50000)
    const entryId = `attack-long-${Date.now()}`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { entries {
            upsert(input: {
              organizationId: 1,
              categoryId: "${catId}",
              entryId: "${entryId}",
              title: "Long Content Attack",
              content: "${longContent}"
            }) { id content }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const data = response.json().data
    if (data?.practices?.bcp?.entries?.upsert) {
      expect(data.practices.bcp.entries.upsert.content.length).toBe(50000)
      // Clean up
      await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `mutation { practices { bcp { entries { delete(id: "${data.practices.bcp.entries.upsert.id}") } } } }`,
        },
      })
    }
  })

  // --- Boundary Values ---

  it('search with organizationId 0 returns empty', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { context { files { search(input: { organizationId: 0 }) { results { id } } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.practices.context.files.search.results).toEqual([])
  })

  it('search with negative organizationId returns empty', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { context { files { search(input: { organizationId: -1 }) { results { id } } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.practices.context.files.search.results).toEqual([])
  })

  // --- Invalid Tier Values ---

  it('context file upsert with invalid tier value', async () => {
    const uniquePath = `test/bad-tier-${Date.now()}.md`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            upsert(input: {
              organizationId: 1,
              tier: "invalid_tier",
              path: "${uniquePath}"
            }) { id tier }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    // The DB has a CHECK constraint on tier: IN ('global', 'project')
    // This should fail with a GraphQL error, not crash
    const body = response.json()
    if (body.errors) {
      // FINDING: Database CHECK constraint correctly rejects invalid tier values
      expect(body.errors.length).toBeGreaterThan(0)
    } else {
      // FINDING: Invalid tier values are accepted — consider adding CHECK constraint
      // or application-level validation
      const file = body.data.practices.context.files.upsert
      await fastify.inject({
        method: 'POST',
        url: '/graphql',
        payload: {
          query: `mutation { practices { context { files { delete(id: "${file.id}") } } } }`,
        },
      })
    }
  })

  // --- Delete Non-Existent Records ---

  it('deleting a non-existent context file returns true', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { practices { context { files { delete(id: "00000000-0000-0000-0000-000000000000") } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    // FINDING: delete() always returns true even for non-existent records
    // This is consistent with the IAM service behavior
    expect(response.json().data.practices.context.files.delete).toBe(true)
  })

  it('updating content of non-existent file returns null', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { context { files {
            updateContent(id: "00000000-0000-0000-0000-000000000000", input: { content: "ghost" }) {
              id
            }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.practices.context.files.updateContent).toBeNull()
  })
})
