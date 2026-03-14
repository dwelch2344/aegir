<script setup lang="ts">
const { activeOrg } = useOrg()
const { projects, loading, fetchProjects, addProject, syncProject, deleteProject } = useProjects()

const showAdd = ref(false)
const form = reactive({ name: '', repoUrl: '', branch: 'main' })
const adding = ref(false)
const error = ref('')

async function load() {
  if (!activeOrg.value) return
  await fetchProjects(activeOrg.value.id)
}

async function handleAdd() {
  if (!form.name.trim() || !form.repoUrl.trim() || !activeOrg.value) return
  adding.value = true
  error.value = ''
  try {
    await addProject({
      organizationId: activeOrg.value.id,
      name: form.name.trim(),
      repoUrl: form.repoUrl.trim(),
      branch: form.branch.trim() || 'main',
    })
    form.name = ''
    form.repoUrl = ''
    form.branch = 'main'
    showAdd.value = false
  } catch (e: any) {
    error.value = e.message || 'Failed to add project'
  } finally {
    adding.value = false
  }
}

async function handleSync(id: string) {
  try {
    await syncProject(id)
    // Refresh after a short delay to pick up status change
    setTimeout(() => load(), 1500)
  } catch (e: any) {
    error.value = e.message || 'Sync failed'
  }
}

async function handleDelete(id: string) {
  try {
    await deleteProject(id)
  } catch (e: any) {
    error.value = e.message || 'Delete failed'
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
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
watch(activeOrg, load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-100">Projects</h1>
        <p class="mt-1 text-sm text-gray-400">Manage your Shipyard projects</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        @click="showAdd = !showAdd"
      >
        {{ showAdd ? 'Cancel' : 'Add project' }}
      </button>
    </div>

    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>

    <!-- Add project form -->
    <form
      v-if="showAdd"
      class="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3"
      @submit.prevent="handleAdd"
    >
      <div>
        <label class="block text-sm text-gray-400 mb-1">Project name</label>
        <input
          v-model="form.name"
          type="text"
          placeholder="my-project"
          class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Repository URL</label>
        <input
          v-model="form.repoUrl"
          type="text"
          placeholder="https://github.com/org/repo.git"
          class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Branch</label>
        <input
          v-model="form.branch"
          type="text"
          placeholder="main"
          class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <button
        type="submit"
        :disabled="adding || !form.name.trim() || !form.repoUrl.trim()"
        class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {{ adding ? 'Adding...' : 'Add project' }}
      </button>
    </form>

    <!-- Loading -->
    <div v-if="loading" class="text-gray-400 text-sm">Loading projects...</div>

    <!-- Empty state -->
    <div v-else-if="projects.length === 0" class="text-center py-12">
      <p class="text-gray-500 text-sm">No projects yet. Add a repository to get started.</p>
    </div>

    <!-- Project list -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="project in projects"
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="block p-4 rounded-lg bg-gray-900 border border-gray-700 hover:border-gray-600 transition-colors group"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-medium text-gray-100 group-hover:text-emerald-400 transition-colors">
                {{ project.name }}
              </h3>
              <span class="text-xs px-2 py-0.5 rounded" :class="statusColor(project.status)">
                {{ project.status }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1 truncate">{{ project.repoUrl }}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{{ project.services.length }} services</span>
              <span>{{ project.patterns.length }} patterns</span>
              <span>Synced: {{ formatDate(project.lastSyncedAt) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-4" @click.prevent>
            <button
              class="px-2.5 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              title="Re-sync"
              @click="handleSync(project.id)"
            >
              Sync
            </button>
            <button
              class="p-1 text-gray-600 hover:text-red-400 transition-colors"
              title="Delete"
              @click="handleDelete(project.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
