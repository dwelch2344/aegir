/** Composable for browsing and managing the Best Current Practices (BCP) registry. */

export interface BcpEntry {
  id: string
  path: string
  title: string
  description: string
  content: string | null
}

export interface BcpCategory {
  id: string
  label: string
  color: string
  description: string
  entries: BcpEntry[]
}

export interface BcpRegistry {
  version: string
  categories: BcpCategory[]
}

const registry = ref<BcpRegistry | null>(null)
const registryLoading = ref(false)
const saving = ref(false)

export function useBcpRegistry() {
  async function fetchRegistry() {
    registryLoading.value = true
    try {
      const data = await $fetch<BcpRegistry>('/api/bcp/registry')
      registry.value = data
    } catch (err) {
      console.error('Failed to fetch BCP registry:', err)
    } finally {
      registryLoading.value = false
    }
  }

  async function saveFile(path: string, content: string) {
    saving.value = true
    try {
      await $fetch('/api/bcp/file', {
        method: 'PUT',
        body: { path, content },
      })
      // Update local state
      if (registry.value) {
        for (const cat of registry.value.categories) {
          for (const entry of cat.entries) {
            if (entry.path === path) {
              entry.content = content
              return
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to save BCP file:', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  return { registry, registryLoading, saving, fetchRegistry, saveFile }
}
