/** Composable for browsing and managing the agent context registry via GraphQL. */

export interface ContextFile {
  id: string
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

const registry = ref<ContextRegistry | null>(null)
const registryLoading = ref(false)
const saving = ref(false)

export function useContextRegistry() {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

  async function fetchRegistry() {
    registryLoading.value = true
    try {
      const data = await gql<any>(gatewayUrl, CONTEXT_QUERY)
      const files = data.practices.context.files.search.results
      const topics = data.practices.context.topics.search.results

      const globalFiles = files
        .filter((f: any) => f.tier === 'global')
        .map((f: any) => ({ id: f.id, path: f.path, description: f.description, content: f.content }))

      const projectFiles = files
        .filter((f: any) => f.tier === 'project')
        .map((f: any) => ({ id: f.id, path: f.path, description: f.description, content: f.content }))

      const topicEntries = topics.map((t: any) => ({
        id: t.id,
        system: t.systemPath,
        project: t.projectPath,
        systemContent: t.systemContent,
        projectContent: t.projectContent,
        triggers: {
          files: t.triggerFiles,
          keywords: t.triggerKeywords,
          catalog_refs: t.triggerCatalogRefs,
        },
      }))

      registry.value = {
        version: '0.2.0',
        tiers: {
          global: { description: 'Always-loaded context.', files: globalFiles },
          project: { description: 'Always-loaded when working in this specific repo.', files: projectFiles },
          topics: { description: 'Loaded on-demand when triggers match.', entries: topicEntries },
        },
      }
    } catch (err) {
      console.error('Failed to fetch context registry:', err)
    } finally {
      registryLoading.value = false
    }
  }

  async function saveFile(path: string, content: string) {
    saving.value = true
    try {
      // Find the file/topic by path to get its ID and determine the type
      if (registry.value) {
        // Check global and project tier files
        for (const tier of ['global', 'project'] as const) {
          for (const f of registry.value.tiers[tier].files) {
            if (f.path === path) {
              await gql(gatewayUrl, UPDATE_FILE_CONTENT_MUTATION, { id: f.id, input: { content } })
              f.content = content
              return
            }
          }
        }
        // Check topics
        for (const t of registry.value.tiers.topics.entries) {
          if (t.system === path) {
            await gql(gatewayUrl, UPDATE_TOPIC_CONTENT_MUTATION, {
              id: t.id,
              input: { systemContent: content },
            })
            t.systemContent = content
            return
          }
          if (t.project === path) {
            await gql(gatewayUrl, UPDATE_TOPIC_CONTENT_MUTATION, {
              id: t.id,
              input: { projectContent: content },
            })
            t.projectContent = content
            return
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

const CONTEXT_QUERY = `
  query {
    practices {
      context {
        files { search(input: {}) { results {
          id organizationId tier path description content sortOrder
        } } }
        topics { search(input: {}) { results {
          id organizationId topicId systemPath projectPath
          systemContent projectContent
          triggerFiles triggerKeywords triggerCatalogRefs sortOrder
        } } }
      }
    }
  }
`

const UPDATE_FILE_CONTENT_MUTATION = `
  mutation($id: ID!, $input: PracticesContextFileUpdateContentInput!) {
    practices { context { files { updateContent(id: $id, input: $input) { id content } } } }
  }
`

const UPDATE_TOPIC_CONTENT_MUTATION = `
  mutation($id: ID!, $input: PracticesContextTopicUpdateContentInput!) {
    practices { context { topics { updateContent(id: $id, input: $input) { id systemContent projectContent } } } }
  }
`
