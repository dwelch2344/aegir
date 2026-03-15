/** GET /api/bcp/registry — Read the BCP registry and all BCP file contents */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

const BCP_DIR = process.env.SHIPYARD_BCP_DIR || '/workspace/.agents/bcp'

interface BcpEntry {
  id: string
  path: string
  title: string
  description: string
  content: string | null
}

interface BcpCategory {
  id: string
  label: string
  color: string
  description: string
  entries: BcpEntry[]
}

async function readBcpFile(relativePath: string): Promise<string | null> {
  try {
    return await readFile(join(BCP_DIR, relativePath), 'utf-8')
  } catch {
    return null
  }
}

export default defineEventHandler(async () => {
  let registryRaw: string
  try {
    registryRaw = await readFile(join(BCP_DIR, 'registry.yaml'), 'utf-8')
  } catch {
    return { error: 'BCP registry not found', registry: null }
  }

  const registry = parseYaml(registryRaw)

  const categories: BcpCategory[] = await Promise.all(
    (registry.categories ?? []).map(async (cat: any) => ({
      id: cat.id,
      label: cat.label,
      color: cat.color ?? 'gray',
      description: cat.description ?? '',
      entries: await Promise.all(
        (cat.entries ?? []).map(async (e: any) => ({
          id: e.id,
          path: e.path,
          title: e.title,
          description: e.description ?? '',
          content: await readBcpFile(e.path),
        })),
      ),
    })),
  )

  return {
    version: registry.version,
    categories,
  }
})
