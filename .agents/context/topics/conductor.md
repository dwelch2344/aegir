# Topic: Conductor (System)

> General Netflix Conductor workflow orchestration patterns.
> Project-specific conventions are in `project/topics/conductor.md`.

## Core Concepts

- **Workflow**: A DAG of tasks with input/output data flow
- **Task**: A unit of work — polled by a worker, executed, result reported back
- **Worker**: A process that long-polls for tasks of a given type and executes them

## Task Types

| Type | Use Case |
|------|----------|
| `SIMPLE` | Worker-polled synchronous execution |
| `WAIT` | Pauses until external signal (REST or event) |
| `DO_WHILE` | Loops until a condition evaluates false |
| `SWITCH` | Conditional branching based on expression |
| `FORK/JOIN` | Parallel task execution with join barrier |
| `SUB_WORKFLOW` | Delegate to another workflow definition |

## Worker Patterns

- Handler signature: `(task) → { status, outputData, logs }`
- Return `COMPLETED` or `FAILED` — don't throw (let Conductor handle retries)
- Keep workers stateless — all context comes from `task.inputData`
- Use structured logs (`logs` array) for visibility in Conductor UI
- Workers should be idempotent — Conductor may re-dispatch on timeout

## Data Flow

- Template syntax: `${taskRefName.output.field}` chains task outputs
- `${workflow.input.field}` accesses workflow start parameters
- Keep payloads small — Conductor stores them in its database

## Registration

- Register task definitions first, then workflow definitions
- Task defs specify: retry count, timeout, rate limit, concurrency
- Workflow defs specify: task ordering, input mappings, loop conditions
- Treat 409 (conflict) as idempotent success on registration

## WAIT Task Pattern

Use for human-in-the-loop or external system callbacks:
1. Workflow reaches WAIT task and pauses
2. External system completes work (e.g., user signs document)
3. Signal sent via REST `POST /tasks/{taskId}` or Kafka event
4. Workflow resumes with signal payload as task output

## Operational

- Monitor pending task queues — growing queues indicate worker scaling needed
- Set appropriate timeouts — WAIT tasks may need long timeouts (hours/days)
- Use workflow versioning for backward-compatible changes
