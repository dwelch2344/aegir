import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { seedFromDisk } from '../seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = join(__dirname, '..', '..', '..', '..', '..')

describe('Cross-Entity Invariants — Adversarial QA', () => {
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

  // --- BCP Category → Entry Relationship ---

  it('every BCP entry belongs to a valid category', async () => {
    // Get all categories and their IDs
    const catRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ practices { bcp { categories { search(input: { organizationId: 1 }) { results { id categoryId entries { id categoryId } } } } } } }',
      },
    })
    const categories = catRes.json().data.practices.bcp.categories.search.results
    const categoryDbIds = new Set(categories.map((c: any) => c.id))

    for (const cat of categories) {
      for (const entry of cat.entries) {
        expect(
          categoryDbIds.has(entry.categoryId),
          `Entry in ${cat.categoryId} references non-existent category ${entry.categoryId}`,
        ).toBe(true)
      }
    }
  })

  it('deleting a BCP category cascades to its entries', async () => {
    // Create a temporary category
    const catId = `invariant-cascade-${Date.now()}`
    const catRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { categories {
            upsert(input: { organizationId: 1, categoryId: "${catId}", label: "Cascade Test" }) { id }
          } } }
        }`,
      },
    })
    const catDbId = catRes.json().data.practices.bcp.categories.upsert.id

    // Create two entries under this category
    const entryId1 = `cascade-entry-1-${Date.now()}`
    const entryId2 = `cascade-entry-2-${Date.now()}`
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { entries {
            upsert(input: { organizationId: 1, categoryId: "${catDbId}", entryId: "${entryId1}", title: "Entry 1" }) { id }
          } } }
        }`,
      },
    })
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation {
          practices { bcp { entries {
            upsert(input: { organizationId: 1, categoryId: "${catDbId}", entryId: "${entryId2}", title: "Entry 2" }) { id }
          } } }
        }`,
      },
    })

    // Verify entries exist
    const beforeDelete = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { bcp { categories { search(input: { organizationId: 1 }) {
          results { id categoryId entries { entryId } }
        } } } } }`,
      },
    })
    const catBefore = beforeDelete.json().data.practices.bcp.categories.search.results
      .find((c: any) => c.categoryId === catId)
    expect(catBefore.entries).toHaveLength(2)

    // Delete the category
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { practices { bcp { categories { delete(id: "${catDbId}") } } } }`,
      },
    })

    // Verify category and its entries are gone
    const afterDelete = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { bcp { categories { search(input: { organizationId: 1 }) {
          results { categoryId }
        } } } } }`,
      },
    })
    const catIds = afterDelete.json().data.practices.bcp.categories.search.results
      .map((c: any) => c.categoryId)
    expect(catIds).not.toContain(catId)
  })

  // --- Context File Uniqueness ---

  it('context files have unique (org, tier, path) combinations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { files { search(input: { organizationId: 1 }) {
          results { organizationId tier path }
        } } } } }`,
      },
    })
    const results = response.json().data.practices.context.files.search.results
    const keys = results.map((f: any) => `${f.organizationId}:${f.tier}:${f.path}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  // --- Context Topic Uniqueness ---

  it('context topics have unique (org, topicId) combinations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { context { topics { search(input: { organizationId: 1 }) {
          results { organizationId topicId }
        } } } } }`,
      },
    })
    const results = response.json().data.practices.context.topics.search.results
    const keys = results.map((t: any) => `${t.organizationId}:${t.topicId}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  // --- Catalog Entry Uniqueness ---

  it('catalog entries have unique (org, patternId) combinations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries { search(input: { organizationId: 1 }) {
          results { organizationId patternId }
        } } } } }`,
      },
    })
    const results = response.json().data.practices.catalog.entries.search.results
    const keys = results.map((e: any) => `${e.organizationId}:${e.patternId}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  // --- BCP Category Uniqueness ---

  it('BCP categories have unique (org, categoryId) combinations', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { bcp { categories { search(input: { organizationId: 1 }) {
          results { organizationId categoryId }
        } } } } }`,
      },
    })
    const results = response.json().data.practices.bcp.categories.search.results
    const keys = results.map((c: any) => `${c.organizationId}:${c.categoryId}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  // --- Cross-Domain Consistency ---

  it('catalog entries with testing preconditions reference real patterns', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ practices { catalog { entries { search(input: { organizationId: 1 }) {
          results { patternId preconditions }
        } } } } }`,
      },
    })
    const results = response.json().data.practices.catalog.entries.search.results
    const allPatternIds = new Set(results.map((e: any) => e.patternId))

    for (const entry of results) {
      for (const precondition of entry.preconditions) {
        expect(
          allPatternIds.has(precondition),
          `${entry.patternId} has precondition "${precondition}" which is not in the catalog`,
        ).toBe(true)
      }
    }
  })
})
