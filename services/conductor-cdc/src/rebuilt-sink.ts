import pg from "pg";
import { getEnv } from "@aegir/common";
import { kafka, TOPICS } from "./kafka.js";
import { WorkflowEventSchema, TaskEventSchema } from "./schemas.js";
import { decodeStripHeader } from "./schema-registry.js";

const aegir_DATABASE_URL = getEnv(
  "aegir_DATABASE_URL",
  "postgresql://aegir:aegir_dev@postgres:5432/aegir",
);

export async function initaegirSinkDb(): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: aegir_DATABASE_URL });

  await pool.query(`CREATE SCHEMA IF NOT EXISTS conductor`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conductor.workflow_events (
      id                BIGSERIAL PRIMARY KEY,
      event_type        TEXT NOT NULL,
      workflow_id       TEXT NOT NULL,
      workflow_type     TEXT NOT NULL,
      version           INT NOT NULL DEFAULT 1,
      status            TEXT NOT NULL,
      correlation_id    TEXT,
      input             JSONB,
      output            JSONB,
      start_time        BIGINT,
      end_time          BIGINT,
      create_time       BIGINT NOT NULL,
      update_time       BIGINT NOT NULL,
      captured_at       BIGINT NOT NULL,
      inserted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_conductor_wf_events_workflow_id ON conductor.workflow_events(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_conductor_wf_events_status ON conductor.workflow_events(status);
    CREATE INDEX IF NOT EXISTS idx_conductor_wf_events_type ON conductor.workflow_events(workflow_type);

    CREATE TABLE IF NOT EXISTS conductor.task_events (
      id                    BIGSERIAL PRIMARY KEY,
      event_type            TEXT NOT NULL,
      task_id               TEXT NOT NULL,
      workflow_id           TEXT NOT NULL,
      task_type             TEXT NOT NULL,
      reference_task_name   TEXT NOT NULL,
      status                TEXT NOT NULL,
      worker_id             TEXT,
      input                 JSONB,
      output                JSONB,
      start_time            BIGINT,
      end_time              BIGINT,
      poll_count            INT NOT NULL DEFAULT 0,
      retry_count           INT NOT NULL DEFAULT 0,
      captured_at           BIGINT NOT NULL,
      inserted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_conductor_task_events_task_id ON conductor.task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_conductor_task_events_workflow_id ON conductor.task_events(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_conductor_task_events_status ON conductor.task_events(status);
    CREATE INDEX IF NOT EXISTS idx_conductor_task_events_type ON conductor.task_events(task_type);
  `);
  console.log("[cdc] aegir sink tables initialized (conductor schema)");
  return pool;
}

function parseJsonSafe(val: string | null): object | null {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Starts the aegir sink consumer: reads Avro-encoded events from the normalized
 * topics and inserts them into the aegir database under the conductor schema.
 */
export async function startaegirSinkConsumer(
  pool: pg.Pool,
  signal: AbortSignal,
): Promise<void> {
  const consumer = kafka.consumer({ groupId: "conductor-cdc-aegir-sink" });
  await consumer.connect();
  await consumer.subscribe({
    topics: [TOPICS.WORKFLOW_EVENTS, TOPICS.TASK_EVENTS],
    fromBeginning: true,
  });

  signal.addEventListener("abort", async () => {
    console.log("[cdc] shutting down aegir sink consumer...");
    await consumer.disconnect();
    await pool.end();
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const { payload } = decodeStripHeader(message.value as Buffer);

      if (topic === TOPICS.WORKFLOW_EVENTS) {
        const event = WorkflowEventSchema.fromBuffer(payload);
        await pool.query(
          `INSERT INTO conductor.workflow_events
            (event_type, workflow_id, workflow_type, version, status,
             correlation_id, input, output, start_time, end_time,
             create_time, update_time, captured_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            event.event_type,
            event.workflow_id,
            event.workflow_type,
            event.version,
            event.status,
            event.correlation_id,
            parseJsonSafe(event.input),
            parseJsonSafe(event.output),
            event.start_time,
            event.end_time,
            event.create_time,
            event.update_time,
            event.captured_at,
          ],
        );
        console.log(
          `[aegir-sink] persisted workflow event: ${event.workflow_id} (${event.status})`,
        );
      }

      if (topic === TOPICS.TASK_EVENTS) {
        const event = TaskEventSchema.fromBuffer(payload);
        await pool.query(
          `INSERT INTO conductor.task_events
            (event_type, task_id, workflow_id, task_type, reference_task_name,
             status, worker_id, input, output, start_time, end_time,
             poll_count, retry_count, captured_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            event.event_type,
            event.task_id,
            event.workflow_id,
            event.task_type,
            event.reference_task_name,
            event.status,
            event.worker_id,
            parseJsonSafe(event.input),
            parseJsonSafe(event.output),
            event.start_time,
            event.end_time,
            event.poll_count,
            event.retry_count,
            event.captured_at,
          ],
        );
        console.log(
          `[aegir-sink] persisted task event: ${event.task_id} (${event.task_type} → ${event.status})`,
        );
      }
    },
  });
}
