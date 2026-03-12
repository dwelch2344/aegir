<script setup lang="ts">
const { user, fetch: fetchSession } = useOidcAuth()

const profile = ref<{ firstName: string; lastName: string; email: string } | null>(null)
const saving = ref(false)
const error = ref('')
const success = ref('')

async function loadProfile() {
  try {
    const data = await $fetch<any>('/api/profile')
    profile.value = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load profile'
  }
}

async function saveProfile() {
  if (!profile.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/profile', {
      method: 'PATCH',
      body: profile.value,
    })
    success.value = 'Profile updated'
    await fetchSession()
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to update profile'
  } finally {
    saving.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="max-w-xl">
    <h1 class="text-xl font-semibold mb-6">Profile</h1>

    <div v-if="!profile && !error" class="text-gray-400 text-sm">Loading...</div>

    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>
    <div v-if="success" class="mb-4 p-3 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ success }}</div>

    <form v-if="profile" class="space-y-4" @submit.prevent="saveProfile">
      <div>
        <label class="block text-sm text-gray-400 mb-1">First name</label>
        <input
          v-model="profile.firstName"
          type="text"
          class="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Last name</label>
        <input
          v-model="profile.lastName"
          type="text"
          class="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Email</label>
        <input
          v-model="profile.email"
          type="email"
          class="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <button
        type="submit"
        :disabled="saving"
        class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save changes' }}
      </button>
    </form>

    <div class="mt-8 pt-6 border-t border-gray-700">
      <h2 class="text-sm font-medium text-gray-400 mb-2">Session info</h2>
      <dl class="space-y-1 text-sm">
        <div class="flex gap-2">
          <dt class="text-gray-500">Provider:</dt>
          <dd>{{ user?.provider }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="text-gray-500">Logged in:</dt>
          <dd>{{ user?.loggedInAt ? new Date(user.loggedInAt * 1000).toLocaleString() : '—' }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="text-gray-500">Expires:</dt>
          <dd>{{ user?.expireAt ? new Date(user.expireAt * 1000).toLocaleString() : '—' }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
