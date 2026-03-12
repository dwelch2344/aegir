<script setup lang="ts">
const { getStoredWorkflows } = useContracting()
const { activeOrgId } = useOrg()

const workflows = ref<{ workflowId: string; agentName: string; startedAt: string; organizationId: number }[]>([])

function refreshWorkflows() {
  workflows.value = getStoredWorkflows()
}

onMounted(refreshWorkflows)

watch(activeOrgId, refreshWorkflows)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-100">Office</h1>
        <p class="mt-1 text-sm text-gray-400">Documents, workflows, and day-to-day operations</p>
      </div>
      <NuxtLink to="/office/contracting/new"
        class="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">
        New Contract
      </NuxtLink>
    </div>

    <!-- Contracting Section -->
    <div class="mt-6">
      <h2 class="text-sm font-medium text-gray-300 uppercase tracking-wide mb-3">Contracting Workflows</h2>

      <div v-if="workflows.length === 0" class="rounded-lg border border-gray-700 bg-gray-900 p-6">
        <p class="text-gray-400 text-sm">No contracting workflows yet. Start one by clicking "New Contract" above.</p>
      </div>

      <div v-else class="rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
        <NuxtLink v-for="wf in workflows" :key="wf.workflowId"
          :to="`/office/contracting/${wf.workflowId}`"
          class="flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors">
          <div>
            <p class="text-sm font-medium text-gray-200">{{ wf.agentName }}</p>
            <p class="text-xs text-gray-500 font-mono mt-0.5">{{ wf.workflowId }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500">{{ formatDate(wf.startedAt) }}</p>
            <p class="text-xs text-gray-400 mt-0.5">Select Health ACA</p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
