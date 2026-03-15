# Topic: Kafka — Aegir Project

## Stack

- **Broker**: Redpanda (Kafka-compatible) on `redpanda:29092`
- **Client**: KafkaJS v2.2.4 via `@aegir/kafka` shared package
- **Schema Registry**: Redpanda Schema Registry at `http://redpanda:8083`
- **CDC**: Debezium PostgreSQL connector → Redpanda

## Shared Package (`@aegir/kafka`)

Factory functions in `packages/kafka/src/`:
- `createKafka(clientId)` — broker connection from `KAFKA_BROKERS` env
- `createProducer(kafka)` / `createConsumer(kafka, groupId)`
- `ensureTopics(kafka, topics[])` — auto-creates with 3 partitions, replication 1
- `encode()` / `decode<T>()` — JSON serialization helpers

## Topics

| Topic | Format | Key | Purpose |
|-------|--------|-----|---------|
| `agents.chat.commands` | JSON | conversationId | Chat start/message/close |
| `agents.chat.events` | JSON | conversationId | Stream chunks, completions, errors |
| `orchestration.workflow.lifecycle` | JSON | workflowId | Workflow started/completed/failed |
| `conductor.cdc.public.workflow` | Debezium JSON | workflow_id | Raw CDC from Conductor DB |
| `conductor.cdc.public.task` | Debezium JSON | task_id | Raw CDC from Conductor DB |
| `conductor.workflow.events` | Avro | workflow_id | Normalized workflow events |
| `conductor.task.events` | Avro | task_id | Normalized task events |

## Consumer Groups

- `agents-events` — Agents service ← `agents.chat.events`
- `orchestration-commands` — Orchestration service ← `agents.chat.commands`
- `conductor-cdc-normalizer` — CDC service ← `conductor.cdc.public.*`

## CDC Pipeline

```
Conductor DB (WAL) → Debezium → conductor.cdc.public.* (raw)
    → CDC Processor (normalizer) → conductor.{workflow,task}.events (Avro)
```

## WebSocket Bridge

```
Orchestration workers → agents.chat.events (Kafka)
    → Agents service consumer → Mercurius pubsub → WebSocket → Browser
```

## Key Conventions

- Topic naming: `<domain>.<entity>.<event-type>`
- All messages keyed by business entity ID for partition ordering
- JSON for command/event channels; Avro + Schema Registry for CDC
- `fromBeginning: false` for live consumers; `true` for CDC replay
- Graceful shutdown via AbortSignal on all producers/consumers
