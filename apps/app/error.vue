<script setup lang="ts">
const props = defineProps<{ error: any }>()

// 401 = session expired — redirect to login on client
if (props.error?.statusCode === 401 && import.meta.client) {
  navigateTo('/auth/oidc/login', { external: true })
}

function handleClear() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
    <div v-if="error?.statusCode === 401" class="text-center">
      <p class="text-lg mb-4">Session expired. Redirecting to login...</p>
    </div>
    <div v-else class="text-center">
      <h1 class="text-4xl font-bold mb-2">{{ error?.statusCode || 'Error' }}</h1>
      <p class="text-gray-400 mb-6">{{ error?.statusMessage || 'Something went wrong' }}</p>
      <button
        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
        @click="handleClear"
      >
        Go home
      </button>
    </div>
  </div>
</template>
