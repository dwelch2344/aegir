# Topic: Conductor — Aegir Project

## Stack

- **Engine**: Netflix Conductor at `http://conductor:8080/api`
- **Client**: Custom REST wrapper in `services/orchestration/src/conductor.ts`
- **Workers**: 22 handlers in `services/orchestration/src/workers/`
- **Triggers**: REST endpoints + Kafka consumer (`agents.chat.commands`)

## Worker Pattern

```typescript
async function handleTaskName(task: Task): Promise<TaskResult> {
  // task.inputData contains parameters from workflow definition
  return {
    status: 'COMPLETED',  // or 'FAILED'
    outputData: { ... },  // passed to next task via ${taskRef.output.field}
    logs: [{ log: '...', createdTime: Date.now() }]
  };
}
```

Workers use: shell exec (git), GraphQL calls (domain services), Kafka publishing,
Claude CLI subprocess spawning.

## Workflows

| Workflow | Tasks | Pattern |
|----------|-------|---------|
| `user_onboarding` | 3 | Sequential: validate → provision → email |
| `select_health_aca_new_contract` | 8 | Sequential + WAIT (DocuSign) |
| `agent_chat_message` | 3 | Short-lived per-message: gather → invoke → deliver |
| `project_sync` | 3 | Sequential: clone → parse → store |
| `project_apply_pattern` | 4 | Apply → commit → reparse → store |
| `project_scaffold` | 5 | Create → clone → init → parse → store |

## Kafka Integration

- Consumes `agents.chat.commands` → starts per-message workflows
- Produces `agents.chat.events` (stream chunks from Claude workers)
- Produces `orchestration.workflow.lifecycle` (started/completed/failed)

## Worker Runner

Centralized dispatcher in `worker-runner.ts`:
- Maintains `handlers` map of taskName → handler
- Long-polls Conductor every 1s per task type
- Worker ID: `orchestration-{pid}`
- Graceful shutdown via AbortSignal

## Registration

- Task defs and workflow defs registered on service startup
- HTTP 409 treated as idempotent success
- Retry logic on registration failure (Conductor may not be ready)

## Key Files

- `conductor.ts` — REST client
- `definitions.ts` — all task + workflow definitions
- `worker-runner.ts` — polling dispatcher
- `kafka-bridge.ts` — Kafka consumer/producer
- `workers/*.ts` — 22 handler implementations
- Recipe: `docs/design/recipes/adding-a-conductor-workflow.md`
