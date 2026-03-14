<script setup lang="ts">
const route = useRoute()
const projectId = route.params.id as string

const { fetchProject, syncProject, deleteProject, checkStatus, applyPattern } = useProjects()

const project = ref<any>(null)
const loading = ref(true)
const error = ref('')
const success = ref('')
const syncing = ref(false)
const checking = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

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

    // Refresh after workflow runs
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

onMounted(load)
</script>

<template>
  <div class="max-w-3xl">
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

      <!-- Actions bar -->
      <div class="mb-6 flex items-center gap-2">
        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          @click="showApply = !showApply"
        >
          {{ showApply ? 'Cancel' : 'Apply pattern' }}
        </button>
      </div>

      <!-- Apply pattern form -->
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

      <!-- Patterns -->
      <div class="mb-8">
        <h2 class="text-sm font-medium text-gray-400 mb-3">Patterns ({{ project.patterns.length }})</h2>
        <div v-if="project.patterns.length === 0" class="text-sm text-gray-600">No patterns applied.</div>
        <div v-else class="space-y-2">
          <div
            v-for="pat in project.patterns"
            :key="pat.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
          >
            <div>
              <p class="text-sm text-gray-200">{{ pat.patternId }}</p>
              <p class="text-xs text-gray-500">v{{ pat.version }} &middot; Applied: {{ formatDate(pat.appliedAt) }}</p>
            </div>
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
    </template>
  </div>
</template>
