<script setup lang="ts">
const route = useRoute()
const projectId = route.params.id as string

const { fetchProject, syncProject, deleteProject, checkStatus, applyPattern, runDiagnostics, subscribeToActivity } = useProjects()
const { catalog, fetchCatalog, getEntry } = useCatalog()

const project = ref<any>(null)
const loading = ref(true)
const error = ref('')
const success = ref('')
const syncing = ref(false)
const checking = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

// Tabs
const activeTab = ref<'overview' | 'patterns' | 'actions'>('overview')

// Apply pattern form
const showApply = ref(false)
const applying = ref(false)
const applyForm = reactive({
  patternId: 'service.domain-subgraph',
  name: '',
  port: '',
  entity: '',
  fields: '',
})

// Catalog detail overlay
const selectedPatternId = ref<string | null>(null)
const selectedCatalogEntry = computed(() => {
  if (!selectedPatternId.value) return null
  return getEntry(selectedPatternId.value) ?? null
})

// Diagnostics
const diagRunning = ref(false)

// Activity feed
import type { ProjectActivityEvent } from '~/composables/useProjects'
const activityEvents = ref<ProjectActivityEvent[]>([])
let unsubActivity: (() => void) | null = null

async function load() {
  loading.value = true
  error.value = ''
  try {
    project.value = await fetchProject(projectId)
    if (!project.value) error.value = 'Project not found'
  } catch (e: any) {
    error.value = e.message || 'Failed to load project'
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  syncing.value = true
  error.value = ''
  success.value = ''
  try {
    await syncProject(projectId)
    success.value = 'Sync started — refreshing in a few seconds...'
    setTimeout(async () => {
      await load()
      syncing.value = false
      success.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Sync failed'
    syncing.value = false
  }
}

async function handleCheckStatus() {
  checking.value = true
  error.value = ''
  success.value = ''
  try {
    await checkStatus(projectId)
    success.value = 'Status check started — refreshing...'
    setTimeout(async () => {
      await load()
      checking.value = false
      success.value = ''
    }, 5000)
  } catch (e: any) {
    error.value = e.message || 'Status check failed'
    checking.value = false
  }
}

async function handleApply() {
  applying.value = true
  error.value = ''
  success.value = ''
  try {
    const params: Record<string, unknown> = {}

    if (applyForm.patternId === 'service.domain-subgraph') {
      if (!applyForm.name.trim()) {
        error.value = 'Service name is required'
        applying.value = false
        return
      }
      params.service_name = applyForm.name.trim()
      if (applyForm.port) params.port = Number(applyForm.port)
      if (applyForm.entity) params.entity_name = applyForm.entity.trim()
      if (applyForm.fields) params.entity_fields = applyForm.fields.trim()
    }

    await applyPattern(projectId, applyForm.patternId, params)
    success.value = `Applying "${applyForm.patternId}" — changes will be committed to a new branch with a PR...`
    showApply.value = false
    applyForm.name = ''
    applyForm.port = ''
    applyForm.entity = ''
    applyForm.fields = ''

    setTimeout(async () => {
      await load()
      applying.value = false
      success.value = ''
    }, 8000)
  } catch (e: any) {
    error.value = e.message || 'Apply failed'
    applying.value = false
  }
}

async function handleRunDiagnostics() {
  diagRunning.value = true
  error.value = ''
  success.value = ''
  try {
    await runDiagnostics(projectId)
    success.value = 'Diagnostics started — Claude is analyzing the project...'
    setTimeout(async () => {
      await load()
      diagRunning.value = false
      success.value = ''
    }, 15000)
  } catch (e: any) {
    error.value = e.message || 'Diagnostics failed'
    diagRunning.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  try {
    await deleteProject(projectId)
    await navigateTo('/projects')
  } catch (e: any) {
    error.value = e.message || 'Delete failed'
    deleting.value = false
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'READY': return 'text-emerald-400 bg-emerald-900/40'
    case 'CLONING': return 'text-blue-400 bg-blue-900/40'
    case 'ERROR': return 'text-red-400 bg-red-900/40'
    case 'STALE': return 'text-yellow-400 bg-yellow-900/40'
    default: return 'text-gray-400 bg-gray-800'
  }
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => {
  load()
  fetchCatalog()
  unsubActivity = subscribeToActivity(projectId, (event) => {
    activityEvents.value.unshift(event)
    // Auto-refresh project data on terminal statuses
    if (event.status === 'COMPLETED' || event.status === 'FAILED') {
      setTimeout(() => load(), 1500)
    }
  })
})

onUnmounted(() => {
  if (unsubActivity) unsubActivity()
})
</script>

<template>
  <div class="max-w-4xl">
    <NuxtLink to="/projects" class="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
      &larr; All projects
    </NuxtLink>

    <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>
    <div v-if="success" class="mb-4 p-3 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ success }}</div>

    <template v-if="project && !loading">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-semibold text-gray-100">{{ project.name }}</h1>
            <span class="text-xs px-2 py-0.5 rounded" :class="statusColor(project.status)">
              {{ project.status }}
            </span>
          </div>
          <p class="text-sm text-gray-500 mt-1">{{ project.repoUrl }}</p>
          <p class="text-xs text-gray-600 mt-0.5">Branch: {{ project.branch }} | Last synced: {{ formatDate(project.lastSyncedAt) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="checking"
            class="px-3 py-1.5 rounded bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
            @click="handleCheckStatus"
          >
            {{ checking ? 'Checking...' : 'Check status' }}
          </button>
          <button
            :disabled="syncing"
            class="px-3 py-1.5 rounded bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
            @click="handleSync"
          >
            {{ syncing ? 'Syncing...' : 'Re-sync' }}
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-gray-700 mb-6">
        <button
          v-for="tab in [
            { key: 'overview', label: 'Overview' },
            { key: 'patterns', label: 'Patterns' },
            { key: 'actions', label: 'Actions' },
          ]"
          :key="tab.key"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.key
            ? 'border-emerald-500 text-emerald-400'
            : 'border-transparent text-gray-500 hover:text-gray-300'"
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ==================== OVERVIEW TAB ==================== -->
      <div v-if="activeTab === 'overview'">
        <!-- Services -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Services ({{ project.services.length }})</h2>
          <div v-if="project.services.length === 0" class="text-sm text-gray-600">No services detected. Sync the project to parse its manifest.</div>
          <div v-else class="space-y-2">
            <div
              v-for="svc in project.services"
              :key="svc.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
            >
              <div>
                <p class="text-sm text-gray-200">{{ svc.name }}</p>
                <p class="text-xs text-gray-500">{{ svc.type }} &middot; port {{ svc.port }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Applied Patterns (summary) -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Applied Patterns ({{ project.patterns.length }})</h2>
          <div v-if="project.patterns.length === 0" class="text-sm text-gray-600">No patterns applied.</div>
          <div v-else class="space-y-2">
            <button
              v-for="pat in project.patterns"
              :key="pat.id"
              class="w-full text-left flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
              @click="selectedPatternId = pat.patternId"
            >
              <div>
                <p class="text-sm text-gray-200">{{ pat.patternId }}</p>
                <p class="text-xs text-gray-500">v{{ pat.version }} &middot; Applied: {{ formatDate(pat.appliedAt) }}</p>
              </div>
              <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Commits -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Recent Commits</h2>
          <div v-if="!project.commits || project.commits.length === 0" class="text-sm text-gray-600">No commits found. Sync the project first.</div>
          <div v-else class="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700">
            <div
              v-for="commit in project.commits"
              :key="commit.sha"
              class="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <code class="text-xs text-emerald-400 font-mono shrink-0">{{ commit.sha.slice(0, 7) }}</code>
              <span class="text-gray-300 truncate flex-1">{{ commit.message }}</span>
              <a
                v-if="commit.url"
                :href="commit.url"
                target="_blank"
                rel="noopener"
                class="text-xs text-gray-500 hover:text-gray-300 shrink-0 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Status Report -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-medium text-gray-400">Status Report</h2>
            <button
              v-if="!project.statusReport"
              :disabled="checking"
              class="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
              @click="handleCheckStatus"
            >
              Run check
            </button>
          </div>
          <div v-if="!project.statusReport" class="text-sm text-gray-600">No status report yet. Click "Check status" to run one.</div>
          <div v-else class="p-4 rounded-lg bg-gray-800 border border-gray-700">
            <div class="grid grid-cols-3 gap-4 mb-3">
              <div>
                <p class="text-xs text-gray-500">Services OK</p>
                <p class="text-lg font-semibold text-emerald-400">{{ project.statusReport.servicesOk }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Missing</p>
                <p class="text-lg font-semibold" :class="project.statusReport.servicesMissing > 0 ? 'text-red-400' : 'text-gray-400'">
                  {{ project.statusReport.servicesMissing }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Outdated Patterns</p>
                <p class="text-lg font-semibold" :class="project.statusReport.outdatedPatterns > 0 ? 'text-yellow-400' : 'text-gray-400'">
                  {{ project.statusReport.outdatedPatterns }}
                </p>
              </div>
            </div>
            <div v-if="project.statusReport.issues.length > 0">
              <p class="text-xs text-gray-500 mb-1">Issues</p>
              <ul class="space-y-1">
                <li v-for="(issue, i) in project.statusReport.issues" :key="i" class="text-xs text-yellow-300">
                  {{ issue }}
                </li>
              </ul>
            </div>
            <p class="text-xs text-gray-600 mt-2">Checked: {{ formatDate(project.statusReport.checkedAt) }}</p>
          </div>
        </div>

        <!-- Manifest -->
        <div v-if="project.manifestRaw" class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Manifest</h2>
          <pre class="p-4 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">{{ project.manifestRaw }}</pre>
        </div>

        <!-- Danger zone -->
        <div class="pt-6 border-t border-gray-700">
          <h2 class="text-sm font-medium text-red-400 mb-3">Danger zone</h2>
          <div v-if="!confirmDelete">
            <button
              class="px-3 py-1.5 rounded border border-red-700 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
              @click="confirmDelete = true"
            >
              Delete project
            </button>
          </div>
          <div v-else class="flex items-center gap-3">
            <span class="text-sm text-gray-400">Are you sure?</span>
            <button
              :disabled="deleting"
              class="px-3 py-1.5 rounded bg-red-700 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              @click="handleDelete"
            >
              {{ deleting ? 'Deleting...' : 'Yes, delete' }}
            </button>
            <button
              class="px-3 py-1.5 rounded bg-gray-700 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
              @click="confirmDelete = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== PATTERNS TAB ==================== -->
      <div v-if="activeTab === 'patterns'">
        <!-- Apply pattern button + form -->
        <div class="mb-6">
          <button
            class="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            @click="showApply = !showApply"
          >
            {{ showApply ? 'Cancel' : 'Apply pattern' }}
          </button>
        </div>

        <form
          v-if="showApply"
          class="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3"
          @submit.prevent="handleApply"
        >
          <h3 class="text-sm font-medium text-gray-200">Apply a catalog pattern</h3>
          <p class="text-xs text-gray-500">This will run the pattern generator, commit changes, and push to the repository.</p>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Pattern</label>
            <select
              v-model="applyForm.patternId"
              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="service.domain-subgraph">service.domain-subgraph — Add a new federated service</option>
              <option value="harness.devcontainer">harness.devcontainer — Generate drydock (devcontainer)</option>
            </select>
          </div>
          <!-- service.domain-subgraph fields -->
          <template v-if="applyForm.patternId === 'service.domain-subgraph'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Service name</label>
                <input
                  v-model="applyForm.name"
                  type="text"
                  placeholder="billing"
                  class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Port</label>
                <input
                  v-model="applyForm.port"
                  type="text"
                  placeholder="4005"
                  class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Entity name (optional)</label>
                <input
                  v-model="applyForm.entity"
                  type="text"
                  placeholder="Invoice"
                  class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Fields (optional)</label>
                <input
                  v-model="applyForm.fields"
                  type="text"
                  placeholder="amount:number,status:string"
                  class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </template>
          <!-- harness.devcontainer description -->
          <div v-if="applyForm.patternId === 'harness.devcontainer'" class="p-3 rounded bg-gray-900 border border-gray-700">
            <p class="text-sm text-gray-300">Generates a complete <code>.devcontainer/</code> drydock based on the ship's manifest:</p>
            <ul class="text-xs text-gray-400 mt-2 space-y-1 ml-4 list-disc">
              <li>Docker Compose with all required infrastructure services</li>
              <li>Traefik single-port ingress with path-based routing</li>
              <li>Postgres init scripts with per-service roles</li>
              <li>Conductor, Grafana, Redpanda configs (if applicable)</li>
              <li>Bootstrap and teardown scripts</li>
            </ul>
          </div>
          <button
            type="submit"
            :disabled="applying || (applyForm.patternId === 'service.domain-subgraph' && !applyForm.name.trim())"
            class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {{ applying ? 'Applying...' : 'Apply & push' }}
          </button>
        </form>

        <!-- Applied patterns with catalog detail -->
        <div class="mb-6">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Applied Patterns ({{ project.patterns.length }})</h2>
          <div v-if="project.patterns.length === 0" class="text-sm text-gray-600">No patterns applied yet.</div>
          <div v-else class="space-y-2">
            <button
              v-for="pat in project.patterns"
              :key="pat.id"
              class="w-full text-left flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
              @click="selectedPatternId = selectedPatternId === pat.patternId ? null : pat.patternId"
            >
              <div>
                <p class="text-sm text-gray-200">{{ pat.patternId }}</p>
                <p class="text-xs text-gray-500">v{{ pat.version }} &middot; Applied: {{ formatDate(pat.appliedAt) }}</p>
              </div>
              <svg
                class="w-4 h-4 text-gray-600 transition-transform"
                :class="{ 'rotate-90': selectedPatternId === pat.patternId }"
                fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <!-- Inline catalog detail for selected pattern -->
            <div
              v-if="selectedPatternId && selectedCatalogEntry"
              class="p-4 rounded-lg bg-gray-850 border border-gray-600 space-y-3"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-gray-100">{{ selectedCatalogEntry.name }}</h3>
                <span class="text-xs text-gray-600">v{{ selectedCatalogEntry.version }}</span>
              </div>
              <p class="text-sm text-gray-400 whitespace-pre-line">{{ selectedCatalogEntry.description }}</p>

              <div v-if="selectedCatalogEntry.provides.length > 0">
                <p class="text-xs font-medium text-gray-500 uppercase mb-1.5">Capabilities</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="cap in selectedCatalogEntry.provides"
                    :key="cap"
                    class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
                  >
                    {{ cap }}
                  </span>
                </div>
              </div>

              <div v-if="selectedCatalogEntry.preconditions.length > 0">
                <p class="text-xs font-medium text-gray-500 uppercase mb-1.5">Preconditions</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="pre in selectedCatalogEntry.preconditions"
                    :key="pre"
                    class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/50"
                  >
                    {{ pre }}
                  </span>
                </div>
              </div>

              <div v-if="Object.keys(selectedCatalogEntry.parameters).length > 0">
                <p class="text-xs font-medium text-gray-500 uppercase mb-1.5">Parameters</p>
                <div class="space-y-1.5">
                  <div
                    v-for="(param, key) in selectedCatalogEntry.parameters"
                    :key="key"
                    class="flex items-start gap-2 text-xs"
                  >
                    <code class="text-emerald-400 font-mono shrink-0">{{ key }}</code>
                    <span class="text-gray-500">{{ param.type || 'string' }}</span>
                    <span v-if="param.default !== undefined" class="text-gray-600">= {{ param.default }}</span>
                  </div>
                </div>
              </div>

              <button
                class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                @click="selectedPatternId = null"
              >
                Close
              </button>
            </div>

            <!-- Pattern not in catalog -->
            <div
              v-if="selectedPatternId && !selectedCatalogEntry"
              class="p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-500"
            >
              Pattern "{{ selectedPatternId }}" is not in the catalog.
              <button class="text-gray-400 hover:text-gray-200 ml-2" @click="selectedPatternId = null">Close</button>
            </div>
          </div>
        </div>

        <!-- Catalog browser -->
        <div>
          <h2 class="text-sm font-medium text-gray-400 mb-3">Available in Catalog</h2>
          <div class="space-y-2">
            <div
              v-for="entry in catalog"
              :key="entry.id"
              class="flex items-center justify-between p-3 rounded-lg border transition-colors"
              :class="project.patterns.some((p: any) => p.patternId === entry.id)
                ? 'bg-emerald-900/10 border-emerald-800/40'
                : 'bg-gray-800 border-gray-700'"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-gray-200">{{ entry.name }}</p>
                  <span
                    v-if="project.patterns.some((p: any) => p.patternId === entry.id)"
                    class="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400"
                  >
                    applied
                  </span>
                </div>
                <p class="text-xs text-gray-500 truncate">{{ entry.id }} &middot; v{{ entry.version }}</p>
              </div>
              <NuxtLink
                to="/catalog"
                class="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-3"
              >
                View details
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== ACTIONS TAB ==================== -->
      <div v-if="activeTab === 'actions'">
        <!-- Diagnostics -->
        <div class="mb-8">
          <div class="p-5 rounded-lg bg-gray-800 border border-gray-700">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-sm font-medium text-gray-100 mb-1">Diagnostics</h3>
                <p class="text-xs text-gray-500">
                  Run Claude on the project to analyze its structure, dependencies, code quality, and produce actionable recommendations.
                </p>
              </div>
              <button
                :disabled="diagRunning"
                class="px-4 py-2 rounded-lg bg-violet-600 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors shrink-0 ml-4"
                @click="handleRunDiagnostics"
              >
                {{ diagRunning ? 'Running...' : 'Run diagnostics' }}
              </button>
            </div>

            <!-- Diagnostics report -->
            <div v-if="project.diagnosticsReport" class="mt-4 pt-4 border-t border-gray-700">
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs text-gray-500">Last run: {{ formatDate(project.diagnosticsReport.createdAt) }}</p>
              </div>
              <div class="p-4 rounded bg-gray-900 border border-gray-700 text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">{{ project.diagnosticsReport.report }}</div>
            </div>
          </div>
        </div>

        <!-- Activity Feed (real-time) -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Activity Feed</h2>

          <!-- Live events from subscription -->
          <div v-if="activityEvents.length > 0" class="mb-4">
            <p class="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </p>
            <div class="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700 max-h-64 overflow-y-auto">
              <div
                v-for="(ev, i) in activityEvents"
                :key="i"
                class="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <span
                  class="mt-0.5 shrink-0 w-2 h-2 rounded-full"
                  :class="{
                    'bg-blue-400': ev.status === 'RUNNING',
                    'bg-emerald-400': ev.status === 'COMPLETED',
                    'bg-red-400': ev.status === 'FAILED',
                    'bg-gray-500': !['RUNNING', 'COMPLETED', 'FAILED'].includes(ev.status),
                  }"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-gray-300 font-medium text-xs">{{ ev.taskName || ev.type }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded"
                      :class="{
                        'bg-blue-900/40 text-blue-400': ev.status === 'RUNNING',
                        'bg-emerald-900/40 text-emerald-400': ev.status === 'COMPLETED',
                        'bg-red-900/40 text-red-400': ev.status === 'FAILED',
                        'bg-gray-800 text-gray-400': !['RUNNING', 'COMPLETED', 'FAILED'].includes(ev.status),
                      }"
                    >
                      {{ ev.status }}
                    </span>
                  </div>
                  <p v-if="ev.message" class="text-xs text-gray-500 mt-0.5 truncate">{{ ev.message }}</p>
                </div>
                <span class="text-xs text-gray-600 shrink-0">{{ new Date(ev.timestamp).toLocaleTimeString() }}</span>
              </div>
            </div>
          </div>

          <!-- Historical activities from project data -->
          <div v-if="project.activities && project.activities.length > 0">
            <p class="text-xs text-gray-500 mb-2">History</p>
            <div class="space-y-2">
              <div
                v-for="activity in project.activities"
                :key="activity.id"
                class="p-3 rounded-lg bg-gray-800 border border-gray-700"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-200">{{ activity.type }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded"
                      :class="{
                        'bg-blue-900/40 text-blue-400': activity.status === 'RUNNING',
                        'bg-emerald-900/40 text-emerald-400': activity.status === 'COMPLETED',
                        'bg-red-900/40 text-red-400': activity.status === 'FAILED',
                        'bg-gray-800 text-gray-400': !['RUNNING', 'COMPLETED', 'FAILED'].includes(activity.status),
                      }"
                    >
                      {{ activity.status }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-600">{{ formatDate(activity.startedAt) }}</span>
                </div>
                <div v-if="activity.entries.length > 0" class="space-y-1">
                  <div
                    v-for="entry in activity.entries"
                    :key="entry.id"
                    class="flex items-center gap-2 text-xs"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="{
                        'bg-blue-400': entry.status === 'RUNNING',
                        'bg-emerald-400': entry.status === 'COMPLETED',
                        'bg-red-400': entry.status === 'FAILED',
                        'bg-gray-500': !['RUNNING', 'COMPLETED', 'FAILED'].includes(entry.status),
                      }"
                    />
                    <span class="text-gray-400">{{ entry.taskName }}</span>
                    <span class="text-gray-600 truncate">{{ entry.message }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activityEvents.length === 0 && (!project.activities || project.activities.length === 0)" class="text-sm text-gray-600">
            No activity yet. Trigger an action to see live updates here.
          </div>
        </div>
      </div>
    </template>

    <!-- Catalog detail overlay (slide-over) -->
    <Teleport to="body">
      <div
        v-if="selectedPatternId && selectedCatalogEntry && activeTab === 'overview'"
        class="fixed inset-0 z-50 flex justify-end"
      >
        <div class="absolute inset-0 bg-black/50" @click="selectedPatternId = null" />
        <div class="relative w-full max-w-lg bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto">
          <button
            class="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
            @click="selectedPatternId = null"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 class="text-lg font-semibold text-gray-100 mb-1">{{ selectedCatalogEntry.name }}</h2>
          <p class="text-xs text-gray-500 mb-4">{{ selectedCatalogEntry.id }} v{{ selectedCatalogEntry.version }}</p>
          <p class="text-sm text-gray-300 whitespace-pre-line mb-5">{{ selectedCatalogEntry.description }}</p>

          <div v-if="selectedCatalogEntry.provides.length > 0" class="mb-5">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Capabilities Provided</h3>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="cap in selectedCatalogEntry.provides"
                :key="cap"
                class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
              >
                {{ cap }}
              </span>
            </div>
          </div>

          <div v-if="selectedCatalogEntry.preconditions.length > 0" class="mb-5">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Preconditions</h3>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="pre in selectedCatalogEntry.preconditions"
                :key="pre"
                class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/50"
              >
                {{ pre }}
              </span>
            </div>
          </div>

          <div v-if="Object.keys(selectedCatalogEntry.parameters).length > 0" class="mb-5">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Parameters</h3>
            <div class="space-y-2">
              <div
                v-for="(param, key) in selectedCatalogEntry.parameters"
                :key="key"
                class="text-xs"
              >
                <div class="flex items-center gap-2">
                  <code class="text-emerald-400 font-mono">{{ key }}</code>
                  <span class="text-gray-500">{{ param.type || 'string' }}</span>
                  <span v-if="param.required" class="text-red-400">required</span>
                  <span v-if="param.default !== undefined" class="text-gray-600">= {{ param.default }}</span>
                </div>
                <p v-if="param.description" class="text-gray-400 mt-0.5 ml-0">{{ param.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
