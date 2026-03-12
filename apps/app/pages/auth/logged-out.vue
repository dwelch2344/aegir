<script setup lang="ts">
definePageMeta({ layout: false, oidcAuth: { enabled: false } })
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
    <div class="text-center">
      <h1 class="text-2xl font-semibold mb-4">You've been logged out</h1>
      <NuxtLink to="/" class="text-emerald-400 hover:text-emerald-300 underline">
        Return to app
      </NuxtLink>
    </div>
  </div>
</template>
