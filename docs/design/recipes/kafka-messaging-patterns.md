# Recipe: Kafka Messaging Patterns

This recipe covers how to use Kafka (Redpanda) for inter-service communication in aegir. Kafka replaces direct REST calls between services for asynchronous workflows, providing decoupling, guaranteed delivery, and replay capability.

---

## Prerequisites

- Redpanda running (`.devcontainer/docker-compose.yml`)
- `@aegir/kafka` package available (`packages/kafka/`)
- `kafkajs` dependency in your service's `package.json`

---

## Architecture Overview

```
┌─────────────┐     Kafka Topics      ┌───────────────────┐
│   Agents    │ ──────────────────────▶│  Orchestration    │
│  Service    │  agents.chat.commands  │    Service        │
│             │ ◀──────────────────────│                   │
│  (WebSocket │  agents.chat.events   │  (Conductor +     │
│   pubsub)   │                       │   Workers)        │
└─────────────┘                       └───────────────────┘
      ▲                                       │
      │                                       │
      └───────────── agents.chat.events ──────┘
         (stream chunks, completions, errors)
```

### Topic Registry

All topics are defined in `packages/kafka/src/topics.ts`:

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `agents.chat.commands` | Agents → Orchestration | Start chat, send message, close conversation |
| `agents.chat.events` | Workers/Orchestration → Agents | Stream chunks, completion, errors, workflow started |
| `orchestration.workflow.lifecycle` | Orchestration → any | Workflow started/completed/failed events |
| `conductor.cdc.public.*` | Debezium → CDC service | Raw CDC from Conductor's PostgreSQL |
| `conductor.workflow.events` | CDC → any | Normalized workflow state changes (Avro) |
| `conductor.task.events` | CDC → any | Normalized task state changes (Avro) |

---

## 1. Using the Shared `@aegir/kafka` Package

### Add Dependency

```json
// package.json
{
  "dependencies": {
    "@aegir/kafka": "workspace:*",
    "kafkajs": "^2.2.4"
  }
}
```

### Create a Kafka Instance

```typescript
import { createKafka, ensureTopics, MANAGED_TOPICS } from '@aegir/kafka'

const kafka = createKafka('your-service-name')

// On startup, ensure all managed topics exist
await ensureTopics(kafka, [...MANAGED_TOPICS])
```

### Produce Messages

```typescript
import { createProducer, encode, TOPICS } from '@aegir/kafka'
import type { AgentChatCommand } from '@aegir/kafka'

const producer = await createProducer(kafka)

const cmd: AgentChatCommand = {
  type: 'chat.start',
  conversationId: '123',
  projectId: null,
  timestamp: new Date().toISOString(),
}

await producer.send({
  topic: TOPICS.AGENT_CHAT_COMMANDS,
  messages: [{ key: '123', value: encode(cmd) }],
})
```

### Consume Messages

```typescript
import { createConsumer, decode, TOPICS } from '@aegir/kafka'
import type { AgentChatEvent } from '@aegir/kafka'

const consumer = await createConsumer(kafka, 'your-consumer-group')

await consumer.subscribe({ topic: TOPICS.AGENT_CHAT_EVENTS, fromBeginning: false })

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = decode<AgentChatEvent>(message.value)
    if (!event) return

    switch (event.type) {
      case 'chat.stream.chunk':
        // handle stream chunk...
        break
      case 'chat.response.complete':
        // handle completion...
        break
    }
  },
})
```

---

## 2. Message Envelope Convention

Every Kafka message follows a typed envelope pattern with a `type` discriminator:

```typescript
interface MyCommand {
  type: 'my.action'        // discriminator for switch/case routing
  entityId: string          // business key (also used as Kafka message key)
  // ... payload fields
  timestamp: string         // ISO 8601
}
```

### Why `type` Discriminators?

- Single topic can carry multiple command/event types
- Consumers use `switch (msg.type)` for routing
- TypeScript discriminated unions provide exhaustive checking
- Easy to add new types without new topics

### Message Key Strategy

Use the primary business entity ID as the Kafka message key:
- `conversationId` for chat commands/events
- `workflowId` for lifecycle events
- `projectId` for project events

This ensures ordering within a conversation/workflow (same partition) while allowing parallelism across different entities.

---

## 3. Command/Event Pattern

### Commands (domain → orchestration)

Commands request an action. They are consumed by the orchestration service and trigger workflows.

