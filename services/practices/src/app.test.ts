import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { seedFromDisk } from './seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = join(__dirname, '..', '..', '..')

describe('Practices Service', () => {
  let fastify: FastifyInstance
  let stop: () => Promise<void>

  beforeAll(async () => {
    const result = await buildApp()
    fastify = result.fastify
    stop = () => result.app.stop()
    await fastify.ready()

    // Seed from disk registries (context, BCP, catalog)
    const contextService = result.app.resolve<any>('contextService')
    const bcpService = result.app.resolve<any>('bcpService')
    const catalogService = result.app.resolve<any>('catalogService')
    await seedFromDisk({ contextService, bcpService, catalogService }, { workspace: WORKSPACE })
  })

  afterAll(async () => {
    await stop()
  })

  // --- Infrastructure ---

  it('responds to health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: 'practices' })
  })

  it('serves the federated schema', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ _service { sdl } }' },
    })
    expect(response.statusCode).toBe(200)
    const sdl = response.json().data._service.sdl
    expect(sdl).toContain('type Practices')
    expect(sdl).toContain('type PracticesContextFile')
    expect(sdl).toContain('type PracticesBcpCategory')
    expect(sdl).toContain('type PracticesCatalogEntry')
    expect(sdl).toContain('type Mutation')
  })

  // --- Context File Queries ---

  it('returns all context files when no filters', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { files { search(input: {}) {
          results { id organizationId tier path description }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.context.files.search.results
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  it('filters context files by tier', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { files { search(input: { tier: "global" }) {
          results { id tier path }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.context.files.search.results
    expect(results.length).toBeGreaterThanOrEqual(3)
    for (const file of results) {
      expect(file.tier).toBe('global')
    }
  })

  it('filters context files by organizationId', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { files { search(input: { organizationId: 1 }) {
          results { id organizationId }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.context.files.search.results
    for (const file of results) {
      expect(file.organizationId).toBe(1)
    }
  })

  // --- Context Topic Queries ---

  it('returns all context topics', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { topics { search(input: {}) {
          results { id topicId systemPath projectPath triggerKeywords }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.context.topics.search.results
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  // --- BCP Queries ---

  it('returns all BCP categories', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { bcp { categories { search(input: {}) {
          results { id categoryId label color description }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.bcp.categories.search.results
    expect(results.length).toBeGreaterThanOrEqual(6)
  })

  it('BCP categories include entries field', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { bcp { categories { search(input: {}) {
          results { categoryId entries { id entryId title } }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.bcp.categories.search.results
    const testingCat = results.find((c: any) => c.categoryId === 'testing')
    expect(testingCat).toBeDefined()
    expect(testingCat.entries.length).toBeGreaterThanOrEqual(6)
  })

  // --- Catalog Queries ---

  it('returns all catalog entries', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries { search(input: {}) {
          results { id patternId name version }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.catalog.entries.search.results
    expect(results.length).toBeGreaterThanOrEqual(15)
  })

  it('filters catalog entries by patternIdIn', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries {
          search(input: { patternIdIn: ["api.graphql-federation"] }) {
            results { id patternId name }
          }
        } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.practices.catalog.entries.search.results
    expect(results).toHaveLength(1)
    expect(results[0].patternId).toBe('api.graphql-federation')
  })

  it('catalog entries include all metadata fields', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries {
          search(input: { patternIdIn: ["testing.domain-service"] }) {
            results {
              id patternId name version description
              preconditions provides parameters
              applicationInstructions testCriteria
              createdAt updatedAt
            }
          }
        } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const entry = response.json().data.practices.catalog.entries.search.results[0]
    expect(entry.patternId).toBe('testing.domain-service')
    expect(entry.version).toBe('0.1.0')
    expect(entry.preconditions).toContain('service.domain-subgraph')
    expect(entry.provides).toContain('testing.domain-service-suite')
    expect(entry.applicationInstructions).toBeTruthy()
    expect(entry.testCriteria).toBeTruthy()
  })

  // --- Context File Mutations ---

  it('upsert creates a new context file', async () => {
    const uniquePath = `test/file-${Date.now()}.md`
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
              description: "Test file",
              content: "# Test content"
            }) { id organizationId tier path description content }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const file = response.json().data.practices.context.files.upsert
    expect(file.path).toBe(uniquePath)
    expect(file.content).toBe('# Test content')
    expect(file.tier).toBe('project')

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { context { files { delete(id: "${file.id}") } } } }`,
      },
    })
  })

  it('context file upsert is idempotent', async () => {
    const uniquePath = `test/idempotent-${Date.now()}.md`
    const mutation = `mutation {
      practices { context { files {
        upsert(input: {
          organizationId: 1,
          tier: "project",
          path: "${uniquePath}",
          description: "Idempotent test"
        }) { id path }
      } } }
    }`

    const first = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query: mutation } })
    const second = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query: mutation } })

    const firstId = first.json().data.practices.context.files.upsert.id
    const secondId = second.json().data.practices.context.files.upsert.id
    expect(firstId).toBe(secondId)

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { context { files { delete(id: "${firstId}") } } } }`,
      },
    })
  })

  // --- BCP Mutations ---

  it('upsert creates a new BCP category', async () => {
    const uniqueId = `test-cat-${Date.now()}`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { categories {
            upsert(input: {
              organizationId: 1,
              categoryId: "${uniqueId}",
              label: "Test Category",
              color: "pink"
            }) { id categoryId label color }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const cat = response.json().data.practices.bcp.categories.upsert
    expect(cat.categoryId).toBe(uniqueId)
    expect(cat.label).toBe('Test Category')
    expect(cat.color).toBe('pink')

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { bcp { categories { delete(id: "${cat.id}") } } } }`,
      },
    })
  })

  it('upsert creates a BCP entry under a category', async () => {
    // First create a category
    const catId = `test-entry-cat-${Date.now()}`
    const catRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { categories {
            upsert(input: { organizationId: 1, categoryId: "${catId}", label: "Temp" }) { id }
          } } }
        }`,
      },
    })
    const catDbId = catRes.json().data.practices.bcp.categories.upsert.id

    // Create an entry
    const entryId = `test-entry-${Date.now()}`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { entries {
            upsert(input: {
              organizationId: 1,
              categoryId: "${catDbId}",
              entryId: "${entryId}",
              title: "Test Entry",
              description: "A test",
              content: "# Test BCP"
            }) { id entryId title content categoryId }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const entry = response.json().data.practices.bcp.entries.upsert
    expect(entry.entryId).toBe(entryId)
    expect(entry.title).toBe('Test Entry')
    expect(entry.content).toBe('# Test BCP')
    expect(entry.categoryId).toBe(catDbId)

    // Clean up (cascade: deleting category removes entry)
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { bcp { categories { delete(id: "${catDbId}") } } } }`,
      },
    })
  })

  // --- Catalog Mutations ---

  it('upsert creates a new catalog entry', async () => {
    const patternId = `test.pattern-${Date.now()}`
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { catalog { entries {
            upsert(input: {
              organizationId: 1,
              patternId: "${patternId}",
              name: "Test Pattern",
              version: "1.0.0",
              description: "A test pattern",
              preconditions: ["build.pnpm-turbo"],
              provides: ["test.capability"]
            }) { id patternId name version preconditions provides }
          } } }
        }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const entry = response.json().data.practices.catalog.entries.upsert
    expect(entry.patternId).toBe(patternId)
    expect(entry.name).toBe('Test Pattern')
    expect(entry.version).toBe('1.0.0')
    expect(entry.preconditions).toEqual(['build.pnpm-turbo'])
    expect(entry.provides).toEqual(['test.capability'])

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { catalog { entries { delete(id: "${entry.id}") } } } }`,
      },
    })
  })

  it('catalog entry upsert is idempotent', async () => {
    const patternId = `test.idempotent-${Date.now()}`
    const mutation = `mutation {
      practices { catalog { entries {
        upsert(input: {
          organizationId: 1,
          patternId: "${patternId}",
          name: "Idempotent Pattern"
        }) { id patternId }
      } } }
    }`

    const first = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query: mutation } })
    const second = await fastify.inject({ method: 'POST', url: '/graphql', payload: { query: mutation } })

    const firstId = first.json().data.practices.catalog.entries.upsert.id
    const secondId = second.json().data.practices.catalog.entries.upsert.id
    expect(firstId).toBe(secondId)

    // Clean up
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { catalog { entries { delete(id: "${firstId}") } } } }`,
      },
    })
  })

  // --- Edge Cases ---

  it('search with no matching results returns empty array', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries {
          search(input: { patternIdIn: ["nonexistent.pattern"] }) {
            results { id }
          }
        } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.practices.catalog.entries.search.results).toEqual([])
  })

  it('search with non-matching organizationId returns empty', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { files { search(input: { organizationId: 999999 }) {
          results { id }
        } } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.practices.context.files.search.results).toEqual([])
  })
})
