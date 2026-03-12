<script setup lang="ts">
const route = useRoute()
const orgId = route.params.orgId as string

const org = ref<any>(null)
const members = ref<any[]>([])
const loading = ref(true)
const error = ref('')

// Add member form
const showAddMember = ref(false)
const memberEmail = ref('')
const memberFirstName = ref('')
const memberLastName = ref('')
const adding = ref(false)
const addError = ref('')
const addSuccess = ref('')

// Delete org
const confirmDelete = ref(false)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [orgData, membersData] = await Promise.all([
      $fetch<any>(`/api/orgs/${orgId}`),
      $fetch<any[]>(`/api/orgs/${orgId}/members`),
    ])
    org.value = orgData
    members.value = membersData
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load organization'
  } finally {
    loading.value = false
  }
}

async function addMember() {
  if (!memberEmail.value.trim()) return
  adding.value = true
  addError.value = ''
  addSuccess.value = ''
  try {
    await $fetch(`/api/orgs/${orgId}/members`, {
      method: 'POST',
      body: {
        email: memberEmail.value.trim(),
        firstName: memberFirstName.value.trim(),
        lastName: memberLastName.value.trim(),
      },
    })
    addSuccess.value = `Added ${memberEmail.value}`
    memberEmail.value = ''
    memberFirstName.value = ''
    memberLastName.value = ''
    showAddMember.value = false
    // Refresh members
    members.value = await $fetch<any[]>(`/api/orgs/${orgId}/members`)
  } catch (e: any) {
    addError.value = e.data?.message || 'Failed to add member'
  } finally {
    adding.value = false
  }
}

async function removeMember(memberId: string) {
  try {
    await $fetch(`/api/orgs/${orgId}/members/${memberId}`, { method: 'DELETE' })
    members.value = members.value.filter((m) => m.id !== memberId)
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to remove member'
  }
}

async function deleteOrg() {
  deleting.value = true
  try {
    await $fetch(`/api/orgs/${orgId}`, { method: 'DELETE' })
    const { fetchOrgs } = useOrg()
    await fetchOrgs()
    await navigateTo('/orgs')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to delete organization'
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-2xl">
    <NuxtLink to="/orgs" class="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
      &larr; All organizations
    </NuxtLink>

    <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>

    <template v-if="org && !loading">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-semibold">{{ org.name }}</h1>
          <p v-if="org.description" class="text-sm text-gray-500 mt-1">{{ org.description }}</p>
        </div>
      </div>

      <!-- Members -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-gray-400">Members ({{ members.length }})</h2>
          <button
            class="px-3 py-1 rounded bg-gray-700 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            @click="showAddMember = !showAddMember"
          >
            {{ showAddMember ? 'Cancel' : 'Add member' }}
          </button>
        </div>

        <div v-if="addError" class="mb-3 p-2 rounded bg-red-900/40 text-red-300 text-sm">{{ addError }}</div>
        <div v-if="addSuccess" class="mb-3 p-2 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ addSuccess }}</div>

        <!-- Add member form -->
        <form v-if="showAddMember" class="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="addMember">
          <p class="text-xs text-gray-500">
            Enter the email of an existing user, or a new email to pre-create their account. They'll need to sign in with Google to claim it.
          </p>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Email</label>
            <input
              v-model="memberEmail"
              type="email"
              placeholder="user@example.com"
              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-gray-400 mb-1">First name (optional)</label>
              <input
                v-model="memberFirstName"
                type="text"
                class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Last name (optional)</label>
              <input
                v-model="memberLastName"
                type="text"
                class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            :disabled="adding || !memberEmail.trim()"
            class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {{ adding ? 'Adding...' : 'Add member' }}
          </button>
        </form>

        <!-- Members list -->
        <div v-if="members.length === 0" class="text-gray-500 text-sm">No members yet.</div>
        <div class="space-y-1">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-200">
                {{ [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email }}
              </p>
              <p class="text-xs text-gray-500">{{ member.email }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="!member.emailVerified" class="text-xs px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
                Pending
              </span>
              <button
                class="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Remove member"
                @click="removeMember(member.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="mt-8 pt-6 border-t border-gray-700">
        <h2 class="text-sm font-medium text-red-400 mb-3">Danger zone</h2>
        <div v-if="!confirmDelete">
          <button
            class="px-3 py-1.5 rounded border border-red-700 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
            @click="confirmDelete = true"
          >
            Delete organization
          </button>
        </div>
        <div v-else class="flex items-center gap-3">
          <span class="text-sm text-gray-400">Are you sure?</span>
          <button
            :disabled="deleting"
            class="px-3 py-1.5 rounded bg-red-700 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            @click="deleteOrg"
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
