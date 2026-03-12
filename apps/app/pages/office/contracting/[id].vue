<script setup lang="ts">
const route = useRoute();
const { getWorkflowStatus, approveStep } = useContracting();

const workflowId = route.params.id as string;
const workflow = ref<any>(null);
const error = ref("");
const polling = ref(true);
const expandedTask = ref<number | null>(null);
const approving = ref(false);
const noteSavedTask = ref<string | null>(null);
let noteSavedTimer: ReturnType<typeof setTimeout> | undefined;
let noteDebounceTimer: ReturnType<typeof setTimeout> | undefined;

// --- Notes (localStorage-backed, per workflow+task) ---
const NOTES_KEY = `aegir:contracting:notes:${workflowId}`;

function loadNotes(): Record<string, string> {
  if (import.meta.server) return {};
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
  } catch {
    return {};
  }
}

const notes = ref<Record<string, string>>(loadNotes());

function onNoteInput(taskName: string, text: string) {
  notes.value[taskName] = text;
  if (noteDebounceTimer) clearTimeout(noteDebounceTimer);
  noteDebounceTimer = setTimeout(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes.value));
    noteSavedTask.value = taskName;
    if (noteSavedTimer) clearTimeout(noteSavedTimer);
    noteSavedTimer = setTimeout(() => {
      noteSavedTask.value = null;
    }, 1500);
  }, 500);
}

const taskLabels: Record<string, string> = {
  sh_validate_agent_info: "Validate Agent Eligibility",
  sh_create_sircon_affiliation: "Create Sircon Affiliation",
  sh_request_contract: "Request Contract from Select Health",
  sh_agent_signs_docusign: "Agent Signs DocuSign",
  sh_await_agent_signature: "Awaiting Agent Signature",
  sh_hf_countersign_and_training: "HF Countersign & Training",
  sh_carrier_processing: "Carrier Processing",
  sh_finalize_contract: "Finalize Contract",
};

const statusColors: Record<string, string> = {
  COMPLETED: "text-emerald-400",
  IN_PROGRESS: "text-amber-400",
  SCHEDULED: "text-gray-500",
  FAILED: "text-red-400",
};

const statusBadgeColors: Record<string, string> = {
  COMPLETED: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
  RUNNING: "bg-amber-400/20 text-amber-400 border-amber-400/30",
  PAUSED: "bg-gray-400/20 text-gray-400 border-gray-400/30",
  FAILED: "bg-red-400/20 text-red-400 border-red-400/30",
  TIMED_OUT: "bg-red-400/20 text-red-400 border-red-400/30",
  TERMINATED: "bg-red-400/20 text-red-400 border-red-400/30",
};

function toggleTask(idx: number) {
  expandedTask.value = expandedTask.value === idx ? null : idx;
}

