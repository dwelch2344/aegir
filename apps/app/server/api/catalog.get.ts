/** GET /api/catalog — List all catalog pattern entries */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

const CATALOG_DIR = process.env.SHIPYARD_CATALOG_DIR || '/workspace/catalog'

export default defineEventHandler(async () => {
  const entries: any[] = []

  let dirs: string[]
  try {
    dirs = await readdir(CATALOG_DIR)
  } catch {
    return { entries: [] }
  }

  for (const dir of dirs.sort()) {
    const patternPath = join(CATALOG_DIR, dir, 'pattern.yaml')
    try {
      const raw = await readFile(patternPath, 'utf-8')
      const parsed = parseYaml(raw)
      entries.push({
        id: parsed.id ?? dir,
        name: parsed.name ?? dir,
        version: parsed.version ?? '0.0.0',
        description: parsed.description ?? '',
        preconditions: parsed.preconditions ?? [],
        provides: parsed.provides ?? [],
        parameters: parsed.parameters ?? {},
        application_instructions: parsed.application_instructions ?? '',
        test_criteria: parsed.test_criteria ?? '',
      })
    } catch {
      // skip entries without valid pattern.yaml
    }
  }

  return { entries }
})
