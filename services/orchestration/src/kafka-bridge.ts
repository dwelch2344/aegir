/**
 * Kafka bridge for the orchestration service.
 *
 * Consumes: agents.chat.commands  → triggers workflow starts and signals WAIT tasks
 * Produces: agents.chat.events    → publishes workflow-started confirmations
 * Produces: orchestration.workflow.lifecycle → publishes workflow lifecycle events
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
  type AgentChatCommand,
  type ChatWorkflowStartedEvent,
  type WorkflowLifecycleEvent,
} from '@aegir/kafka'
import { signalWaitTask, startWorkflow, getWorkflow } from './conductor.js'
import { config } from './config.js'

const kafka = createKafka('orchestration')

let producer: Producer
let consumer: Consumer

export async function startKafkaBridge(signal: AbortSignal): Promise<void> {
  await ensureTopics(kafka, [...MANAGED_TOPICS])

  producer = await createProducer(kafka)
  consumer = await createConsumer(kafka, 'orchestration-commands')

  await consumer.subscribe({ topic: TOPICS.AGENT_CHAT_COMMANDS, fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ message }) => {
      const cmd = decode<AgentChatCommand>(message.value)
      if (!cmd) return

      try {
        switch (cmd.type) {
          case 'chat.start':
            await handleChatStart(cmd)
            break
          case 'chat.message':
            await handleChatMessage(cmd)
            break
          case 'chat.close':
            await handleChatClose(cmd)
            break
        }
      } catch (err: any) {
        console.error(`[kafka-bridge] error handling ${cmd.type}: ${err.message}`)
      }
    },
  })

  signal.addEventListener('abort', async () => {
    await consumer.disconnect().catch(() => {})
    await producer.disconnect().catch(() => {})
  })

  console.log('[kafka-bridge] consuming agents.chat.commands')
}

async function handleChatStart(cmd: Extract<AgentChatCommand, { type: 'chat.start' }>) {
  // Resolve localPath if projectId is provided (same logic as REST endpoint)
  let localPath: string | null = null
  if (cmd.projectId) {
    try {
      const res = await fetch(config.projects.graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($input: ProjectsProjectSearchInput!) {
            projects { projects { search(input: $input) { results { localPath } } } }
          }`,
          variables: { input: { idIn: [cmd.projectId] } },
        }),
      })
      const json = (await res.json()) as any
      localPath = json.data?.projects?.projects?.search?.results?.[0]?.localPath ?? null
    } catch {
      // best effort
    }
  }

  const workflowId = await startWorkflow('agent_chat_conversation', {
    conversationId: cmd.conversationId,
    projectId: cmd.projectId,
    localPath,
  })

  // Publish confirmation event back to agents service
  const event: ChatWorkflowStartedEvent = {
    type: 'chat.workflow.started',
    conversationId: cmd.conversationId,
    workflowId,
    timestamp: new Date().toISOString(),
  }
  await producer.send({
    topic: TOPICS.AGENT_CHAT_EVENTS,
    messages: [{ key: cmd.conversationId, value: encode(event) }],
  })

  // Also publish lifecycle event
  await publishLifecycle({
    type: 'workflow.started',
    workflowId,
    workflowName: 'agent_chat_conversation',
    input: { conversationId: cmd.conversationId, projectId: cmd.projectId },
    timestamp: new Date().toISOString(),
  })
}

async function handleChatMessage(cmd: Extract<AgentChatCommand, { type: 'chat.message' }>) {
  await signalWaitTask(cmd.workflowId, 'agent_wait_for_message_ref', {
    text: cmd.text,
    action: 'continue',
  })
}

async function handleChatClose(cmd: Extract<AgentChatCommand, { type: 'chat.close' }>) {
  await signalWaitTask(cmd.workflowId, 'agent_wait_for_message_ref', {
    action: 'close',
  })
}

/** Publish a workflow lifecycle event. */
export async function publishLifecycle(event: WorkflowLifecycleEvent): Promise<void> {
  if (!producer) return
  await producer.send({
    topic: TOPICS.WORKFLOW_LIFECYCLE,
    messages: [{ key: event.workflowId, value: encode(event) }],
  })
}

/** Publish a chat event (used by workers to stream chunks). */
export async function publishChatEvent(
  conversationId: string,
  event: import('@aegir/kafka').AgentChatEvent,
): Promise<void> {
  if (!producer) return
  await producer.send({
    topic: TOPICS.AGENT_CHAT_EVENTS,
    messages: [{ key: conversationId, value: encode(event) }],
  })
}

/** Get the shared producer (for workers to use). */
export function getProducer(): Producer | undefined {
  return producer
}
