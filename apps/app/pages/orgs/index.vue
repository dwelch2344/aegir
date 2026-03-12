<script setup lang="ts">
const route = useRoute()
const { orgs, fetchOrgs } = useOrg()

const notice = computed(() => {
  if (route.query.reason === 'no-org') return 'Please join or create an organization to continue.'
  return ''
})

const showCreate = ref(false)
const newOrgName = ref('')
const newOrgDesc = ref('')
const creating = ref(false)
const error = ref('')

async function createOrg() {
  if (!newOrgName.value.trim()) return
  creating.value = true
  error.value = ''
  try {
    await $fetch('/api/orgs', {
      method: 'POST',
      body: { name: newOrgName.value.trim(), description: newOrgDesc.value.trim() },
    })
    newOrgName.value = ''
    newOrgDesc.value = ''
    showCreate.value = false
    await fetchOrgs()
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to create organization'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  fetchOrgs()
})
</script>

<template>
  <div class="max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Organizations</h1>
      <button
        class="px-3 py-1.5 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 transition-colors"
        @click="showCreate = !showCreate"
      >
        {{ showCreate ? 'Cancel' : 'New organization' }}
      </button>
    </div>

    <div v-if="notice" class="mb-4 p-3 rounded bg-amber-900/40 border border-amber-700/50 text-amber-300 text-sm">{{ notice }}</div>
    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>

    <!-- Create form -->
    <form v-if="showCreate" class="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="createOrg">
      <div>
        <label class="block text-sm text-gray-400 mb-1">Name</label>
        <input
          v-model="newOrgName"
          type="text"
          placeholder="Acme Corp"
          class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Description (optional)</label>
        <input
          v-model="newOrgDesc"
          type="text"
          class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <button
        type="submit"
        :disabled="creating || !newOrgName.trim()"
        class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {{ creating ? 'Creating...' : 'Create organization' }}
      </button>
    </form>

    <!-- Org list -->
    <div v-if="orgs.length === 0" class="text-gray-500 text-sm">
      No organizations yet. Create one to get started.
    </div>

    <div class="space-y-2">
      <NuxtLink
        v-for="org in orgs"
        :key="org.id"
        :to="`/orgs/${org.keycloakId}`"
        class="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
      >
        <div>
          <p class="text-sm font-medium text-gray-200">{{ org.name }}</p>
          <p class="text-xs text-gray-500 mt-0.5">{{ org.key }}</p>
        </div>
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </NuxtLink>
    </div>
  </div>
</template>
