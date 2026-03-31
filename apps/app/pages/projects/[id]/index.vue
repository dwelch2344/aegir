<script setup lang="ts">
const route = useRoute()
const projectId = route.params.id as string

import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })
function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

const { fetchProject, updateProject, syncProject, deleteProject, checkStatus, applyPattern, runDiagnostics, subscribeToActivity } = useProjects()
const { catalog, catalogLoading, catalogError, fetchCatalog } = useCatalog()
const agent = useAgent()

const project = ref<any>(null)
const loading = ref(true)
const error = ref('')
const success = ref('')
const syncing = ref(false)
const checking = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

// Tabs
const activeTab = ref<'overview' | 'patterns' | 'actions' | 'context' | 'agent'>('overview')

// Apply pattern form
const applying = ref(false)
const applyingPatternId = ref<string | null>(null)
const applyForm = reactive({
  name: '',
  port: '',
  entity: '',
  fields: '',
})

// Unified pattern list: merge catalog with applied state
const patternRows = computed(() => {
  if (!project.value) return []
  const applied = project.value.patterns || []
  return catalog.value.map((entry: any) => {
    const match = applied.find((p: any) => p.patternId === entry.patternId)
    return {
      ...entry,
      applied: !!match,
      appliedVersion: match?.version ?? null,
      appliedAt: match?.appliedAt ?? null,
    }
  })
})

// Expanded detail row
const expandedPatternId = ref<string | null>(null)

// Diagnostics
const diagRunning = ref(false)
const showReportModal = ref(false)
const reportModalContent = ref('')
const reportModalDate = ref('')

// Activity feed
import type { ProjectActivityEvent } from '~/composables/useProjects'
const activityEvents = ref<ProjectActivityEvent[]>([])
let unsubActivity: (() => void) | null = null

// Context notes
const contextNotesEdit = ref('')
const contextEditing = ref(false)
const contextSaving = ref(false)

function startEditContext() {
  contextNotesEdit.value = project.value?.contextNotes || ''
  contextEditing.value = true
}

async function saveContextNotes() {
  contextSaving.value = true
  try {
    await updateProject(projectId, { contextNotes: contextNotesEdit.value || null })
    if (project.value) project.value.contextNotes = contextNotesEdit.value || null
    contextEditing.value = false
  } catch (e: any) {
    error.value = e.message || 'Failed to save context notes'
  } finally {
    contextSaving.value = false
  }
}

// Agent chat
const agentInput = ref('')
const agentChatContainer = ref<HTMLElement | null>(null)
const agentTextarea = ref<HTMLTextAreaElement | null>(null)

// Project-scoped conversations
const projectConversations = computed(() =>
  agent.conversations.value.filter((c: any) => c.projectId === projectId)
)

function autoResizeAgent(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(agentInput, () => {
  nextTick(() => autoResizeAgent(agentTextarea.value))
})

watch(
  () => agent.messages.value,
  () => {
    nextTick(() => {
      if (agentChatContainer.value) {
        agentChatContainer.value.scrollTop = agentChatContainer.value.scrollHeight
      }
    })
  },
  { deep: true },
)

async function handleAgentSend() {
  const text = agentInput.value.trim()
  if (!text || agent.processing.value) return
  agentInput.value = ''
  nextTick(() => autoResizeAgent(agentTextarea.value))

  // Prepend project context to first message in the conversation
  const isFirst = agent.messages.value.length === 0
  let contextPrefix = ''
  if (isFirst && project.value) {
    contextPrefix = `[Project context: "${project.value.name}", repo: ${project.value.repoUrl}, branch: ${project.value.branch}, local: ${project.value.localPath || 'not cloned'}]\n\n`
    if (project.value.contextNotes) {
      contextPrefix += `[Project notes:\n${project.value.contextNotes}\n]\n\n`
    }
  }

  await agent.sendMessage(contextPrefix + text, projectId)
}

function handleAgentKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleAgentSend()
  }
}

function stripContextPrefix(text: string): string {
  return text.replace(/^\[Project context:[^\]]*\]\n\n/, '').replace(/^\[Project notes:\n[\s\S]*?\n\]\n\n/, '')
}

function handleNewAgentChat() {
  agent.disconnect()
  agent.newConversation()
}

function handleResumeAgentChat(id: string) {
  agent.disconnect()
  agent.loadConversation(id)
}

function handleDeleteAgentChat(id: string) {
  agent.deleteConversation(id)
}

async function handleClearAllAgentChats() {
  await agent.clearAllConversations()
}

function formatAgentTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    project.value = await fetchProject(projectId)
    if (!project.value) error.value = 'Project not found'
  } catch (e: any) {
    error.value = e.message || 'Failed to load project'
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  syncing.value = true
  error.value = ''
  success.value = ''
  try {
    await syncProject(projectId)
    success.value = 'Sync started — refreshing in a few seconds...'
    setTimeout(async () => {
      await load()
      syncing.value = false
      success.value = ''
    }, 3000)
  } catch (e: any) {
    error.value = e.message || 'Sync failed'
    syncing.value = false
  }
}

async function handleCheckStatus() {
  checking.value = true
  error.value = ''
  success.value = ''
  try {
    await checkStatus(projectId)
    success.value = 'Status check started — refreshing...'
    setTimeout(async () => {
      await load()
      checking.value = false
      success.value = ''
    }, 5000)
  } catch (e: any) {
    error.value = e.message || 'Status check failed'
    checking.value = false
  }
}

async function handleApply(patternId: string) {
  applying.value = true
  error.value = ''
  success.value = ''
  try {
    const params: Record<string, unknown> = {}

    if (patternId === 'service.domain-subgraph') {
      if (!applyForm.name.trim()) {
        error.value = 'Service name is required'
        applying.value = false
        return
      }
      params.service_name = applyForm.name.trim()
      if (applyForm.port) params.port = Number(applyForm.port)
      if (applyForm.entity) params.entity_name = applyForm.entity.trim()
      if (applyForm.fields) params.entity_fields = applyForm.fields.trim()
    }

    await applyPattern(projectId, patternId, params)
    success.value = `Applying "${patternId}" — changes will be committed to a new branch with a PR...`
    applyingPatternId.value = null
    applyForm.name = ''
    applyForm.port = ''
    applyForm.entity = ''
    applyForm.fields = ''

    setTimeout(async () => {
      await load()
      applying.value = false
      success.value = ''
    }, 8000)
  } catch (e: any) {
    error.value = e.message || 'Apply failed'
    applying.value = false
  }
}

function openReportModal(report: string, createdAt: string) {
  reportModalContent.value = report
  reportModalDate.value = createdAt
  showReportModal.value = true
}

function openActivityReport(activity: any) {
  if (activity.diagnosticsReport) {
    openReportModal(activity.diagnosticsReport.report, activity.diagnosticsReport.createdAt)
  }
}

const diagWaitingForReport = ref(false)

