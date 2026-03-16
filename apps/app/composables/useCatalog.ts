/** Composable for browsing the Shipyard catalog via GraphQL. */

export interface CatalogParameter {
  type: string
  required?: boolean
  default?: any
  description?: string
}

export interface CatalogEntry {
  id: string
  patternId: string
  name: string
  version: string
  description: string
  preconditions: string[]
  provides: string[]
  parameters: Record<string, CatalogParameter>
  applicationInstructions: string
  testCriteria: string
}

async function gql<T>(gatewayUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await response.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}

const catalog = ref<CatalogEntry[]>([])
const catalogLoading = ref(false)

export function useCatalog() {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

  async function fetchCatalog() {
    if (catalog.value.length > 0) return // cached
    catalogLoading.value = true
    try {
      const data = await gql<any>(gatewayUrl, CATALOG_QUERY)
      catalog.value = data.practices.catalog.entries.search.results.map((e: any) => ({
        id: e.id,
        patternId: e.patternId,
        name: e.name,
        version: e.version,
        description: e.description,
        preconditions: e.preconditions,
        provides: e.provides,
        parameters: e.parameters ? JSON.parse(e.parameters) : {},
        applicationInstructions: e.applicationInstructions,
        testCriteria: e.testCriteria,
      }))
    } catch (err) {
      console.error('Failed to fetch catalog:', err)
    } finally {
      catalogLoading.value = false
    }
  }

  function getEntry(id: string): CatalogEntry | undefined {
    return catalog.value.find((e) => e.id === id || e.patternId === id)
  }

  return { catalog, catalogLoading, fetchCatalog, getEntry }
}

const CATALOG_QUERY = `
  query {
    practices {
      catalog {
        entries { search(input: {}) { results {
          id patternId name version description
          preconditions provides parameters
          applicationInstructions testCriteria
        } } }
      }
    }
  }
`
