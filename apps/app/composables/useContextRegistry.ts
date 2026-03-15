/** Composable for browsing and managing the agent context registry. */

export interface ContextFile {
  path: string
  description: string
  content: string | null
}

export interface TopicEntry {
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

export interface ContextRegistry {
  version: string
  tiers: {
    global: {
      description: string
      files: ContextFile[]
    }
    project: {
      description: string
      files: ContextFile[]
    }
    topics: {
      description: string
      entries: TopicEntry[]
    }
  }
}

const registry = ref<ContextRegistry | null>(null)
const registryLoading = ref(false)
const saving = ref(false)

export function useContextRegistry() {
  async function fetchRegistry() {
    registryLoading.value = true
    try {
      const data = await $fetch<ContextRegistry>('/api/context/registry')
      registry.value = data
    } catch (err) {
      console.error('Failed to fetch context registry:', err)
    } finally {
      registryLoading.value = false
    }
  }

  async function saveFile(path: string, content: string) {
    saving.value = true
    try {
      await $fetch('/api/context/file', {
        method: 'PUT',
        body: { path, content },
      })
      // Update local state
      if (registry.value) {
        for (const f of registry.value.tiers.global.files) {
          if (f.path === path) {
            f.content = content
            break
          }
        }
        for (const f of registry.value.tiers.project.files) {
          if (f.path === path) {
            f.content = content
            break
          }
        }
        for (const t of registry.value.tiers.topics.entries) {
          if (t.system === path) {
            t.systemContent = content
          }
          if (t.project === path) {
            t.projectContent = content
          }
        }
      }
    } catch (err) {
      console.error('Failed to save context file:', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  return { registry, registryLoading, saving, fetchRegistry, saveFile }
}
