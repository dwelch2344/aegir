import { Kafka } from "kafkajs";
import { getEnv } from "@aegir/common";

const brokers = (
  getEnv("KAFKA_BROKERS", "redpanda:29092") ?? "redpanda:29092"
).split(",");

export const kafka = new Kafka({
  clientId: "conductor-cdc",
  brokers,
});

export const TOPICS = {
  // Raw Debezium CDC topics (consumed by this service)
  RAW_WORKFLOW: "conductor.cdc.public.workflow",
  RAW_TASK: "conductor.cdc.public.task",

  // Normalized Avro topics (produced by this service)
  WORKFLOW_EVENTS: "conductor.workflow.events",
  TASK_EVENTS: "conductor.task.events",
} as const;

export async function ensureTopics(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = await admin.listTopics();
    const toCreate = [TOPICS.WORKFLOW_EVENTS, TOPICS.TASK_EVENTS].filter(
      (t) => !existing.includes(t),
    );
    if (toCreate.length > 0) {
      await admin.createTopics({
        topics: toCreate.map((topic) => ({
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
      });
      console.log(`[cdc] created topics: ${toCreate.join(", ")}`);
    }
  } finally {
    await admin.disconnect();
  }
}