function parseOutputData(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function handleApprove(task: any) {
  if (!task.taskRefName) return;
  approving.value = true;
  try {
    await approveStep(workflowId, task.taskRefName);
    await poll();
  } catch (e: any) {
    error.value = e.message || "Failed to approve step";
  } finally {
    approving.value = false;
  }
}

async function poll() {
  try {
    workflow.value = await getWorkflowStatus(workflowId);
    if (workflow.value?.status !== "RUNNING") {
      polling.value = false;
    }
  } catch (e: any) {
    error.value = e.message || "Failed to fetch workflow status";
    polling.value = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  await poll();
  timer = setInterval(async () => {
    if (polling.value) await poll();
    else if (timer) clearInterval(timer);
  }, 2000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function formatTime(ts: string | number | null) {
  if (!ts) return "";
  const n = typeof ts === "string" ? Number(ts) : ts;
  const d = new Date(Number.isFinite(n) && n > 0 ? n : ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString();
}

function formatLogTime(ts: string | number) {
  const n = typeof ts === "string" ? Number(ts) : ts;
  const d = new Date(Number.isFinite(n) && n > 0 ? n : ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/office" class="text-gray-400 hover:text-gray-200 text-sm"
        >&larr; Back to Office</NuxtLink
      >
    </div>

    <div class="flex items-center gap-4 mb-1">
      <h1 class="text-2xl font-semibold text-gray-100">Contract Workflow</h1>
      <span
        v-if="workflow"
        class="px-2.5 py-0.5 rounded-full text-xs font-medium border"
        :class="
          statusBadgeColors[workflow.status] ||
          'bg-gray-700 text-gray-400 border-gray-600'
        "
      >
        {{ workflow.status }}
      </span>
    </div>
    <p class="text-sm text-gray-500 font-mono">{{ workflowId }}</p>

    <!-- Error -->
    <div
      v-if="error"
      class="mt-4 rounded-lg border border-red-700/50 bg-red-900/20 p-4"
    >
      <p class="text-sm text-red-400">{{ error }}</p>
    </div>

    <div v-if="workflow" class="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Task Timeline -->
      <div
        class="lg:col-span-2 rounded-lg border border-gray-700 bg-gray-900 p-5"
      >
        <h2
          class="text-sm font-medium text-gray-300 uppercase tracking-wide mb-4"
        >
          Task Progress
        </h2>

        <div class="space-y-1">
          <div
            v-for="(task, idx) in workflow.tasks"
            :key="idx"
            :class="
              idx < workflow.tasks.length - 1 ? 'border-b border-gray-800' : ''
            "
          >
            <!-- Task row (clickable) -->
            <button
              class="w-full flex items-center gap-3 py-3 px-2 text-left rounded transition-colors"
              :class="
                expandedTask === idx ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'
              "
              @click="toggleTask(idx)"
            >
              <!-- Status indicator -->
              <div class="shrink-0">
                <svg
                  v-if="task.status === 'COMPLETED'"
                  class="w-5 h-5 text-emerald-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg
                  v-else-if="
                    task.status === 'IN_PROGRESS' && task.type === 'WAIT'
                  "
                  class="w-5 h-5 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7.5a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5H8.5a.5.5 0 01-.5-.5v-5zm3 0a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5h-.5a.5.5 0 01-.5-.5v-5z"
                    clip-rule="evenodd"
                  />
                </svg>
                <svg
                  v-else-if="task.status === 'IN_PROGRESS'"
                  class="w-5 h-5 text-amber-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <svg
                  v-else-if="task.status === 'FAILED'"
                  class="w-5 h-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clip-rule="evenodd"
                  />
                </svg>
                <div
                  v-else
                  class="w-5 h-5 rounded-full border-2 border-gray-600"
                />
              </div>

              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium"
                  :class="
                    task.status === 'IN_PROGRESS' && task.type === 'WAIT'
                      ? 'text-blue-400'
                      : statusColors[task.status] || 'text-gray-500'
                  "
                >
                  {{ taskLabels[task.name] || task.name }}
                </p>
                <div class="flex items-center gap-2 mt-0.5">
                  <p v-if="task.startTime" class="text-xs text-gray-500">
                    {{ formatTime(task.startTime) }}
                    <template v-if="task.endTime">
                      &mdash; {{ formatTime(task.endTime) }}</template
                    >
                  </p>
                  <span
                    v-if="task.type === 'WAIT' && task.status === 'IN_PROGRESS'"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-400/20 text-blue-400 border border-blue-400/30"
                  >
                    WAITING
                  </span>
                  <span
                    v-if="notes[task.name]"
                    class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                    title="Has notes"
                  />
                </div>
              </div>
              <svg
                class="w-4 h-4 text-gray-600 transition-transform shrink-0"
                :class="{ 'rotate-180': expandedTask === idx }"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            <!-- Expanded detail panel -->
            <div v-if="expandedTask === idx" class="ml-8 mb-4 space-y-3">
              <!-- Approve button for WAIT tasks -->
              <div
                v-if="task.type === 'WAIT' && task.status === 'IN_PROGRESS'"
                class="p-3 rounded bg-blue-900/20 border border-blue-700/40"
              >
                <p class="text-xs text-blue-300 mb-2">
                  This step requires human approval to continue.
                </p>
                <button
                  :disabled="approving"
                  class="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  @click="handleApprove(task)"
                >
                  {{ approving ? "Approving..." : "Approve & Continue" }}
                </button>
              </div>

              <!-- Activity log -->
              <div
                v-if="task.logs?.length"
                class="pl-3 border-l-2 border-gray-700"
              >
                <p
                  class="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1"
                >
                  Activity Log
                </p>
                <div
                  v-for="(entry, lidx) in task.logs"
                  :key="lidx"
                  class="py-0.5"
                >
                  <p class="text-xs text-gray-400">
                    <span class="text-gray-500 font-mono mr-1">{{
                      formatLogTime(entry.createdTime)
                    }}</span>
                    {{ entry.log }}
                  </p>
                </div>
              </div>

              <!-- Output data -->
              <div
                v-if="parseOutputData(task.outputData)"
                class="rounded bg-gray-800/50 p-3"
              >
                <p
                  class="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-1.5"
                >
                  Output
                </p>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <template
                    v-for="(val, key) in parseOutputData(task.outputData)"
                    :key="key"
                  >
                    <dt class="text-gray-500 truncate">{{ key }}</dt>
                    <dd class="text-gray-300 truncate" :title="String(val)">
                      {{ Array.isArray(val) ? val.join(", ") : val }}
                    </dd>
                  </template>
                </dl>
              </div>

              <!-- Notes -->
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <p
                    class="text-[10px] text-gray-500 uppercase tracking-wide font-medium"
                  >
                    Notes
                  </p>
                  <span
                    v-if="noteSavedTask === task.name"
                    class="text-[10px] text-emerald-500 transition-opacity"
                  >
                    Saved
                  </span>
                </div>
                <textarea
                  :value="notes[task.name] || ''"
                  @input="
                    onNoteInput(
                      task.name,
                      ($event.target as HTMLTextAreaElement).value,
                    )
                  "
                  placeholder="Add a note for this step..."
                  rows="2"
                  class="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar Info -->
      <div class="space-y-4">
        <!-- Agent Info -->
        <div
          v-if="workflow.input"
          class="rounded-lg border border-gray-700 bg-gray-900 p-5"
        >
          <h2
            class="text-sm font-medium text-gray-300 uppercase tracking-wide mb-3"
          >
            Agent
          </h2>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-gray-500">Name</dt>
              <dd class="text-gray-200">
                {{ workflow.input.agentFirstName }}
                {{ workflow.input.agentLastName }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Email</dt>
              <dd class="text-gray-200">{{ workflow.input.agentEmail }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">NPN</dt>
              <dd class="text-gray-200">{{ workflow.input.agentNpn }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">States</dt>
              <dd class="text-gray-200">
                {{ (workflow.input.requestedStates || []).join(", ") }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Output -->
        <div
          v-if="workflow.output?.contractId"
          class="rounded-lg border border-gray-700 bg-gray-900 p-5"
        >
          <h2
            class="text-sm font-medium text-gray-300 uppercase tracking-wide mb-3"
          >
            Result
          </h2>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-gray-500">Contract ID</dt>
              <dd class="text-gray-200 font-mono text-xs">
                {{ workflow.output.contractId }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Status</dt>
              <dd class="text-emerald-400 font-medium">
                {{ workflow.output.status }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Writing Number</dt>
              <dd class="text-gray-200">{{ workflow.output.writingNumber }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Approved States</dt>
              <dd class="text-gray-200">
                {{ (workflow.output.approvedStates || []).join(", ") }}
              </dd>
            </div>
            <div v-if="workflow.output.completedAt">
              <dt class="text-gray-500">Completed</dt>
              <dd class="text-gray-200">
                {{ new Date(workflow.output.completedAt).toLocaleString() }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="!error" class="mt-6">
      <p class="text-gray-400 text-sm">Loading workflow status...</p>
    </div>
  </div>
</template>
