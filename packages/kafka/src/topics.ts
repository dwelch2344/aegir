/**
 * Centralized topic registry for all Kafka-based messaging in aegir.
 *
 * Naming convention: <domain>.<entity>.<event-type>
 *   - CDC raw topics use: conductor.cdc.public.<table>
 *   - Normalized topics use: conductor.<entity>.events
 *   - Command/event topics use: <domain>.<entity>.commands / .events
 */
export const TOPICS = {
  // ── Agent Chat ────────────────────────────────────────────────
  /** Commands from agents service → orchestration (start chat, send message, close) */
  AGENT_CHAT_COMMANDS: 'agents.chat.commands',
  /** Events from workers → agents service (stream chunks, completion, errors) */
  AGENT_CHAT_EVENTS: 'agents.chat.events',

  // ── Workflow lifecycle ────────────────────────────────────────
  /** High-level workflow status changes for any consumer (started, completed, failed) */
  WORKFLOW_LIFECYCLE: 'orchestration.workflow.lifecycle',

  // ── CDC (already consumed by conductor-cdc) ───────────────────
  RAW_WORKFLOW: 'conductor.cdc.public.workflow',
  RAW_TASK: 'conductor.cdc.public.task',
  WORKFLOW_EVENTS: 'conductor.workflow.events',
  TASK_EVENTS: 'conductor.task.events',
} as const

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS]

/** Topics that should be auto-created on startup if they don't exist. */
export const MANAGED_TOPICS: TopicName[] = [
  TOPICS.AGENT_CHAT_COMMANDS,
  TOPICS.AGENT_CHAT_EVENTS,
  TOPICS.WORKFLOW_LIFECYCLE,
]
