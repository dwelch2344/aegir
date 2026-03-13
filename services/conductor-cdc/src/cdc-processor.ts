import { kafka, TOPICS } from './kafka.js'
import { normalizeTaskEvent, normalizeWorkflowEvent } from './normalizer.js'
import { encodeWithSchemaId, registerSchema } from './schema-registry.js'
import type { TaskEvent, WorkflowEvent } from './schemas.js'
import { TaskEventSchema, WorkflowEventSchema } from './schemas.js'

let workflowSchemaId: number
let taskSchemaId: number

export async function registerSchemas(): Promise<void> {
  const workflowAvroSchema = {
    type: 'record',
    name: 'WorkflowEvent',
    namespace: 'com.aegir.conductor.cdc',
    fields: [
      {
        name: 'event_type',
        type: {
          type: 'enum',
          name: 'EventType',
          symbols: ['CREATE', 'UPDATE', 'DELETE'],
        },
      },
      { name: 'workflow_id', type: 'string' },
      { name: 'workflow_type', type: 'string' },
      { name: 'version', type: 'int' },
      { name: 'status', type: 'string' },
      { name: 'correlation_id', type: ['null', 'string'], default: null },
      { name: 'input', type: ['null', 'string'], default: null },
      { name: 'output', type: ['null', 'string'], default: null },
      { name: 'start_time', type: ['null', 'long'], default: null },
      { name: 'end_time', type: ['null', 'long'], default: null },
      { name: 'create_time', type: 'long' },
      { name: 'update_time', type: 'long' },
      { name: 'captured_at', type: 'long' },
    ],
  }

  const taskAvroSchema = {
    type: 'record',
    name: 'TaskEvent',
    namespace: 'com.aegir.conductor.cdc',
    fields: [
      {
        name: 'event_type',
        type: {
          type: 'enum',
          name: 'EventType',
          symbols: ['CREATE', 'UPDATE', 'DELETE'],
        },
      },
      { name: 'task_id', type: 'string' },
      { name: 'workflow_id', type: 'string' },
      { name: 'task_type', type: 'string' },
      { name: 'reference_task_name', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'worker_id', type: ['null', 'string'], default: null },
      { name: 'input', type: ['null', 'string'], default: null },
      { name: 'output', type: ['null', 'string'], default: null },
      { name: 'start_time', type: ['null', 'long'], default: null },
      { name: 'end_time', type: ['null', 'long'], default: null },
      { name: 'poll_count', type: 'int', default: 0 },
      { name: 'retry_count', type: 'int', default: 0 },
      { name: 'captured_at', type: 'long' },
    ],
  }

  workflowSchemaId = await registerSchema(`${TOPICS.WORKFLOW_EVENTS}-value`, workflowAvroSchema)
  taskSchemaId = await registerSchema(`${TOPICS.TASK_EVENTS}-value`, taskAvroSchema)
}

/**
 * Starts the CDC processor pipeline:
 * 1. Consumes raw Debezium CDC events from conductor.cdc.public.* topics
 * 2. Normalizes into WorkflowEvent / TaskEvent
 * 3. Encodes with Avro (Confluent wire format)
 * 4. Publishes to conductor.workflow.events / conductor.task.events
 */
export async function startCdcProcessor(signal: AbortSignal): Promise<void> {
  const consumer = kafka.consumer({ groupId: 'conductor-cdc-normalizer' })
  const producer = kafka.producer()

  await consumer.connect()
  await producer.connect()

  // Subscribe to all raw CDC topics matching conductor tables
  // Debezium creates topics like: conductor.cdc.public.<table_name>
  await consumer.subscribe({
    topics: [/^conductor\.cdc\.public\..*/],
    fromBeginning: true,
  })

  signal.addEventListener('abort', async () => {
    console.log('[cdc] shutting down CDC processor...')
    await consumer.disconnect()
    await producer.disconnect()
  })

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return
      const raw = JSON.parse(message.value.toString())

      // Determine which table this CDC event is for
      const tableName = topic.split('.').pop()

      if (tableName === 'workflow' || tableName === 'workflow_instance') {
        const event = normalizeWorkflowEvent(raw)
        if (event) {
          const avroBytes = WorkflowEventSchema.toBuffer(event)
          const encoded = encodeWithSchemaId(workflowSchemaId, avroBytes)
          await producer.send({
            topic: TOPICS.WORKFLOW_EVENTS,
            messages: [{ key: event.workflow_id, value: encoded }],
          })
          console.log(`[cdc] workflow ${event.event_type}: ${event.workflow_id} (${event.status})`)
        }
      }

      if (tableName === 'task' || tableName === 'task_in_progress' || tableName === 'task_instance') {
        const event = normalizeTaskEvent(raw)
        if (event) {
          const avroBytes = TaskEventSchema.toBuffer(event)
          const encoded = encodeWithSchemaId(taskSchemaId, avroBytes)
          await producer.send({
            topic: TOPICS.TASK_EVENTS,
            messages: [{ key: event.task_id, value: encoded }],
          })
          console.log(`[cdc] task ${event.event_type}: ${event.task_id} (${event.task_type} → ${event.status})`)
        }
      }
    },
  })
}
