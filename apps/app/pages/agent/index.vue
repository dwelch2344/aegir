<script setup lang="ts">
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

const {
  conversations,
  activeId,
  messages,
  loading,
  fetchConversations,
  newConversation,
  loadConversation,
  deleteConversation,
  sendMessage,
  disconnect,
  clearConversation,
} = useAgent();

const input = ref("");
const chatContainer = ref<HTMLElement | null>(null);
const welcomeTextarea = ref<HTMLTextAreaElement | null>(null);
const chatTextarea = ref<HTMLTextAreaElement | null>(null);

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

watch(input, () => {
  nextTick(() => {
    autoResize(welcomeTextarea.value);
    autoResize(chatTextarea.value);
  });
});

const hasMessages = computed(() => messages.value.length > 0);

onMounted(() => {
  fetchConversations();
});

function handleSend() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  nextTick(() => {
    autoResize(welcomeTextarea.value);
    autoResize(chatTextarea.value);
  });
  sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleNew() {
  disconnect();
  newConversation();
}

function handleResume(id: string) {
  disconnect();
  loadConversation(id);
}

function handleDelete(id: string) {
  deleteConversation(id);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

watch(
  messages,
  () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
  },
  { deep: true },
);

onUnmounted(() => {
  disconnect();
});
</script>

<template>
  <ClientOnly>
    <div class="flex h-[calc(100vh-3rem)]">
      <!-- History sidebar -->
      <div class="w-56 border-r border-gray-800 flex flex-col shrink-0">
        <div
          class="px-3 py-3 border-b border-gray-800 flex items-center justify-between"
        >
          <span
            class="text-xs font-medium text-gray-400 uppercase tracking-wider"
            >History</span
          >
          <button
            class="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            @click="handleNew"
          >
            + New
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-if="conversations.length === 0"
            class="px-3 py-4 text-xs text-gray-600"
          >
            No conversations yet
          </div>
          <button
            v-for="convo in conversations"
            :key="convo.id"
            class="w-full text-left px-3 py-2.5 border-b border-gray-800/50 transition-colors group"
            :class="
              convo.id === activeId
                ? 'bg-gray-800/70 text-gray-100'
                : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
            "
            @click="handleResume(convo.id)"
          >
            <div class="flex items-start justify-between gap-1">
              <p class="text-sm truncate flex-1">{{ convo.title }}</p>
              <button
                class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs mt-0.5"
                title="Delete"
                @click.stop="handleDelete(convo.id)"
              >
                &times;
              </button>
            </div>
            <p class="text-xs text-gray-600 mt-0.5">
              {{ formatTime(convo.updatedAt) }}
            </p>
          </button>
        </div>
      </div>

      <!-- Main area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Welcome view (no active conversation or empty) -->
        <div
          v-if="!hasMessages"
          class="flex-1 flex flex-col items-center justify-center"
        >
          <div class="mb-8">
            <div
              class="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                />
              </svg>
            </div>
          </div>

          <h1 class="text-3xl font-semibold text-gray-100 mb-2">Hey there!</h1>
          <p class="text-gray-400 text-sm mb-10">Talk to the aegir agent</p>

          <div class="w-full max-w-2xl px-4">
            <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
              <textarea
                ref="welcomeTextarea"
                v-model="input"
                placeholder="How can I help you today?"
                rows="2"
                class="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none outline-none text-sm border-none max-h-48 overflow-y-auto"
                style="background: transparent; color: #f3f4f6"
                @keydown="handleKeydown"
              />
              <div class="flex items-center justify-end mt-2">
                <button
                  class="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="!input.trim()"
                  @click="handleSend"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat view -->
        <template v-else>
          <div
            ref="chatContainer"
            class="flex-1 overflow-y-auto px-4 py-6 space-y-4"
          >
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                v-if="msg.role !== 'user'"
                class="flex items-start gap-3 max-w-[75%]"
              >
                <div
                  class="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5"
                >
                  <svg
                    class="w-4 h-4 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                    />
                  </svg>
                </div>
                <div
                  class="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
                  :class="[
                    msg.role === 'system'
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'bg-gray-800 text-gray-100',
                    msg.text === '...' && msg.id.startsWith('thinking-')
                      ? 'animate-pulse'
                      : '',
                    msg.role === 'assistant' ? 'prose-chat' : '',
                  ]"
                >
                  <div
                    v-if="msg.role === 'assistant'"
                    v-html="renderMarkdown(msg.text)"
                  />
                  <template v-else>{{ msg.text }}</template>
                </div>
              </div>

              <div v-else class="max-w-[75%]">
                <div
                  class="rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap"
                >
                  {{ msg.text }}
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-800 px-4 py-3">
            <div class="max-w-3xl mx-auto flex items-end gap-3">
              <div
                class="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 flex items-end gap-2"
              >
                <textarea
                  ref="chatTextarea"
                  v-model="input"
                  placeholder="Reply..."
                  rows="1"
                  class="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none outline-none text-sm leading-6 border-none max-h-48 overflow-y-auto"
                  style="background: transparent; color: #f3f4f6"
                  @keydown="handleKeydown"
                />
                <button
                  class="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  :disabled="!input.trim()"
                  @click="handleSend"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"
                    />
                  </svg>
                </button>
              </div>
              <button
                class="text-xs px-3 py-2 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors shrink-0"
                @click="clearConversation"
              >
                Delete
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.prose-chat :deep(p) {
  margin: 0.25em 0;
}
.prose-chat :deep(p:first-child) {
  margin-top: 0;
}
.prose-chat :deep(p:last-child) {
  margin-bottom: 0;
}
.prose-chat :deep(ul),
.prose-chat :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.4em;
}
.prose-chat :deep(ul) {
  list-style-type: disc;
}
.prose-chat :deep(ol) {
  list-style-type: decimal;
}
.prose-chat :deep(li) {
  margin: 0.15em 0;
}
.prose-chat :deep(strong) {
  font-weight: 600;
}
.prose-chat :deep(em) {
  font-style: italic;
}
.prose-chat :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.15em 0.35em;
  border-radius: 0.25em;
  font-size: 0.875em;
}
.prose-chat :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75em 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 0.5em 0;
}
.prose-chat :deep(pre code) {
  background: none;
  padding: 0;
}
.prose-chat :deep(blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  padding-left: 0.75em;
  margin: 0.4em 0;
  opacity: 0.85;
}
.prose-chat :deep(h1),
.prose-chat :deep(h2),
.prose-chat :deep(h3) {
  font-weight: 600;
  margin: 0.5em 0 0.25em;
}
.prose-chat :deep(h1) {
  font-size: 1.2em;
}
.prose-chat :deep(h2) {
  font-size: 1.1em;
}
.prose-chat :deep(h3) {
  font-size: 1.05em;
}
.prose-chat :deep(a) {
  color: #6ee7b7;
  text-decoration: underline;
}
.prose-chat :deep(hr) {
  border-color: rgba(255, 255, 255, 0.1);
  margin: 0.5em 0;
}
</style>
