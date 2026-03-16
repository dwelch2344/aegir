/**
 * Kafka bridge for the agents service.
 *
 * Produces: agents.chat.commands  → sends chat start/message/close commands to orchestration
 * Consumes: agents.chat.events    → receives stream chunks, completions, errors from workers
 *                                   and bridges them to the Mercurius WebSocket pubsub
 */
import type { Producer, Consumer } from 'kafkajs'
import {
  createKafka,
  ensureTopics,
  createProducer,
  createConsumer,
  TOPICS,
  MANAGED_TOPICS,
  encode,
  decode,
  type AgentChatEvent,
  type AgentChatCommand,
  type ChatStartCommand,
} from '@aegir/kafka'

const kafka = createKafka('agents')

let producer: Producer
let consumer: Consumer

/** PubSub publish function, injected from the Mercurius subscription context. */
let pubsubPublish: ((payload: { topic: string; payload: any }) => void) | null = null

/** Callback to update conversation workflowId when workflow starts. */
let updateWorkflowIdFn: ((conversationId: string, workflowId: string) => Promise<void>) | null = null

/** Register the Mercurius pubsub so Kafka events can be forwarded to WebSocket clients. */
export function setPubSub(publishFn: (payload: { topic: string; payload: any }) => void) {
  pubsubPublish = publishFn
}

/** Register a callback to update conversation workflowId (called from app.ts). */
export function setWorkflowIdUpdater(fn: (conversationId: string, workflowId: string) => Promise<void>) {
  updateWorkflowIdFn = fn
}

export async function startKafkaBridge(signal: AbortSignal): Promise<void> {
  await ensureTopics(kafka, [...MANAGED_TOPICS])

  producer = await createProducer(kafka)
  consumer = await createConsumer(kafka, 'agents-events')

  await consumer.subscribe({ topic: TOPICS.AGENT_CHAT_EVENTS, fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = decode<AgentChatEvent>(message.value)
      if (!event) return

      console.log(`[kafka-bridge] received event: ${event.type} for conversation ${event.conversationId}`)

      try {
        switch (event.type) {
          case 'chat.stream.chunk':
            // Bridge stream chunks to WebSocket subscribers
            publishToWebSocket(event.conversationId, {
              id: `stream-${Date.now()}`,
              conversationId: event.conversationId,
              role: 'assistant',
              text: event.text,
              createdAt: event.timestamp,
            })
            break

          case 'chat.response.complete':
            // The deliver-response worker will persist via addMessage,
            // which publishes to WebSocket. No need to push here.
            console.log(`[kafka-bridge] response complete for ${event.conversationId} (${event.response.length} chars)`)
            break

          case 'chat.error':
            // Push error notification to the UI
            publishToWebSocket(event.conversationId, {
              id: `error-${Date.now()}`,
              conversationId: event.conversationId,
              role: 'system',
              text: `Error: ${event.error}`,
              createdAt: event.timestamp,
            })
            break

          case 'chat.workflow.started':
            // Update the conversation with the real workflowId from Conductor
            if (updateWorkflowIdFn) {
              await updateWorkflowIdFn(event.conversationId, event.workflowId)
            }
            console.log(`[kafka-bridge] workflow ${event.workflowId} started for conversation ${event.conversationId}`)
            break
        }
      } catch (err: any) {
        console.error(`[kafka-bridge] error handling ${event.type}: ${err.message}`)
      }
    },
  })

  signal.addEventListener('abort', async () => {
    await consumer.disconnect().catch(() => {})
    await producer.disconnect().catch(() => {})
  })

  console.log('[kafka-bridge] consuming agents.chat.events → WebSocket pubsub')
}

function publishToWebSocket(conversationId: string, message: Record<string, unknown>) {
  if (!pubsubPublish) {
    console.warn('[kafka-bridge] pubsub not registered yet, dropping message for', conversationId)
    return
  }
  console.log(`[kafka-bridge] publishing to WebSocket: ${message.id} for ${conversationId}`)
  pubsubPublish({
    topic: 'AGENTS_MESSAGE_ADDED',
    payload: { agentsMessageAdded: message },
  })
}

// ── Command producers ────────────────────────────────────────────

/** Send a chat.start command via Kafka — triggers a short-lived per-message workflow. */
export async function sendChatStartCommand(
  conversationId: string,
  projectId: string | null,
  text: string,
): Promise<void> {
  const cmd: ChatStartCommand = {
    type: 'chat.start',
    conversationId,
    projectId,
    text,
    timestamp: new Date().toISOString(),
  }
  await producer.send({
    topic: TOPICS.AGENT_CHAT_COMMANDS,
    messages: [{ key: conversationId, value: encode(cmd) }],
  })
}