```typescript
// Defined in @aegir/kafka messages.ts
export interface ChatStartCommand {
  type: 'chat.start'
  conversationId: string
  projectId: string | null
  timestamp: string
}
```

### Events (orchestration/workers → domain)

Events notify that something happened. They are consumed by domain services to update state or push to UI.

```typescript
export interface ChatStreamChunkEvent {
  type: 'chat.stream.chunk'
  conversationId: string
  text: string
  done: boolean
  timestamp: string
}
```

### Adding New Message Types

1. Define the interface in `packages/kafka/src/messages.ts`
2. Add it to the appropriate union type (`AgentChatCommand`, `AgentChatEvent`, etc.)
3. Export it from `packages/kafka/src/index.ts`
4. Add handling in the consumer's `switch` statement

---

## 4. Kafka-to-WebSocket Bridge

The agents service bridges Kafka events to WebSocket subscribers:

```
Worker produces                 Agents service              Browser
─────────────                  ──────────────              ───────
chat.stream.chunk ──▶ Kafka ──▶ Consumer ──▶ pubsub.publish() ──▶ Subscription
```

This pattern:
- **Decouples workers from WebSocket concerns** — workers just produce to Kafka
- **Centralizes the WebSocket bridge** — one consumer handles all event types
- **Supports horizontal scaling** — multiple agents service instances can share the consumer group
- **Preserves backward compatibility** — direct GraphQL `streamChunk` mutation still works

### Implementation

The bridge is in `services/agents/src/kafka-bridge.ts`:

```typescript
// Register pubsub from Mercurius
export function setPubSub(publishFn) {
  pubsubPublish = publishFn
}

// Bridge Kafka events to WebSocket
case 'chat.stream.chunk':
  pubsubPublish({
    topic: 'AGENTS_MESSAGE_ADDED',
    payload: { agentsMessageAdded: { ... } },
  })
```

---

## 5. Adding a New Topic

1. Add the topic name to `packages/kafka/src/topics.ts`:

```typescript
export const TOPICS = {
  // ... existing topics
  YOUR_NEW_TOPIC: 'your-domain.entity.events',
} as const
```

2. If it should be auto-created, add it to `MANAGED_TOPICS`:

```typescript
export const MANAGED_TOPICS: TopicName[] = [
  // ... existing
  TOPICS.YOUR_NEW_TOPIC,
]
```

3. Define message types in `messages.ts` and export from `index.ts`.

---

## 6. When to Use Kafka vs REST

| Criterion | Kafka | REST |
|-----------|-------|------|
| Caller needs immediate response | No | Yes |
| Fire-and-forget acceptable | Yes | No |
| Need guaranteed delivery | Yes | No (retries needed) |
| Need replay/audit trail | Yes | No |
| Real-time streaming to UI | Yes (via bridge) | Yes (via GraphQL) |
| Simple request/response | Overkill | Yes |

**Use Kafka for:**
- Agent chat commands and streaming events
- Workflow lifecycle notifications
- Cross-service event propagation
- Any pattern where the producer doesn't need to wait for the consumer

**Use REST for:**
- Synchronous queries (project lookup, metadata fetch)
- Health checks
- Simple trigger-and-wait patterns

---

## 7. Error Handling & Resilience

### Consumer Crashes

KafkaJS automatically re-joins the consumer group and resumes from the last committed offset. Messages are not lost.

### Producer Failures

Wrap `producer.send()` in try/catch. For critical messages, consider adding a retry:

```typescript
try {
  await producer.send({ topic, messages })
} catch (err) {
  console.error(`[kafka] failed to produce: ${err.message}`)
  // For non-critical (e.g., stream chunks), swallow the error
  // For critical (e.g., workflow commands), throw to surface to caller
}
```

### Graceful Shutdown

Always register an abort handler to disconnect cleanly:

```typescript
signal.addEventListener('abort', async () => {
  await consumer.disconnect().catch(() => {})
  await producer.disconnect().catch(() => {})
})
```

---

## Checklist

- [ ] Topic defined in `packages/kafka/src/topics.ts`
- [ ] Message types defined in `packages/kafka/src/messages.ts`
- [ ] `@aegir/kafka` dependency added to service `package.json`
- [ ] Kafka bridge module created in service (`kafka-bridge.ts`)
- [ ] Producer connected and producing commands/events
- [ ] Consumer subscribed and handling messages
- [ ] Graceful shutdown wired to `AbortSignal`
- [ ] WebSocket bridge registered (if events need to reach the UI)
- [ ] Tested: produce → consume → expected side effect
