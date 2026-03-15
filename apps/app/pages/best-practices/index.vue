<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

const { registry, registryLoading, saving, fetchRegistry, saveFile } = useBcpRegistry()

const activeCategory = ref<string | null>(null)
const expandedEntry = ref<string | null>(null)
const editingFile = ref<string | null>(null)
const editContent = ref('')
const saveSuccess = ref<string | null>(null)

// Set first category as active once loaded
watch(registry, (reg) => {
  if (reg && reg.categories.length > 0 && !activeCategory.value) {
    activeCategory.value = reg.categories[0].id
  }
})

const currentCategory = computed(() =>
  registry.value?.categories.find(c => c.id === activeCategory.value) ?? null,
)

function toggleEntry(path: string) {
  if (expandedEntry.value === path) {
    expandedEntry.value = null
    editingFile.value = null
  } else {
    expandedEntry.value = path
    editingFile.value = null
  }
}

function startEdit(path: string, content: string | null) {
  editingFile.value = path
  editContent.value = content ?? ''
}

function cancelEdit() {
  editingFile.value = null
  editContent.value = ''
}

async function handleSave(path: string) {
  try {
    await saveFile(path, editContent.value)
    editingFile.value = null
    saveSuccess.value = path
    setTimeout(() => { saveSuccess.value = null }, 2000)
  } catch {
    // error logged in composable
  }
}

function categoryColor(color: string) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
    blue: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
    emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
    red: 'bg-red-900/40 text-red-300 border-red-800/50',
    purple: 'bg-purple-900/40 text-purple-300 border-purple-800/50',
    cyan: 'bg-cyan-900/40 text-cyan-300 border-cyan-800/50',
  }
  return colors[color] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

function categoryBadgeColor(color: string) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-900/40 text-amber-300',
    blue: 'bg-blue-900/40 text-blue-300',
    emerald: 'bg-emerald-900/40 text-emerald-300',
    red: 'bg-red-900/40 text-red-300',
    purple: 'bg-purple-900/40 text-purple-300',
    cyan: 'bg-cyan-900/40 text-cyan-300',
  }
  return colors[color] ?? 'bg-gray-800 text-gray-400'
}

onMounted(fetchRegistry)
</script>

<template>
  <div class="max-w-5xl">
    <div class="mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold text-gray-100">Best Practices</h1>
        <span v-if="registry" class="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
          v{{ registry.version }}
        </span>
      </div>
      <p class="text-sm text-gray-500 mt-1">
        Best Current Practices (BCPs) — general architectural knowledge, design patterns, and proven approaches for building software.
      </p>
    </div>

    <div v-if="registryLoading" class="text-sm text-gray-400">Loading BCP registry...</div>

    <template v-else-if="registry">
      <!-- Category tabs -->
      <div class="flex flex-wrap gap-2 mb-6">
        <button
          v-for="cat in registry.categories"
          :key="cat.id"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
          :class="activeCategory === cat.id
            ? categoryColor(cat.color)
            : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-300'"
          @click="activeCategory = cat.id"
        >
          <span>{{ cat.label }}</span>
          <span class="ml-1.5 text-xs opacity-60">{{ cat.entries.length }}</span>
        </button>
      </div>

      <!-- Category description -->
      <p v-if="currentCategory" class="text-xs text-gray-500 mb-4">
        {{ currentCategory.description }}
      </p>

      <!-- BCP entries -->
      <div v-if="currentCategory" class="space-y-3">
        <div
          v-for="entry in currentCategory.entries"
          :key="entry.id"
          class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
        >
          <button
            class="w-full text-left px-5 py-4 hover:bg-gray-750 transition-colors flex items-start gap-4"
            @click="toggleEntry(entry.path)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <svg class="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
                <span class="text-sm font-medium text-gray-200">{{ entry.title }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded" :class="categoryBadgeColor(currentCategory.color)">
                  {{ entry.id }}
                </span>
                <span v-if="saveSuccess === entry.path" class="text-xs text-emerald-400">Saved</span>
              </div>
              <p class="text-sm text-gray-400">{{ entry.description }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="entry.content" class="text-xs text-gray-600">
                {{ entry.content.split('\n').length }} lines
              </span>
              <svg
                class="w-4 h-4 text-gray-500 shrink-0 transition-transform"
                :class="{ 'rotate-180': expandedEntry === entry.path }"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <!-- Expanded content -->
          <div v-if="expandedEntry === entry.path" class="border-t border-gray-700 px-5 py-4">
            <template v-if="editingFile === entry.path">
              <textarea
                v-model="editContent"
                class="w-full h-80 bg-gray-900 text-gray-200 text-xs font-mono rounded-lg p-3 border border-gray-700 resize-y outline-none focus:border-emerald-600"
              />
              <div class="flex items-center gap-2 mt-3">
                <button
                  class="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                  :disabled="saving"
                  @click="handleSave(entry.path)"
                >
                  {{ saving ? 'Saving...' : 'Save' }}
                </button>
                <button
                  class="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  @click="cancelEdit"
                >
                  Cancel
                </button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-medium text-gray-500 uppercase">Content</span>
                <button
                  class="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                  @click="startEdit(entry.path, entry.content)"
                >
                  Edit
                </button>
              </div>
              <div v-if="entry.content" class="prose-context text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto" v-html="renderMarkdown(entry.content)" />
              <p v-else class="text-sm text-gray-500 italic">No content yet. Click Edit to start writing.</p>
            </template>
          </div>
        </div>

        <div v-if="currentCategory.entries.length === 0" class="text-center py-12">
          <svg class="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
          <p class="text-sm text-gray-500">No BCPs in this category yet.</p>
          <p class="text-xs text-gray-600 mt-1">Add entries to the BCP registry to get started.</p>
        </div>
      </div>
    </template>

    <div v-else class="text-sm text-gray-500">
      BCP registry not found. Ensure <code class="text-gray-400">.agents/bcp/registry.yaml</code> exists.
    </div>
  </div>
</template>

<style scoped>
.prose-context :deep(p) { margin: 0.25em 0; }
.prose-context :deep(p:first-child) { margin-top: 0; }
.prose-context :deep(p:last-child) { margin-bottom: 0; }
.prose-context :deep(ul), .prose-context :deep(ol) { margin: 0.4em 0; padding-left: 1.4em; }
.prose-context :deep(ul) { list-style-type: disc; }
.prose-context :deep(ol) { list-style-type: decimal; }
.prose-context :deep(li) { margin: 0.15em 0; }
.prose-context :deep(strong) { font-weight: 600; }
.prose-context :deep(em) { font-style: italic; }
.prose-context :deep(code) { background: rgba(255,255,255,0.1); padding: 0.15em 0.35em; border-radius: 0.25em; font-size: 0.875em; }
.prose-context :deep(pre) { background: rgba(0,0,0,0.3); padding: 0.75em 1em; border-radius: 0.5em; overflow-x: auto; margin: 0.5em 0; }
.prose-context :deep(pre code) { background: none; padding: 0; }
.prose-context :deep(h1), .prose-context :deep(h2), .prose-context :deep(h3) { font-weight: 600; margin: 0.5em 0 0.25em; }
.prose-context :deep(h1) { font-size: 1.2em; }
.prose-context :deep(h2) { font-size: 1.1em; }
.prose-context :deep(h3) { font-size: 1.05em; }
.prose-context :deep(a) { color: #6ee7b7; text-decoration: underline; }
.prose-context :deep(hr) { border-color: rgba(255,255,255,0.1); margin: 0.5em 0; }
.prose-context :deep(blockquote) { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 0.75em; margin: 0.4em 0; opacity: 0.85; }
</style>
