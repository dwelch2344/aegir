# conductor-cdc

Change Data Capture (CDC) normalization pipeline that bridges the Conductor workflow engine with the platform's event-driven architecture. It captures real-time changes from Conductor's PostgreSQL database and transforms them into normalized, Avro-encoded events.

## Data Flow

```
Conductor PostgreSQL (WAL)
    -> Debezium Connect (CDC producer)
    -> Raw Kafka topics (conductor.cdc.public.*)
    -> conductor-cdc (normalize + Avro encode)
    -> Normalized Kafka topics
    -> Sink consumers
    -> conductor_cdc PostgreSQL database (dedicated sink DB)
    -> aegir.conductor schema (main application DB)
```

## Key Components

| File                     | Role                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `src/app.ts`             | Orchestrates 8-step startup: topics, schemas, Debezium, sink DBs, processor, consumers  |
| `src/cdc-processor.ts`   | Consumes raw Debezium JSON, normalizes, encodes as Avro, publishes to normalized topics |
| `src/normalizer.ts`      | Maps Debezium ops (`c`/`u`/`d`) to event types, extracts and transforms fields          |
| `src/schemas.ts`         | Avro schema definitions for `WorkflowEvent` and `TaskEvent`                             |
| `src/schema-registry.ts` | Registers schemas with Redpanda Schema Registry, handles Confluent wire format          |
| `src/debezium.ts`        | Registers the PostgreSQL CDC connector with Debezium Connect                            |
| `src/kafka.ts`           | Kafka/Redpanda client config and topic constants                                        |
| `src/sink.ts`            | Persists normalized events into `conductor_cdc` PostgreSQL database                     |
| `src/aegir-sink.ts`      | Persists normalized events into the `aegir.conductor` schema (main app DB)              |

## Topics

- **Raw (consumed):** `conductor.cdc.public.workflow`, `conductor.cdc.public.task`
- **Normalized (produced):** `conductor.workflow.events`, `conductor.task.events`

## Infrastructure Dependencies

- **PostgreSQL** — source DB (logical replication enabled) + sink DB (`conductor_cdc`) + main app DB (`aegir.conductor` schema)
- **Redpanda** — Kafka broker + schema registry
- **Debezium Connect** — captures WAL changes from PostgreSQL
- **Conductor** — the workflow engine whose data is being captured

## Configuration

Environment variables:

| Variable              | Default                                                    | Description                         |
| --------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `CDC_PORT`            | `4020`                                                     | Health check server port            |
| `CDC_HOST`            | `0.0.0.0`                                                  | Health check server host            |
| `KAFKA_BROKERS`       | `redpanda:29092`                                           | Kafka/Redpanda broker address       |
| `SCHEMA_REGISTRY_URL` | `http://redpanda:8083`                                     | Redpanda Schema Registry URL        |
| `CDC_DATABASE_URL`    | `postgresql://aegir:aegir_dev@postgres:5432/conductor_cdc` | CDC sink database connection string |
| `aegir_DATABASE_URL`  | `postgresql://aegir:aegir_dev@postgres:5432/aegir`         | Main app database connection string |
| `DEBEZIUM_URL`        | `http://debezium-connect:8083`                             | Debezium Connect REST API URL       |

## Design Patterns

- **Multi-stage normalization**: raw CDC -> Avro -> relational sink
- **Confluent wire format** for schema-aware serialization
- **Retry logic** (30 attempts, 3s intervals) for connector registration
- **Triple consumer**: processor, CDC sink, and aegir sink run concurrently
- **Append-only event log** in the sink database with indexes on workflow/task IDs and status

## Health Check

`GET /health` returns:

```json
{
  "status": "ok",
  "service": "conductor-cdc",
  "connector": "<debezium connector state>"
}
```
