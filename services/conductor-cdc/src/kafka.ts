import { createKafka, ensureTopics as ensureTopicsBase, TOPICS } from '@aegir/kafka'

export const kafka = createKafka('conductor-cdc')

// Re-export TOPICS so existing imports continue to work
export { TOPICS }

export async function ensureTopics(): Promise<void> {
  await ensureTopicsBase(kafka, [TOPICS.WORKFLOW_EVENTS, TOPICS.TASK_EVENTS])
}
