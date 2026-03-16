<script setup lang="ts">
const { catalog, catalogLoading, fetchCatalog } = useCatalog()
const expandedId = ref<string | null>(null)

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function categoryColor(id: string) {
  const cat = id.split('.')[0]
  switch (cat) {
    case 'agents': return 'bg-purple-900/40 text-purple-300'
    case 'api': return 'bg-blue-900/40 text-blue-300'
    case 'auth': return 'bg-yellow-900/40 text-yellow-300'
    case 'build': return 'bg-gray-700 text-gray-300'
    case 'cdc': return 'bg-orange-900/40 text-orange-300'
    case 'db': return 'bg-cyan-900/40 text-cyan-300'
    case 'email': return 'bg-pink-900/40 text-pink-300'
    case 'frontend': return 'bg-green-900/40 text-green-300'
    case 'harness': return 'bg-emerald-900/40 text-emerald-300'
    case 'infra': return 'bg-red-900/40 text-red-300'
    case 'observability': return 'bg-indigo-900/40 text-indigo-300'
    case 'orchestration': return 'bg-violet-900/40 text-violet-300'
    case 'service': return 'bg-sky-900/40 text-sky-300'
    case 'storage': return 'bg-amber-900/40 text-amber-300'
    case 'tenancy': return 'bg-teal-900/40 text-teal-300'
    default: return 'bg-gray-800 text-gray-400'
  }
}

onMounted(fetchCatalog)
</script>

<template>
  <div class="max-w-4xl">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-gray-100">Catalog</h1>
      <p class="text-sm text-gray-500 mt-1">Reusable patterns available to apply to any ship.</p>
    </div>

    <div v-if="catalogLoading" class="text-sm text-gray-400">Loading catalog...</div>

    <div v-else class="space-y-3">
      <div
        v-for="entry in catalog"
        :key="entry.id"
        class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden transition-all"
      >
        <!-- Header (always visible) -->
        <button
          class="w-full text-left px-5 py-4 hover:bg-gray-750 transition-colors flex items-start gap-4"
          @click="toggle(entry.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-gray-100">{{ entry.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded" :class="categoryColor(entry.patternId)">
                {{ entry.patternId }}
              </span>
              <span class="text-xs text-gray-600">v{{ entry.version }}</span>
            </div>
            <p class="text-sm text-gray-400 line-clamp-2">{{ entry.description }}</p>
          </div>
          <svg
            class="w-4 h-4 text-gray-500 mt-1 shrink-0 transition-transform"
            :class="{ 'rotate-180': expandedId === entry.id }"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <!-- Expanded detail -->
        <div v-if="expandedId === entry.id" class="border-t border-gray-700 px-5 py-4 space-y-4">
          <!-- Description -->
          <div>
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-1">Description</h3>
            <p class="text-sm text-gray-300 whitespace-pre-line">{{ entry.description }}</p>
          </div>

          <!-- Provides -->
          <div v-if="entry.provides.length > 0">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Capabilities Provided</h3>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="cap in entry.provides"
                :key="cap"
                class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
              >
                {{ cap }}
              </span>
            </div>
          </div>

          <!-- Preconditions -->
          <div v-if="entry.preconditions.length > 0">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Preconditions</h3>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="pre in entry.preconditions"
                :key="pre"
                class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/50"
              >
                {{ pre }}
              </span>
            </div>
          </div>

          <!-- Parameters -->
          <div v-if="Object.keys(entry.parameters).length > 0">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Parameters</h3>
            <div class="space-y-2">
              <div
                v-for="(param, key) in entry.parameters"
                :key="key"
                class="flex items-start gap-3 text-xs"
              >
                <code class="text-emerald-400 font-mono shrink-0 mt-0.5">{{ key }}</code>
                <div class="min-w-0">
                  <span class="text-gray-500">{{ param.type || 'string' }}</span>
                  <span v-if="param.required" class="text-red-400 ml-1">required</span>
                  <span v-if="param.default !== undefined" class="text-gray-600 ml-1">
                    default: {{ param.default }}
                  </span>
                  <p v-if="param.description" class="text-gray-400 mt-0.5">{{ param.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Application instructions -->
          <div v-if="entry.applicationInstructions">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-1">Application Instructions</h3>
            <pre class="text-xs text-gray-300 whitespace-pre-wrap bg-gray-900 rounded p-3 border border-gray-700">{{ entry.applicationInstructions }}</pre>
          </div>

          <!-- Test criteria -->
          <div v-if="entry.testCriteria">
            <h3 class="text-xs font-medium text-gray-500 uppercase mb-1">Test Criteria</h3>
            <pre class="text-xs text-gray-300 whitespace-pre-wrap bg-gray-900 rounded p-3 border border-gray-700">{{ entry.testCriteria }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!catalogLoading && catalog.length === 0" class="text-sm text-gray-500 mt-4">
      No catalog entries found. Check that the catalog directory exists.
    </div>
  </div>
</template>
