export { createKafka, ensureTopics, createProducer, createConsumer } from './client.js'
export { TOPICS, MANAGED_TOPICS, type TopicName } from './topics.js'
export {
  encode,
  decode,
  type AgentChatCommand,
  type AgentChatEvent,
  type ChatStartCommand,
  type ChatStreamChunkEvent,
  type ChatResponseCompleteEvent,
  type ChatErrorEvent,
  type ChatWorkflowStartedEvent,
  type WorkflowLifecycleEvent,
} from './messages.js'
