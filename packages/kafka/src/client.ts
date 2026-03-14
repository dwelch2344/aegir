import { getEnv } from '@aegir/common'
import { Kafka, type Producer, type Consumer, type KafkaConfig } from 'kafkajs'

const brokers = (getEnv('KAFKA_BROKERS', 'redpanda:29092') ?? 'redpanda:29092').split(',')

/** Create a Kafka instance for a given service. */
export function createKafka(clientId: string, overrides?: Partial<KafkaConfig>): Kafka {
  return new Kafka({
    clientId,
    brokers,
    ...overrides,
  })
}

/** Ensure managed topics exist, creating any that are missing. */
export async function ensureTopics(kafka: Kafka, topics: string[]): Promise<void> {
  const admin = kafka.admin()
  await admin.connect()
  try {
    const existing = await admin.listTopics()
    const toCreate = topics.filter((t) => !existing.includes(t))
    if (toCreate.length > 0) {
      await admin.createTopics({
        topics: toCreate.map((topic) => ({
          topic,
          numPartitions: 3, // allow parallel consumers
          replicationFactor: 1,
        })),
      })
      console.log(`[kafka] created topics: ${toCreate.join(', ')}`)
    }
  } finally {
    await admin.disconnect()
  }
}

/** Create and connect a producer. Caller must disconnect when done. */
export async function createProducer(kafka: Kafka): Promise<Producer> {
  const producer = kafka.producer()
  await producer.connect()
  return producer
}

/** Create and connect a consumer. Caller must disconnect when done. */
export async function createConsumer(kafka: Kafka, groupId: string): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId })
  await consumer.connect()
  return consumer
}
