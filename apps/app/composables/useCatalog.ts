/** Composable for browsing the Shipyard catalog. */

export interface CatalogParameter {
  type: string
  required?: boolean
  default?: any
  description?: string
}

export interface CatalogEntry {
  id: string
  name: string
  version: string
  description: string
  preconditions: string[]
  provides: string[]
  parameters: Record<string, CatalogParameter>
  application_instructions: string
  test_criteria: string
}

const catalog = ref<CatalogEntry[]>([])
const catalogLoading = ref(false)

export function useCatalog() {
  async function fetchCatalog() {
    if (catalog.value.length > 0) return // cached
    catalogLoading.value = true
    try {
      const data = await $fetch<{ entries: CatalogEntry[] }>('/api/catalog')
      catalog.value = data.entries
    } catch (err) {
      console.error('Failed to fetch catalog:', err)
    } finally {
      catalogLoading.value = false
    }
  }

  function getEntry(id: string): CatalogEntry | undefined {
    return catalog.value.find((e) => e.id === id)
  }

  return { catalog, catalogLoading, fetchCatalog, getEntry }
}
