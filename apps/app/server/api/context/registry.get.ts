/** GET /api/context/registry — Read the agent context registry and all context file contents */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

const CONTEXT_DIR = process.env.SHIPYARD_CONTEXT_DIR || '/workspace/.agents/context'

interface ContextFile {
  path: string
  description: string
  content: string | null
}

interface TopicEntry {
  id: string
  system: string
  project: string
  systemContent: string | null
  projectContent: string | null
  triggers: {
    files: string[]
    keywords: string[]
    catalog_refs: string[]
  }
}

async function readContextFile(relativePath: string): Promise<string | null> {
  try {
    return await readFile(join(CONTEXT_DIR, relativePath), 'utf-8')
  } catch {
    return null
  }
}

export default defineEventHandler(async () => {
  let registryRaw: string
  try {
    registryRaw = await readFile(join(CONTEXT_DIR, 'registry.yaml'), 'utf-8')
  } catch {
    return { error: 'Registry not found', registry: null }
  }

  const registry = parseYaml(registryRaw)

  // Load global tier files with content
  const globalFiles: ContextFile[] = await Promise.all(
    (registry.tiers?.global?.files ?? []).map(async (f: any) => ({
      path: f.path,
      description: f.description,
      content: await readContextFile(f.path),
    })),
  )

  // Load project tier files with content
  const projectFiles: ContextFile[] = await Promise.all(
    (registry.tiers?.project?.files ?? []).map(async (f: any) => ({
      path: f.path,
      description: f.description,
      content: await readContextFile(f.path),
    })),
  )

  // Load topic entries with content
  const topics: TopicEntry[] = await Promise.all(
    (registry.tiers?.topics?.entries ?? []).map(async (t: any) => ({
      id: t.id,
      system: t.system,
      project: t.project,
      systemContent: await readContextFile(t.system),
      projectContent: await readContextFile(t.project),
      triggers: {
        files: t.triggers?.files ?? [],
        keywords: t.triggers?.keywords ?? [],
        catalog_refs: t.triggers?.catalog_refs ?? [],
      },
    })),
  )

  return {
    version: registry.version,
    tiers: {
      global: {
        description: registry.tiers?.global?.description ?? '',
        files: globalFiles,
      },
      project: {
        description: registry.tiers?.project?.description ?? '',
        files: projectFiles,
      },
      topics: {
        description: registry.tiers?.topics?.description ?? '',
        entries: topics,
      },
    },
  }
})
