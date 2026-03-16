/** Composable for browsing and managing the Best Current Practices (BCP) registry via GraphQL. */

export interface BcpEntry {
  id: string
  entryId: string
  title: string
  description: string
  content: string | null
}

export interface BcpCategory {
  id: string
  categoryId: string
  label: string
  color: string
  description: string
  entries: BcpEntry[]
}

export interface BcpRegistry {
  version: string
  categories: BcpCategory[]
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

const registry = ref<BcpRegistry | null>(null)
const registryLoading = ref(false)
const saving = ref(false)

export function useBcpRegistry() {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

  async function fetchRegistry() {
    registryLoading.value = true
    try {
      const data = await gql<any>(gatewayUrl, BCP_QUERY)
      const categories = data.practices.bcp.categories.search.results.map((cat: any) => ({
        id: cat.categoryId,
        categoryId: cat.categoryId,
        label: cat.label,
        color: cat.color,
        description: cat.description,
        entries: cat.entries.map((e: any) => ({
          id: e.id,
          entryId: e.entryId,
          title: e.title,
          description: e.description,
          content: e.content,
        })),
      }))
      registry.value = { version: '0.1.0', categories }
    } catch (err) {
      console.error('Failed to fetch BCP registry:', err)
    } finally {
      registryLoading.value = false
    }
  }

  async function saveFile(entryId: string, content: string) {
    saving.value = true
    try {
      // Find entry by entryId to get the DB id
      if (registry.value) {
        for (const cat of registry.value.categories) {
          for (const entry of cat.entries) {
            if (entry.entryId === entryId || entry.id === entryId) {
              await gql(gatewayUrl, UPDATE_BCP_ENTRY_CONTENT_MUTATION, {
                id: entry.id,
                input: { content },
              })
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

const BCP_QUERY = `
  query {
    practices {
      bcp {
        categories { search(input: {}) { results {
          id categoryId label color description sortOrder
          entries { id entryId title description content sortOrder }
        } } }
      }
    }
  }
`

const UPDATE_BCP_ENTRY_CONTENT_MUTATION = `
  mutation($id: ID!, $input: PracticesBcpEntryUpdateContentInput!) {
    practices { bcp { entries { updateContent(id: $id, input: $input) { id content } } } }
  }
`
