import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { catalogEntrySchema, type CatalogEntry } from './catalog-schema.js'

/**
 * Reads and validates all catalog entries from a catalog directory.
 * Returns a Map keyed by pattern ID.
 */
export function loadCatalog(catalogDir: string): Map<string, CatalogEntry> {
  const catalog = new Map<string, CatalogEntry>()

  if (!existsSync(catalogDir)) {
    throw new Error(`Catalog directory not found: ${catalogDir}`)
  }

  const entries = readdirSync(catalogDir, { withFileTypes: true }).filter((d) => d.isDirectory())

  for (const dir of entries) {
    const patternPath = join(catalogDir, dir.name, 'pattern.yaml')
    if (!existsSync(patternPath)) {
      continue
    }

    const raw = readFileSync(patternPath, 'utf-8')
    const data = parse(raw)
    const result = catalogEntrySchema.safeParse(data)

    if (!result.success) {
      throw new Error(`Invalid catalog entry ${dir.name}: ${result.error.issues.map((i) => i.message).join(', ')}`)
    }

    if (result.data.id !== dir.name) {
      throw new Error(`Catalog entry ID mismatch: directory "${dir.name}" but id is "${result.data.id}"`)
    }

    catalog.set(result.data.id, result.data)
  }

  return catalog
}

/**
 * Resolves a list of pattern IDs into a topologically sorted order
 * respecting preconditions. Throws if a precondition is missing.
 */
export function resolvePatternOrder(patternIds: string[], catalog: Map<string, CatalogEntry>): CatalogEntry[] {
  // Validate all patterns exist
  for (const id of patternIds) {
    if (!catalog.has(id)) {
      throw new Error(`Pattern "${id}" not found in catalog`)
    }
  }

  const requested = new Set(patternIds)
  const sorted: CatalogEntry[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected involving "${id}"`)
    }

    visiting.add(id)
    const entry = catalog.get(id)!

    for (const precondition of entry.preconditions) {
      if (!requested.has(precondition)) {
        throw new Error(`Pattern "${id}" requires precondition "${precondition}" which is not in the profile`)
      }
      visit(precondition)
    }

    visiting.delete(id)
    visited.add(id)
    sorted.push(entry)
  }

  for (const id of patternIds) {
    visit(id)
  }

  return sorted
}

/**
 * Collects all capabilities provided by a set of catalog entries.
 */
export function collectCapabilities(entries: CatalogEntry[]): string[] {
  const capabilities = new Set<string>()
  for (const entry of entries) {
    for (const cap of entry.provides) {
      capabilities.add(cap)
    }
  }
  return [...capabilities]
}
