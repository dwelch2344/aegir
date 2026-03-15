# Topic: Kafka (System)

> General Kafka best practices and patterns.
> Project-specific conventions are in `project/topics/kafka.md`.

## Core Concepts

- **Topics** are append-only logs partitioned for parallelism
- **Consumer groups** allow horizontal scaling — each partition assigned to one consumer
- **Keys** determine partition assignment — same key = same partition = ordering guarantee
- Use business entity IDs as message keys (e.g., orderId, conversationId)

## Producer Patterns

- Always set a message key for ordering guarantees
- Use `acks: -1` (all replicas) for critical data; `acks: 1` for streaming/ephemeral
- Batch messages where latency allows — reduces broker load
- Handle producer errors: retry transient, dead-letter persistent failures

## Consumer Patterns

- Commit offsets after processing, not before (at-least-once by default)
- Design consumers to be idempotent — duplicate delivery is normal
- Use `fromBeginning: true` only for replay/catch-up scenarios
- Keep consumer processing fast — long tasks block the partition

## Schema & Serialization

- JSON for simple command/event envelopes (easy debugging, schema-optional)
- Avro + Schema Registry for high-volume or cross-team topics (schema evolution)
- Confluent wire format: `[0x00][4-byte schema ID][Avro payload]`
- Always register schemas before producing; consumers fetch schema by ID

## CDC / Debezium

- Debezium captures row-level changes from database WAL (logical replication)
- Raw CDC topics use Debezium's envelope: `{ before, after, op, source, ts_ms }`
- `op` values: `c` = create, `u` = update, `d` = delete, `r` = snapshot read
- Normalize raw CDC into domain events before downstream consumption
- Enable heartbeats to keep replication slots active during low-traffic periods

## Topic Naming

Convention: `<domain>.<entity>.<event-type>`

Examples:
- `orders.payment.events` — domain events
- `cdc.public.orders` — raw CDC from a table
- `orders.payment.commands` — command channel

## Operational

- Set retention policies per topic based on use case (events: long, commands: short)
- Monitor consumer lag — growing lag indicates processing bottleneck
- Partitions cannot be reduced — start conservative, scale up
