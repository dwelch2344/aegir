/** Composable for managing Shipyard projects. */

interface ProjectService {
  id: string
  name: string
  type: string
  port: number
}

interface ProjectPattern {
  id: string
  patternId: string
  version: string
  appliedAt: string | null
}

interface ProjectStatusReport {
  id: string
  issues: string[]
  servicesOk: number
  servicesMissing: number
  outdatedPatterns: number
  checkedAt: string
}

interface ProjectCommit {
  sha: string
  message: string
  url: string | null
}

interface ProjectDiagnosticsReport {
  id: string
  report: string
  createdAt: string
}

interface ProjectActivityEntry {
  id: string
  taskName: string
  status: string
  message: string
  createdAt: string
}

interface ProjectActivity {
  id: string
  workflowId: string
  type: string
  status: string
  reportId: string | null
  diagnosticsReport: ProjectDiagnosticsReport | null
  entries: ProjectActivityEntry[]
  startedAt: string
  completedAt: string | null
}

export interface ProjectActivityEvent {
  activityId: string
  projectId: string
  type: string
  taskName: string | null
  status: string
  message: string
  timestamp: string
}

interface Project {
  id: string
  organizationId: number
  name: string
  repoUrl: string
  branch: string
  localPath: string | null
  status: string
  lastSyncedAt: string | null
  manifestRaw: string | null
  createdAt: string
  updatedAt: string
  services: ProjectService[]
  patterns: ProjectPattern[]
  statusReport: ProjectStatusReport | null
  commits: ProjectCommit[]
  diagnosticsReport: ProjectDiagnosticsReport | null
  activities: ProjectActivity[]
}

const projects = ref<Project[]>([])
const loading = ref(false)

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

export function useProjects() {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

  async function fetchProjects(organizationId: number) {
    loading.value = true
    try {
      const data = await gql<any>(gatewayUrl, SEARCH_QUERY, {
        input: { organizationId },
      })
      projects.value = data.projects.projects.search.results
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id: string): Promise<Project | null> {
    try {
      const data = await gql<any>(gatewayUrl, SEARCH_QUERY, {
        input: { idIn: [id] },
      })
      const project = data.projects.projects.search.results[0] ?? null
      // Update local cache
      if (project) {
        const idx = projects.value.findIndex((p) => p.id === id)
        if (idx >= 0) projects.value[idx] = project
      }
      return project
    } catch (err) {
      console.error('Failed to fetch project:', err)
      return null
    }
  }

  async function addProject(input: { organizationId: number; name: string; repoUrl: string; branch?: string }) {
    const data = await gql<any>(gatewayUrl, CREATE_MUTATION, { input })
    const project = data.projects.projects.create
    projects.value.unshift({ ...project, services: [], patterns: [], statusReport: null })

    // Trigger sync immediately
    await syncProject(project.id)

    return project
  }

  async function scaffoldProject(input: {
    organizationId: number
    name: string
    owner: string
    projectType: string
    description?: string
    visibility?: string
  }) {
    const data = await gql<any>(gatewayUrl, SCAFFOLD_MUTATION, { input })
    const result = data.projects.projects.scaffold
    // Refresh the project list to pick up the new project
    if (input.organizationId) {
      await fetchProjects(input.organizationId)
    }
    return result
  }

  async function syncProject(id: string) {
    const data = await gql<any>(gatewayUrl, SYNC_MUTATION, { id })
    return data.projects.projects.sync
  }

  async function deleteProject(id: string) {
    await gql<any>(gatewayUrl, DELETE_MUTATION, { id })
    projects.value = projects.value.filter((p) => p.id !== id)
  }

  async function checkStatus(id: string) {
    const data = await gql<any>(gatewayUrl, CHECK_STATUS_MUTATION, { id })
    return data.projects.projects.checkStatus
  }

  async function applyPattern(id: string, patternId: string, params?: Record<string, unknown>) {
    const data = await gql<any>(gatewayUrl, APPLY_PATTERN_MUTATION, {
      id,
      patternId,
      params: params ? JSON.stringify(params) : null,
    })
    return data.projects.projects.applyPattern
  }

  async function runDiagnostics(id: string) {
    const data = await gql<any>(gatewayUrl, RUN_DIAGNOSTICS_MUTATION, { id })
    return data.projects.projects.runDiagnostics
  }

  function subscribeToActivity(projectId: string, onEvent: (event: ProjectActivityEvent) => void): () => void {
    const runtimeConfig = useRuntimeConfig()
    const projectsWsUrl = runtimeConfig.public.projectsWsUrl as string
    const ws = new WebSocket(projectsWsUrl, 'graphql-transport-ws')

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init' }))
    })

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'connection_ack') {
        ws.send(
          JSON.stringify({
            id: 'activity-sub',
            type: 'subscribe',
            payload: {
              query: ACTIVITY_SUBSCRIPTION,
              variables: { projectId },
            },
          }),
        )
      }
      if (msg.type === 'next' && msg.payload?.data?.projectsActivityUpdated) {
        onEvent(msg.payload.data.projectsActivityUpdated)
      }
    })

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: 'activity-sub', type: 'complete' }))
        ws.close()
      }
    }
  }

  return {
    projects,
    loading,
    fetchProjects,
    fetchProject,
    addProject,
    scaffoldProject,
    syncProject,
    deleteProject,
    checkStatus,
    applyPattern,
    runDiagnostics,
    subscribeToActivity,
  }
}

const SEARCH_QUERY = `
  query($input: ProjectsProjectSearchInput!) {
    projects {
      projects {
        search(input: $input) {
          results {
            id organizationId name repoUrl branch localPath
            status lastSyncedAt createdAt updatedAt
            services { id name type port }
            patterns { id patternId version appliedAt }
            statusReport { id issues servicesOk servicesMissing outdatedPatterns checkedAt }
            commits { sha message url }
            diagnosticsReport { id report createdAt }
            activities { id workflowId type status reportId startedAt completedAt diagnosticsReport { id report createdAt } entries { id taskName status message createdAt } }
          }
        }
      }
    }
  }
`

const CREATE_MUTATION = `
  mutation($input: ProjectsProjectCreateInput!) {
    projects { projects { create(input: $input) { id name repoUrl branch status createdAt } } }
  }
`

const SCAFFOLD_MUTATION = `
  mutation($input: ProjectsProjectScaffoldInput!) {
    projects { projects { scaffold(input: $input) { projectId workflowId } } }
  }
`

const SYNC_MUTATION = `
  mutation($id: ID!) {
    projects { projects { sync(id: $id) { projectId workflowId } } }
  }
`

const DELETE_MUTATION = `
  mutation($id: ID!) {
    projects { projects { delete(id: $id) } }
  }
`

const CHECK_STATUS_MUTATION = `
  mutation($id: ID!) {
    projects { projects { checkStatus(id: $id) { projectId workflowId } } }
  }
`

const APPLY_PATTERN_MUTATION = `
  mutation($id: ID!, $patternId: String!, $params: String) {
    projects { projects { applyPattern(id: $id, patternId: $patternId, params: $params) { projectId workflowId } } }
  }
`

const RUN_DIAGNOSTICS_MUTATION = `
  mutation($id: ID!) {
    projects { projects { runDiagnostics(id: $id) { projectId workflowId } } }
  }
`

const ACTIVITY_SUBSCRIPTION = `
  subscription($projectId: ID!) {
    projectsActivityUpdated(projectId: $projectId) {
      activityId projectId type taskName status message timestamp
    }
  }
`
