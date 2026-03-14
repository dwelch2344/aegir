<script setup lang="ts">
const route = useRoute()
const projectId = route.params.id as string

const { fetchProject, syncProject, deleteProject } = useProjects()

const project = ref<any>(null)
const loading = ref(true)
const error = ref('')
const syncing = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

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
  try {
    await syncProject(projectId)
    // Refresh after delay
    setTimeout(async () => {
      await load()
      syncing.value = false
    }, 2000)
  } catch (e: any) {
    error.value = e.message || 'Sync failed'
    syncing.value = false
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
        <button
          :disabled="syncing"
          class="px-3 py-1.5 rounded bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
          @click="handleSync"
        >
          {{ syncing ? 'Syncing...' : 'Re-sync' }}
        </button>
      </div>

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
      <div v-if="project.statusReport" class="mb-8">
        <h2 class="text-sm font-medium text-gray-400 mb-3">Status Report</h2>
        <div class="p-4 rounded-lg bg-gray-800 border border-gray-700">
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
