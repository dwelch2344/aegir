<script setup lang="ts">
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

const { registry, registryLoading, saving, fetchRegistry, saveFile } = useContextRegistry()

const activeTier = ref<'global' | 'project' | 'topics'>('global')
const expandedFile = ref<string | null>(null)
const expandedTopic = ref<string | null>(null)
const editingFile = ref<string | null>(null)
const editContent = ref('')
const saveSuccess = ref<string | null>(null)

function toggleFile(path: string) {
  if (expandedFile.value === path) {
    expandedFile.value = null
    editingFile.value = null
  } else {
    expandedFile.value = path
    editingFile.value = null
  }
}

function toggleTopic(id: string) {
  expandedTopic.value = expandedTopic.value === id ? null : id
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

const tierTabs = [
  { key: 'global' as const, label: 'Global', desc: 'Always loaded' },
  { key: 'project' as const, label: 'Project', desc: 'Repo-specific' },
  { key: 'topics' as const, label: 'Topics', desc: 'On-demand' },
]

function tierColor(tier: string) {
  switch (tier) {
    case 'global': return 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50'
    case 'project': return 'bg-blue-900/40 text-blue-300 border-blue-800/50'
    case 'topics': return 'bg-purple-900/40 text-purple-300 border-purple-800/50'
    default: return 'bg-gray-800 text-gray-400 border-gray-700'
  }
}

onMounted(fetchRegistry)
</script>

<template>
  <div class="max-w-5xl">
    <div class="mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold text-gray-100">Context Registry</h1>
        <span v-if="registry" class="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
          v{{ registry.version }}
        </span>
      </div>
      <p class="text-sm text-gray-500 mt-1">
        Context layers loaded by AI agents during sessions. Global and project tiers load every session; topics load on-demand via triggers.
      </p>
    </div>

    <div v-if="registryLoading" class="text-sm text-gray-400">Loading context registry...</div>

    <template v-else-if="registry">
      <!-- Tier tabs -->
      <div class="flex gap-2 mb-6">
        <button
          v-for="tab in tierTabs"
          :key="tab.key"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
          :class="activeTier === tab.key
            ? tierColor(tab.key)
            : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-300'"
          @click="activeTier = tab.key"
        >
          <span>{{ tab.label }}</span>
          <span class="ml-1.5 text-xs opacity-60">{{ tab.desc }}</span>
        </button>
      </div>

      <!-- Tier description -->
      <p class="text-xs text-gray-500 mb-4">
        {{ registry.tiers[activeTier]?.description || registry.tiers.topics?.description }}
      </p>

      <!-- Global & Project tier file list -->
      <div v-if="activeTier === 'global' || activeTier === 'project'" class="space-y-3">
        <div
          v-for="file in registry.tiers[activeTier].files"
          :key="file.path"
          class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
        >
          <button
            class="w-full text-left px-5 py-4 hover:bg-gray-750 transition-colors flex items-start gap-4"
            @click="toggleFile(file.path)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <svg class="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <code class="text-sm font-mono text-gray-200">{{ file.path }}</code>
                <span v-if="saveSuccess === file.path" class="text-xs text-emerald-400">Saved</span>
              </div>
              <p class="text-sm text-gray-400">{{ file.description }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="file.content" class="text-xs text-gray-600">
                {{ file.content.split('\n').length }} lines
              </span>
              <svg
                class="w-4 h-4 text-gray-500 shrink-0 transition-transform"
                :class="{ 'rotate-180': expandedFile === file.path }"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <!-- Expanded content -->
          <div v-if="expandedFile === file.path" class="border-t border-gray-700 px-5 py-4">
            <template v-if="editingFile === file.path">
              <textarea
                v-model="editContent"
                class="w-full h-80 bg-gray-900 text-gray-200 text-xs font-mono rounded-lg p-3 border border-gray-700 resize-y outline-none focus:border-emerald-600"
              />
              <div class="flex items-center gap-2 mt-3">
                <button
                  class="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                  :disabled="saving"
                  @click="handleSave(file.path)"
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
                  @click="startEdit(file.path, file.content)"
                >
                  Edit
                </button>
              </div>
              <div v-if="file.content" class="prose-context text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto" v-html="renderMarkdown(file.content)" />
              <p v-else class="text-sm text-gray-500 italic">File not found on disk.</p>
            </template>
          </div>
        </div>

        <div v-if="registry.tiers[activeTier].files.length === 0" class="text-sm text-gray-500">
          No context files in this tier.
        </div>
      </div>

      <!-- Topics tier -->
      <div v-if="activeTier === 'topics'" class="space-y-3">
        <div
          v-for="topic in registry.tiers.topics.entries"
          :key="topic.id"
          class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
        >
          <!-- Topic header -->
          <button
            class="w-full text-left px-5 py-4 hover:bg-gray-750 transition-colors flex items-start gap-4"
            @click="toggleTopic(topic.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-gray-100 capitalize">{{ topic.id }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">topic</span>
                <span v-if="saveSuccess === topic.system || saveSuccess === topic.project" class="text-xs text-emerald-400">Saved</span>
              </div>
              <!-- Trigger pills -->
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="kw in topic.triggers.keywords.slice(0, 5)"
                  :key="kw"
                  class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400"
                >
                  {{ kw }}
                </span>
                <span v-if="topic.triggers.keywords.length > 5" class="text-xs text-gray-600">
                  +{{ topic.triggers.keywords.length - 5 }} more
                </span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right text-xs text-gray-600">
                <div v-if="topic.systemContent">system</div>
                <div v-if="topic.projectContent">project</div>
              </div>
              <svg
                class="w-4 h-4 text-gray-500 shrink-0 transition-transform"
                :class="{ 'rotate-180': expandedTopic === topic.id }"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <!-- Expanded topic -->
          <div v-if="expandedTopic === topic.id" class="border-t border-gray-700 px-5 py-4 space-y-5">
            <!-- Triggers -->
            <div>
              <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Triggers</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">File patterns</p>
                  <div class="flex flex-wrap gap-1">
                    <code
                      v-for="fp in topic.triggers.files"
                      :key="fp"
                      class="text-xs px-1.5 py-0.5 rounded bg-gray-900 text-amber-300 font-mono"
                    >
                      {{ fp }}
                    </code>
                  </div>
                  <p v-if="topic.triggers.files.length === 0" class="text-xs text-gray-600 italic">None</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">Keywords</p>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="kw in topic.triggers.keywords"
                      :key="kw"
                      class="text-xs px-1.5 py-0.5 rounded bg-gray-900 text-blue-300"
                    >
                      {{ kw }}
                    </span>
                  </div>
                  <p v-if="topic.triggers.keywords.length === 0" class="text-xs text-gray-600 italic">None</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">Catalog refs</p>
                  <div class="flex flex-wrap gap-1">
                    <code
                      v-for="ref in topic.triggers.catalog_refs"
                      :key="ref"
                      class="text-xs px-1.5 py-0.5 rounded bg-gray-900 text-emerald-300 font-mono"
                    >
                      {{ ref }}
                    </code>
                  </div>
                  <p v-if="topic.triggers.catalog_refs.length === 0" class="text-xs text-gray-600 italic">None</p>
                </div>
              </div>
            </div>

            <!-- System-level context file -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <h3 class="text-xs font-medium text-gray-500 uppercase">System Context</h3>
                  <code class="text-xs text-gray-600 font-mono">{{ topic.system }}</code>
                </div>
                <button
                  v-if="topic.systemContent && editingFile !== topic.system"
                  class="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                  @click="startEdit(topic.system, topic.systemContent)"
                >
                  Edit
                </button>
              </div>
              <template v-if="editingFile === topic.system">
                <textarea
                  v-model="editContent"
                  class="w-full h-64 bg-gray-900 text-gray-200 text-xs font-mono rounded-lg p-3 border border-gray-700 resize-y outline-none focus:border-emerald-600"
                />
                <div class="flex items-center gap-2 mt-2">
                  <button
                    class="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                    :disabled="saving"
                    @click="handleSave(topic.system)"
                  >
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                  <button class="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" @click="cancelEdit">Cancel</button>
                </div>
              </template>
              <div v-else-if="topic.systemContent" class="prose-context text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-700 max-h-64 overflow-y-auto" v-html="renderMarkdown(topic.systemContent)" />
              <p v-else class="text-xs text-gray-600 italic">Not created yet.</p>
            </div>

            <!-- Project-level context file -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <h3 class="text-xs font-medium text-gray-500 uppercase">Project Context</h3>
                  <code class="text-xs text-gray-600 font-mono">{{ topic.project }}</code>
                </div>
                <button
                  v-if="topic.projectContent && editingFile !== topic.project"
                  class="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                  @click="startEdit(topic.project, topic.projectContent)"
                >
                  Edit
                </button>
              </div>
              <template v-if="editingFile === topic.project">
                <textarea
                  v-model="editContent"
                  class="w-full h-64 bg-gray-900 text-gray-200 text-xs font-mono rounded-lg p-3 border border-gray-700 resize-y outline-none focus:border-emerald-600"
                />
                <div class="flex items-center gap-2 mt-2">
                  <button
                    class="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                    :disabled="saving"
                    @click="handleSave(topic.project)"
                  >
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                  <button class="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" @click="cancelEdit">Cancel</button>
                </div>
              </template>
              <div v-else-if="topic.projectContent" class="prose-context text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-700 max-h-64 overflow-y-auto" v-html="renderMarkdown(topic.projectContent)" />
              <p v-else class="text-xs text-gray-600 italic">Not created yet.</p>
            </div>
          </div>
        </div>

        <div v-if="registry.tiers.topics.entries.length === 0" class="text-sm text-gray-500">
          No topics defined.
        </div>
      </div>
    </template>

    <div v-else class="text-sm text-gray-500">
      Context registry not found. Ensure <code class="text-gray-400">.agents/context/registry.yaml</code> exists.
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
