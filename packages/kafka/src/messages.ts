/**
 * Typed message envelopes for Kafka topics.
 *
 * Every message has a `type` discriminator so consumers can switch on it.
 * All payloads are JSON-serialized strings on the wire.
 */

// ── Agent Chat Commands (agents → orchestration) ───────────────

export interface ChatStartCommand {
  type: 'chat.start'
  conversationId: string
  projectId: string | null
  text: string
  timestamp: string
}

export type AgentChatCommand = ChatStartCommand

// ── Agent Chat Events (workers/orchestration → agents) ─────────

export interface ChatStreamChunkEvent {
  type: 'chat.stream.chunk'
  conversationId: string
  text: string
  /** true when this is the final chunk */
  done: boolean
  timestamp: string
}

export interface ChatResponseCompleteEvent {
  type: 'chat.response.complete'
  conversationId: string
  workflowId: string
  response: string
  timestamp: string
}

export interface ChatErrorEvent {
  type: 'chat.error'
  conversationId: string
  workflowId: string
  error: string
  timestamp: string
}

export interface ChatWorkflowStartedEvent {
  type: 'chat.workflow.started'
  conversationId: string
  workflowId: string
  timestamp: string
}

export type AgentChatEvent =
  | ChatStreamChunkEvent
  | ChatResponseCompleteEvent
  | ChatErrorEvent
  | ChatWorkflowStartedEvent

// ── Workflow Lifecycle Events ──────────────────────────────────

export interface WorkflowLifecycleEvent {
  type: 'workflow.started' | 'workflow.completed' | 'workflow.failed'
  workflowId: string
  workflowName: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  timestamp: string
}

// ── Helpers ────────────────────────────────────────────────────

/** Serialize a message to a Kafka value buffer. */
export function encode(msg: AgentChatCommand | AgentChatEvent | WorkflowLifecycleEvent): Buffer {
  return Buffer.from(JSON.stringify(msg))
}

/** Deserialize a Kafka value buffer to a typed message. */
export function decode<T = AgentChatCommand | AgentChatEvent | WorkflowLifecycleEvent>(buf: Buffer | null): T | null {
  if (!buf) return null
  try {
    return JSON.parse(buf.toString()) as T
  } catch {
    return null
  }
}