async function handleRunDiagnostics() {
  diagRunning.value = true
  diagWaitingForReport.value = true
  error.value = ''
  success.value = ''
  try {
    await runDiagnostics(projectId)
    success.value = 'Diagnostics started — Claude is analyzing the project...'
    setTimeout(async () => {
      await load()
      diagRunning.value = false
      success.value = ''
    }, 15000)
  } catch (e: any) {
    error.value = e.message || 'Diagnostics failed'
    diagRunning.value = false
    diagWaitingForReport.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  try {
    await deleteProject(projectId)
    await navigateTo('/projects')
  } catch (e: any) {
    error.value = e.message || 'Delete failed'
    deleting.value = false
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => {
  load()
  fetchCatalog()
  // Scope agent to this project and load its conversation history
  agent.setProject(projectId)
  agent.fetchConversations(projectId)
  unsubActivity = subscribeToActivity(projectId, (event) => {
    activityEvents.value.unshift(event)
    // Auto-refresh project data on terminal statuses
    if (event.status === 'COMPLETED' || event.status === 'FAILED') {
      setTimeout(async () => {
        await load()
        // Auto-show report modal when diagnostics finishes
        if (event.type === 'diagnostics' && event.status === 'COMPLETED' && diagWaitingForReport.value) {
          diagWaitingForReport.value = false
          if (project.value?.diagnosticsReport) {
            openReportModal(project.value.diagnosticsReport.report, project.value.diagnosticsReport.createdAt)
          }
        }
      }, 1500)
    }
  })
})

onUnmounted(() => {
  if (unsubActivity) unsubActivity()
  agent.disconnect()
  agent.setProject(null)
})
</script>

<template>
  <div class="max-w-4xl">
    <NuxtLink to="/projects" class="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
      &larr; All projects
    </NuxtLink>

    <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>
    <div v-if="success" class="mb-4 p-3 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ success }}</div>

    <template v-if="project && !loading">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-semibold text-gray-100">{{ project.name }}</h1>
            <span class="text-xs px-2 py-0.5 rounded" :class="statusColor(project.status)">
              {{ project.status }}
            </span>
          </div>
          <p class="text-sm text-gray-500 mt-1">{{ project.repoUrl }}</p>
          <p class="text-xs text-gray-600 mt-0.5">Branch: {{ project.branch }} | Last synced: {{ formatDate(project.lastSyncedAt) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="checking"
            class="px-3 py-1.5 rounded bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
            @click="handleCheckStatus"
          >
            {{ checking ? 'Checking...' : 'Check status' }}
          </button>
          <button
            :disabled="syncing"
            class="px-3 py-1.5 rounded bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
            @click="handleSync"
          >
            {{ syncing ? 'Syncing...' : 'Re-sync' }}
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-gray-700 mb-6">
        <button
          v-for="tab in [
            { key: 'overview', label: 'Overview' },
            { key: 'patterns', label: 'Patterns' },
            { key: 'actions', label: 'Actions' },
            { key: 'context', label: 'Context' },
            { key: 'agent', label: 'Agent' },
          ]"
          :key="tab.key"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.key
            ? 'border-emerald-500 text-emerald-400'
            : 'border-transparent text-gray-500 hover:text-gray-300'"
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ==================== OVERVIEW TAB ==================== -->
      <div v-if="activeTab === 'overview'">
        <!-- Services -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Services ({{ project.services.length }})</h2>
          <div v-if="project.services.length === 0" class="text-sm text-gray-600">No services detected. Sync the project to parse its manifest.</div>
          <div v-else class="space-y-2">
            <div
              v-for="svc in project.services"
              :key="svc.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
            >
              <div>
                <p class="text-sm text-gray-200">{{ svc.name }}</p>
                <p class="text-xs text-gray-500">{{ svc.type }} &middot; port {{ svc.port }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Applied Patterns (summary) -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Applied Patterns ({{ project.patterns.length }})</h2>
          <div v-if="project.patterns.length === 0" class="text-sm text-gray-600">
            No patterns applied.
            <button class="text-emerald-400 hover:text-emerald-300 ml-1" @click="activeTab = 'patterns'">Browse catalog</button>
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="pat in project.patterns"
              :key="pat.id"
              class="text-xs px-2 py-1 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
            >
              {{ pat.patternId }} <span class="text-emerald-600">v{{ pat.version }}</span>
            </span>
          </div>
        </div>

        <!-- Commits -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Recent Commits</h2>
          <div v-if="!project.commits || project.commits.length === 0" class="text-sm text-gray-600">No commits found. Sync the project first.</div>
          <div v-else class="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700">
            <div
              v-for="commit in project.commits"
              :key="commit.sha"
              class="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <code class="text-xs text-emerald-400 font-mono shrink-0">{{ commit.sha.slice(0, 7) }}</code>
              <span class="text-gray-300 truncate flex-1">{{ commit.message }}</span>
              <a
                v-if="commit.url"
                :href="commit.url"
                target="_blank"
                rel="noopener"
                class="text-xs text-gray-500 hover:text-gray-300 shrink-0 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Status Report -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-medium text-gray-400">Status Report</h2>
            <button
              v-if="!project.statusReport"
              :disabled="checking"
              class="text-xs px-2.5 py-1 rounded bg-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-600 transition-colors"
              @click="handleCheckStatus"
            >
              Run check
            </button>
          </div>
          <div v-if="!project.statusReport" class="text-sm text-gray-600">No status report yet. Click "Check status" to run one.</div>
          <div v-else class="p-4 rounded-lg bg-gray-800 border border-gray-700">
            <div class="grid grid-cols-3 gap-4 mb-3">
              <div>
                <p class="text-xs text-gray-500">Services OK</p>
                <p class="text-lg font-semibold text-emerald-400">{{ project.statusReport.servicesOk }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Missing</p>
                <p class="text-lg font-semibold" :class="project.statusReport.servicesMissing > 0 ? 'text-red-400' : 'text-gray-400'">
                  {{ project.statusReport.servicesMissing }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Outdated Patterns</p>
                <p class="text-lg font-semibold" :class="project.statusReport.outdatedPatterns > 0 ? 'text-yellow-400' : 'text-gray-400'">
                  {{ project.statusReport.outdatedPatterns }}
                </p>
              </div>
            </div>
            <div v-if="project.statusReport.issues.length > 0">
              <p class="text-xs text-gray-500 mb-1">Issues</p>
              <ul class="space-y-1">
                <li v-for="(issue, i) in project.statusReport.issues" :key="i" class="text-xs text-yellow-300">
                  {{ issue }}
                </li>
              </ul>
            </div>
            <p class="text-xs text-gray-600 mt-2">Checked: {{ formatDate(project.statusReport.checkedAt) }}</p>
          </div>
        </div>

        <!-- Manifest -->
        <div v-if="project.manifestRaw" class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Manifest</h2>
          <pre class="p-4 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">{{ project.manifestRaw }}</pre>
        </div>

        <!-- Danger zone -->
        <div class="pt-6 border-t border-gray-700">
          <h2 class="text-sm font-medium text-red-400 mb-3">Danger zone</h2>
          <div v-if="!confirmDelete">
            <button
              class="px-3 py-1.5 rounded border border-red-700 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
              @click="confirmDelete = true"
            >
              Delete project
            </button>
          </div>
          <div v-else class="flex items-center gap-3">
            <span class="text-sm text-gray-400">Are you sure?</span>
            <button
              :disabled="deleting"
              class="px-3 py-1.5 rounded bg-red-700 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              @click="handleDelete"
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
      </div>

      <!-- ==================== PATTERNS TAB ==================== -->
      <div v-if="activeTab === 'patterns'">
        <div class="rounded-lg border border-gray-700 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-800/80">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Pattern</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase w-24">Version</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase w-32">Status</th>
                <th class="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase w-28"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <template v-for="row in patternRows" :key="row.id">
                <!-- Main row -->
                <tr
                  class="hover:bg-gray-800/50 transition-colors cursor-pointer"
                  @click="expandedPatternId = expandedPatternId === row.id ? null : row.id"
                >
                  <td class="px-4 py-3">
                    <p class="text-gray-200">{{ row.name }}</p>
                    <p class="text-xs text-gray-500">{{ row.id }}</p>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-400">v{{ row.version }}</td>
                  <td class="px-4 py-3">
                    <span v-if="row.applied" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                      Applied
                      <span class="text-emerald-600">{{ formatDate(row.appliedAt) }}</span>
                    </span>
                    <span v-else class="text-xs text-gray-600">Not applied</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      v-if="!row.applied"
                      class="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                      @click.stop="applyingPatternId = applyingPatternId === row.id ? null : row.id; expandedPatternId = null"
                    >
                      Apply
                    </button>
                    <svg
                      v-else
                      class="w-4 h-4 text-gray-600 inline-block transition-transform"
                      :class="{ 'rotate-180': expandedPatternId === row.id }"
                      fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </td>
                </tr>

                <!-- Expanded detail row -->
                <tr v-if="expandedPatternId === row.id">
                  <td colspan="4" class="px-4 py-4 bg-gray-800/40">
                    <p class="text-sm text-gray-300 mb-3 whitespace-pre-line">{{ row.description }}</p>
                    <div class="flex flex-wrap gap-4">
                      <div v-if="row.provides.length > 0">
                        <p class="text-xs font-medium text-gray-500 uppercase mb-1.5">Provides</p>
                        <div class="flex flex-wrap gap-1.5">
                          <span
                            v-for="cap in row.provides"
                            :key="cap"
                            class="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
                          >
                            {{ cap }}
                          </span>
                        </div>
                      </div>
                      <div v-if="row.preconditions.length > 0">
                        <p class="text-xs font-medium text-gray-500 uppercase mb-1.5">Requires</p>
                        <div class="flex flex-wrap gap-1.5">
                          <span
                            v-for="pre in row.preconditions"
                            :key="pre"
                            class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/50"
                          >
                            {{ pre }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- Inline apply form row -->
                <tr v-if="applyingPatternId === row.id">
                  <td colspan="4" class="px-4 py-4 bg-gray-800/60 border-t border-gray-700">
                    <form @submit.prevent="handleApply(row.id)" class="space-y-3">
                      <p class="text-xs text-gray-500">Apply <span class="text-gray-300">{{ row.name }}</span> — this will generate code, commit, and push to a new branch.</p>

                      <!-- service.domain-subgraph params -->
                      <template v-if="row.id === 'service.domain-subgraph'">
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-xs text-gray-400 mb-1">Service name</label>
                            <input
                              v-model="applyForm.name"
                              type="text"
                              placeholder="billing"
                              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label class="block text-xs text-gray-400 mb-1">Port</label>
                            <input
                              v-model="applyForm.port"
                              type="text"
                              placeholder="4005"
                              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-xs text-gray-400 mb-1">Entity name <span class="text-gray-600">optional</span></label>
                            <input
                              v-model="applyForm.entity"
                              type="text"
                              placeholder="Invoice"
                              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label class="block text-xs text-gray-400 mb-1">Fields <span class="text-gray-600">optional</span></label>
                            <input
                              v-model="applyForm.fields"
                              type="text"
                              placeholder="amount:number,status:string"
                              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </template>

                      <!-- Generic parameters hint for other patterns -->
                      <div v-else-if="Object.keys(row.parameters).length > 0" class="text-xs text-gray-500">
                        <span class="text-gray-400">Parameters:</span>
                        {{ Object.keys(row.parameters).join(', ') }}
                      </div>

                      <div class="flex items-center gap-3">
                        <button
                          type="submit"
                          :disabled="applying || (row.id === 'service.domain-subgraph' && !applyForm.name.trim())"
                          class="px-4 py-1.5 rounded bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                        >
                          {{ applying ? 'Applying...' : 'Apply & push' }}
                        </button>
                        <button
                          type="button"
                          class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                          @click="applyingPatternId = null"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="catalogError && !catalogLoading" class="rounded-lg bg-red-900/20 border border-red-800/40 p-4 mt-4">
          <p class="text-sm text-red-300">Failed to load catalog: {{ catalogError }}</p>
          <button class="mt-2 text-sm text-emerald-400 hover:text-emerald-300" @click="fetchCatalog">Retry</button>
        </div>
        <div v-else-if="patternRows.length === 0 && !catalogLoading" class="text-sm text-gray-500 mt-4">
          No catalog patterns loaded. <button class="text-emerald-400 hover:text-emerald-300" @click="fetchCatalog">Retry</button>
        </div>
      </div>

      <!-- ==================== ACTIONS TAB ==================== -->
      <div v-if="activeTab === 'actions'">
        <!-- Diagnostics -->
        <div class="mb-8">
          <div class="p-5 rounded-lg bg-gray-800 border border-gray-700">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-sm font-medium text-gray-100 mb-1">Diagnostics</h3>
                <p class="text-xs text-gray-500">
                  Run Claude on the project to analyze its structure, dependencies, code quality, and produce actionable recommendations.
                </p>
              </div>
              <button
                :disabled="diagRunning"
                class="px-4 py-2 rounded-lg bg-violet-600 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors shrink-0 ml-4"
                @click="handleRunDiagnostics"
              >
                {{ diagRunning ? 'Running...' : 'Run diagnostics' }}
              </button>
            </div>

            <!-- Diagnostics report -->
            <div v-if="project.diagnosticsReport" class="mt-4 pt-4 border-t border-gray-700">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500">Last run: {{ formatDate(project.diagnosticsReport.createdAt) }}</p>
                <button
                  class="text-xs px-3 py-1.5 rounded bg-violet-600/20 text-violet-400 border border-violet-700/50 hover:bg-violet-600/30 transition-colors"
                  @click="openReportModal(project.diagnosticsReport.report, project.diagnosticsReport.createdAt)"
                >
                  View report
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Feed (real-time) -->
        <div class="mb-8">
          <h2 class="text-sm font-medium text-gray-400 mb-3">Activity Feed</h2>

          <!-- Live events from subscription -->
          <div v-if="activityEvents.length > 0" class="mb-4">
            <p class="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </p>
            <div class="rounded-lg bg-gray-800 border border-gray-700 divide-y divide-gray-700 max-h-64 overflow-y-auto">
              <div
                v-for="(ev, i) in activityEvents"
                :key="i"
                class="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <span
                  class="mt-0.5 shrink-0 w-2 h-2 rounded-full"
                  :class="{
                    'bg-blue-400': ev.status === 'RUNNING',
                    'bg-emerald-400': ev.status === 'COMPLETED',
                    'bg-red-400': ev.status === 'FAILED',
                    'bg-gray-500': !['RUNNING', 'COMPLETED', 'FAILED'].includes(ev.status),
                  }"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-gray-300 font-medium text-xs">{{ ev.taskName || ev.type }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded"
                      :class="{
                        'bg-blue-900/40 text-blue-400': ev.status === 'RUNNING',
                        'bg-emerald-900/40 text-emerald-400': ev.status === 'COMPLETED',
                        'bg-red-900/40 text-red-400': ev.status === 'FAILED',
                        'bg-gray-800 text-gray-400': !['RUNNING', 'COMPLETED', 'FAILED'].includes(ev.status),
                      }"
                    >
                      {{ ev.status }}
                    </span>
                  </div>
                  <p v-if="ev.message" class="text-xs text-gray-500 mt-0.5 truncate">{{ ev.message }}</p>
                </div>
                <span class="text-xs text-gray-600 shrink-0">{{ new Date(ev.timestamp).toLocaleTimeString() }}</span>
              </div>
            </div>
          </div>

          <!-- Historical activities from project data -->
          <div v-if="project.activities && project.activities.length > 0">
            <p class="text-xs text-gray-500 mb-2">History</p>
            <div class="space-y-2">
              <div
                v-for="activity in project.activities"
                :key="activity.id"
                class="p-3 rounded-lg bg-gray-800 border border-gray-700"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-200">{{ activity.type }}</span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded"
                      :class="{
                        'bg-blue-900/40 text-blue-400': activity.status === 'RUNNING',
                        'bg-emerald-900/40 text-emerald-400': activity.status === 'COMPLETED',
                        'bg-red-900/40 text-red-400': activity.status === 'FAILED',
                        'bg-gray-800 text-gray-400': !['RUNNING', 'COMPLETED', 'FAILED'].includes(activity.status),
                      }"
                    >
                      {{ activity.status }}
                    </span>
                    <button
                      v-if="activity.type === 'diagnostics' && activity.status === 'COMPLETED' && activity.diagnosticsReport"
                      class="text-xs px-2 py-0.5 rounded bg-violet-600/20 text-violet-400 border border-violet-700/50 hover:bg-violet-600/30 transition-colors"
                      @click="openActivityReport(activity)"
                    >
                      View report
                    </button>
                  </div>
                  <span class="text-xs text-gray-600">{{ formatDate(activity.startedAt) }}</span>
                </div>
                <div v-if="activity.entries.length > 0" class="space-y-1">
                  <div
                    v-for="entry in activity.entries"
                    :key="entry.id"
                    class="flex items-center gap-2 text-xs"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="{
                        'bg-blue-400': entry.status === 'RUNNING',
                        'bg-emerald-400': entry.status === 'COMPLETED',
                        'bg-red-400': entry.status === 'FAILED',
                        'bg-gray-500': !['RUNNING', 'COMPLETED', 'FAILED'].includes(entry.status),
                      }"
                    />
                    <span class="text-gray-400">{{ entry.taskName }}</span>
                    <span class="text-gray-600 truncate">{{ entry.message }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activityEvents.length === 0 && (!project.activities || project.activities.length === 0)" class="text-sm text-gray-600">
            No activity yet. Trigger an action to see live updates here.
          </div>
        </div>
      </div>

      <!-- ==================== CONTEXT TAB ==================== -->
      <div v-if="activeTab === 'context'" class="space-y-6">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-sm font-medium text-gray-300">Project Context Notes</h2>
              <p class="text-xs text-gray-500 mt-1">
                Context that the agent loads when chatting about this project.
                Include domain knowledge, conventions, key decisions, and anything that helps the agent understand this project.
              </p>
            </div>
            <button
              v-if="!contextEditing"
              class="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              @click="startEditContext"
            >
              Edit
            </button>
          </div>

          <div v-if="contextEditing" class="space-y-3">
            <textarea
              v-model="contextNotesEdit"
              rows="16"
              placeholder="Enter project context notes...

Examples:
- This project uses a monorepo with pnpm workspaces
- Authentication is handled via Keycloak OIDC
- The API follows GraphQL federation patterns
- Key domain terms: Ship = project, Catalog = pattern library
- Never modify files under packages/domain/
- Database migrations use Flyway naming (V0.0.X__description.sql)"
              class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-y outline-none focus:border-emerald-500/50 transition-colors"
              style="background: #111827; color: #f3f4f6"
            />
            <div class="flex items-center gap-2">
              <button
                :disabled="contextSaving"
                class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                @click="saveContextNotes"
              >
                {{ contextSaving ? 'Saving...' : 'Save' }}
              </button>
              <button
                :disabled="contextSaving"
                class="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                @click="contextEditing = false"
              >
                Cancel
              </button>
            </div>
          </div>

          <div v-else>
            <div v-if="project.contextNotes" class="bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3">
              <div class="prose-chat text-sm text-gray-300" v-html="renderMarkdown(project.contextNotes)" />
            </div>
            <div v-else class="bg-gray-900/50 border border-gray-700/50 rounded-lg px-4 py-6 text-center">
              <p class="text-sm text-gray-500">No context notes yet.</p>
              <button
                class="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                @click="startEditContext"
              >
                Add context notes
              </button>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-700 pt-4">
          <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">How context is used</h3>
          <ul class="text-xs text-gray-500 space-y-1.5">
            <li>Context notes are automatically prepended when the agent starts a new conversation about this project.</li>
            <li>Use this to capture domain knowledge, architecture decisions, and conventions specific to this project.</li>
            <li>The agent also has access to the project's manifest, repo URL, branch, and local clone path.</li>
          </ul>
        </div>
      </div>

      <!-- ==================== AGENT TAB ==================== -->
      <ClientOnly>
        <div v-if="activeTab === 'agent'" class="flex rounded-lg border border-gray-700 overflow-hidden" style="height: calc(100vh - 14rem)">
          <!-- Conversation history sidebar -->
          <div class="w-52 border-r border-gray-700 flex flex-col shrink-0 bg-gray-900/50">
            <div class="px-3 py-2.5 border-b border-gray-700 flex items-center justify-between">
              <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">History</span>
              <div class="flex items-center gap-1">
                <button
                  v-if="projectConversations.length > 0"
                  class="text-xs px-2 py-0.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
                  title="Clear all conversations"
                  @click="handleClearAllAgentChats"
                >
                  Clear
                </button>
                <button
                  class="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                  @click="handleNewAgentChat"
                >
                  + New
                </button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="projectConversations.length === 0" class="px-3 py-4 text-xs text-gray-600">
                No conversations yet
              </div>
              <button
                v-for="convo in projectConversations"
                :key="convo.id"
                class="w-full text-left px-3 py-2 border-b border-gray-800/50 transition-colors group"
                :class="convo.id === agent.activeId.value ? 'bg-gray-800/70 text-gray-100' : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'"
                @click="handleResumeAgentChat(convo.id)"
              >
                <div class="flex items-start justify-between gap-1">
                  <p class="text-xs truncate flex-1">{{ convo.title }}</p>
                  <button
                    class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs"
                    title="Delete"
                    @click.stop="handleDeleteAgentChat(convo.id)"
                  >
                    &times;
                  </button>
                </div>
                <p class="text-[10px] text-gray-600 mt-0.5">{{ formatAgentTime(convo.updatedAt) }}</p>
              </button>
            </div>
          </div>

          <!-- Chat area -->
          <div class="flex-1 flex flex-col min-w-0">
            <!-- Messages -->
            <div
              ref="agentChatContainer"
              class="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              <div v-if="agent.messages.value.length === 0" class="flex flex-col items-center justify-center h-full text-center">
                <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                  <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                </div>
                <p class="text-sm text-gray-400 mb-1">Ask anything about <span class="text-gray-200">{{ project.name }}</span></p>
                <p class="text-xs text-gray-600">Claude has context about the repo, branch, and local clone.</p>
                <p class="text-xs text-gray-600 mt-1">Previous conversations are saved in the sidebar.</p>
              </div>

              <div
                v-for="msg in agent.messages.value"
                :key="msg.id"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div v-if="msg.role !== 'user'" class="flex items-start gap-3 max-w-[80%]">
                  <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                    </svg>
                  </div>
                  <div
                    class="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
                    :class="[
                      msg.role === 'system' ? 'bg-amber-500/10 text-amber-300' : 'bg-gray-800 text-gray-100',
                      msg.text === '...' && msg.id.startsWith('thinking-') ? 'animate-pulse' : '',
                      msg.role === 'assistant' ? 'prose-chat' : '',
                    ]"
                  >
                    <div v-if="msg.role === 'assistant'" v-html="renderMarkdown(msg.text)" />
                    <template v-else>{{ msg.text }}</template>
                  </div>
                </div>

                <div v-else class="max-w-[80%]">
                  <div class="rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">{{ stripContextPrefix(msg.text) }}</div>
                </div>
              </div>
            </div>

            <!-- Input -->
            <div class="border-t border-gray-700 px-4 py-3">
              <div class="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 flex items-end gap-2">
                <textarea
                  ref="agentTextarea"
                  v-model="agentInput"
                  :placeholder="agent.processing.value ? 'Waiting for response...' : 'Ask about this project...'"
                  :disabled="agent.processing.value"
                  rows="1"
                  class="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none outline-none text-sm leading-6 border-none max-h-36 overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  style="background: transparent; color: #f3f4f6"
                  @keydown="handleAgentKeydown"
                />
                <button
                  class="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  :disabled="!agentInput.trim() || agent.processing.value"
                  @click="handleAgentSend"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    </template>

    <!-- Diagnostics Report Modal -->
    <Teleport to="body">
      <div
        v-if="showReportModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="showReportModal = false"
      >
        <div class="fixed inset-0 bg-black/60" @click="showReportModal = false" />
        <div class="relative z-10 w-full max-w-3xl max-h-[85vh] mx-4 flex flex-col rounded-xl bg-gray-900 border border-gray-700 shadow-2xl">
          <!-- Modal header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
            <div>
              <h2 class="text-base font-semibold text-gray-100">Diagnostics Report</h2>
              <p class="text-xs text-gray-500 mt-0.5">{{ formatDate(reportModalDate) }}</p>
            </div>
            <button
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              @click="showReportModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Modal body -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="prose-report text-sm text-gray-300" v-html="renderMarkdown(reportModalContent)" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.prose-chat :deep(p) { margin: 0.25em 0; }
.prose-chat :deep(p:first-child) { margin-top: 0; }
.prose-chat :deep(p:last-child) { margin-bottom: 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { margin: 0.4em 0; padding-left: 1.4em; }
.prose-chat :deep(ul) { list-style-type: disc; }
.prose-chat :deep(ol) { list-style-type: decimal; }
.prose-chat :deep(li) { margin: 0.15em 0; }
.prose-chat :deep(strong) { font-weight: 600; }
.prose-chat :deep(em) { font-style: italic; }
.prose-chat :deep(code) { background: rgba(255,255,255,0.1); padding: 0.15em 0.35em; border-radius: 0.25em; font-size: 0.875em; }
.prose-chat :deep(pre) { background: rgba(0,0,0,0.3); padding: 0.75em 1em; border-radius: 0.5em; overflow-x: auto; margin: 0.5em 0; }
.prose-chat :deep(pre code) { background: none; padding: 0; }
.prose-chat :deep(blockquote) { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 0.75em; margin: 0.4em 0; opacity: 0.85; }
.prose-chat :deep(h1), .prose-chat :deep(h2), .prose-chat :deep(h3) { font-weight: 600; margin: 0.5em 0 0.25em; }
.prose-chat :deep(h1) { font-size: 1.2em; }
.prose-chat :deep(h2) { font-size: 1.1em; }
.prose-chat :deep(h3) { font-size: 1.05em; }
.prose-chat :deep(a) { color: #6ee7b7; text-decoration: underline; }
.prose-chat :deep(hr) { border-color: rgba(255,255,255,0.1); margin: 0.5em 0; }

/* Diagnostics report modal styles */
.prose-report :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.prose-report :deep(h1) { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; color: #f3f4f6; }
.prose-report :deep(h2) { font-size: 1.1em; font-weight: 600; margin: 1em 0 0.4em; color: #e5e7eb; }
.prose-report :deep(h3) { font-size: 1em; font-weight: 600; margin: 0.75em 0 0.3em; color: #d1d5db; }
.prose-report :deep(ul), .prose-report :deep(ol) { margin: 0.5em 0; padding-left: 1.5em; }
.prose-report :deep(ul) { list-style-type: disc; }
.prose-report :deep(ol) { list-style-type: decimal; }
.prose-report :deep(li) { margin: 0.25em 0; }
.prose-report :deep(strong) { font-weight: 600; color: #e5e7eb; }
.prose-report :deep(em) { font-style: italic; }
.prose-report :deep(code) { background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 0.25em; font-size: 0.875em; }
.prose-report :deep(pre) { background: rgba(0,0,0,0.4); padding: 0.75em 1em; border-radius: 0.5em; overflow-x: auto; margin: 0.5em 0; }
.prose-report :deep(pre code) { background: none; padding: 0; }
.prose-report :deep(blockquote) { border-left: 3px solid rgba(139,92,246,0.4); padding-left: 0.75em; margin: 0.5em 0; color: #9ca3af; }
.prose-report :deep(hr) { border-color: rgba(255,255,255,0.1); margin: 1em 0; }
.prose-report :deep(a) { color: #a78bfa; text-decoration: underline; }
.prose-report :deep(table) { width: 100%; border-collapse: collapse; margin: 0.5em 0; }
.prose-report :deep(th), .prose-report :deep(td) { border: 1px solid rgba(255,255,255,0.1); padding: 0.4em 0.6em; text-align: left; }
.prose-report :deep(th) { background: rgba(255,255,255,0.05); font-weight: 600; }
</style>
