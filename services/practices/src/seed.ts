/**
 * Seed script — loads filesystem YAML/MD registry files into the practices database.
 *
 * Usage: tsx src/seed.ts [--org <orgId>]
 *
 * Reads from:
 *   - .agents/context/registry.yaml + referenced .md files
 *   - .agents/bcp/registry.yaml + referenced .md files
 *   - catalog/<pattern>/pattern.yaml files
 *
 * Idempotent: uses upserts so it's safe to run repeatedly.
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEnv } from '@aegir/common'
import { parse as parseYaml } from 'yaml'
import { buildApp } from './app.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = getEnv('WORKSPACE', join(__dirname, '..', '..', '..'))

const orgId = Number(process.argv.find((_, i, a) => a[i - 1] === '--org') ?? '1')

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

async function main() {
  const { app } = await buildApp()

  // Import services from DI
  const contextService = app.resolve<any>('contextService')
  const bcpService = app.resolve<any>('bcpService')
  const catalogService = app.resolve<any>('catalogService')

  // ─── Seed Context ───────────────────────────────────────

  const contextRegistryPath = join(WORKSPACE, '.agents', 'context', 'registry.yaml')
  const contextDir = join(WORKSPACE, '.agents', 'context')
  const contextRaw = await readFileSafe(contextRegistryPath)

  if (contextRaw) {
    const registry = parseYaml(contextRaw)
    console.log('[seed] Loading context registry...')

    // Global tier files
    for (const [i, file] of (registry.tiers?.global?.files ?? []).entries()) {
      const content = await readFileSafe(join(contextDir, file.path))
      await contextService.upsertFile({
        organizationId: orgId,
        tier: 'global',
        path: file.path,
        description: file.description ?? '',
        content,
      })
      console.log(`  [context/global] ${file.path}`)
    }

    // Project tier files
    for (const [i, file] of (registry.tiers?.project?.files ?? []).entries()) {
      const content = await readFileSafe(join(contextDir, file.path))
      await contextService.upsertFile({
        organizationId: orgId,
        tier: 'project',
        path: file.path,
        description: file.description ?? '',
        content,
      })
      console.log(`  [context/project] ${file.path}`)
    }

    // Topic entries
    for (const [i, topic] of (registry.tiers?.topics?.entries ?? []).entries()) {
      const systemContent = await readFileSafe(join(contextDir, topic.system))
      const projectContent = await readFileSafe(join(contextDir, topic.project))
      await contextService.upsertTopic({
        organizationId: orgId,
        topicId: topic.id,
        systemPath: topic.system ?? '',
        projectPath: topic.project ?? '',
        systemContent,
        projectContent,
        triggerFiles: topic.triggers?.files ?? [],
        triggerKeywords: topic.triggers?.keywords ?? [],
        triggerCatalogRefs: topic.triggers?.catalog_refs ?? [],
      })
      console.log(`  [context/topic] ${topic.id}`)
    }
  } else {
    console.log('[seed] No context registry found, skipping.')
  }

  // ─── Seed BCP ───────────────────────────────────────────

  const bcpRegistryPath = join(WORKSPACE, '.agents', 'bcp', 'registry.yaml')
  const bcpDir = join(WORKSPACE, '.agents', 'bcp')
  const bcpRaw = await readFileSafe(bcpRegistryPath)

  if (bcpRaw) {
    const registry = parseYaml(bcpRaw)
    console.log('[seed] Loading BCP registry...')

    for (const [i, cat] of (registry.categories ?? []).entries()) {
      const category = await bcpService.upsertCategory({
        organizationId: orgId,
        categoryId: cat.id,
        label: cat.label,
        color: cat.color ?? 'gray',
        description: cat.description ?? '',
        sortOrder: i,
      })
      console.log(`  [bcp/category] ${cat.id}`)

      for (const [j, entry] of (cat.entries ?? []).entries()) {
        const content = entry.path ? await readFileSafe(join(bcpDir, entry.path)) : null
        await bcpService.upsertEntry({
          organizationId: orgId,
          categoryId: category.id,
          entryId: entry.id,
          title: entry.title ?? entry.id,
          description: entry.description ?? '',
          content,
        })
        console.log(`    [bcp/entry] ${entry.id}`)
      }
    }
  } else {
    console.log('[seed] No BCP registry found, skipping.')
  }

  // ─── Seed Catalog ──────────────────────────────────────

  const catalogDir = join(WORKSPACE, 'catalog')
  let catalogDirs: string[]
  try {
    catalogDirs = await readdir(catalogDir)
  } catch {
    catalogDirs = []
  }

  if (catalogDirs.length > 0) {
    console.log('[seed] Loading catalog patterns...')
    for (const dir of catalogDirs.sort()) {
      const patternPath = join(catalogDir, dir, 'pattern.yaml')
      const raw = await readFileSafe(patternPath)
      if (!raw) continue

      const parsed = parseYaml(raw)
      await catalogService.upsert({
        organizationId: orgId,
        patternId: parsed.id ?? dir,
        name: parsed.name ?? dir,
        version: parsed.version ?? '0.0.0',
        description: parsed.description ?? '',
        preconditions: parsed.preconditions ?? [],
        provides: parsed.provides ?? [],
        parameters: parsed.parameters ?? {},
        applicationInstructions: parsed.application_instructions ?? '',
        testCriteria:
          typeof parsed.test_criteria === 'string'
            ? parsed.test_criteria
            : JSON.stringify(parsed.test_criteria ?? ''),
      })
      console.log(`  [catalog] ${parsed.id ?? dir}`)
    }
  } else {
    console.log('[seed] No catalog directory found, skipping.')
  }

  console.log('[seed] Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err)
  process.exit(1)
})
