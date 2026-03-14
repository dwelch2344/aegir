# Recipe: Adding a Conductor Workflow

This recipe covers how to add a new orchestrated workflow using Netflix Conductor. Follow these steps in order.

---

## Prerequisites

- Orchestration service running (`services/orchestration/`)
- Conductor instance available (default: `http://conductor:8080/api`)
- Target domain service (e.g., projects, agents) already exists

---

## 1. Define the Workflow & Tasks (`src/definitions.ts`)

### Task Definitions

Each task a worker can perform must be declared:

```typescript
const taskDefinitions: TaskDefinition[] = [
  // ...existing tasks...
  { name: 'your_task_name', retryCount: 1, timeoutSeconds: 120, ownerEmail: 'dev@example.com' },
]
```

Convention: `snake_case` task names, prefixed by domain (e.g., `project_clone`, `agent_invoke_claude`).

### Workflow Definition

Workflows compose tasks into a sequence:

```typescript
const workflowDefinitions: WorkflowDefinition[] = [
  // ...existing workflows...
  {
    name: 'your_workflow_name',
    version: 1,
    tasks: [
      {
        name: 'first_task',
        taskReferenceName: 'first_task_ref',
        type: 'SIMPLE',
        inputParameters: {
          someParam: '${workflow.input.someParam}',
        },
      },
      {
        name: 'second_task',
        taskReferenceName: 'second_task_ref',
        type: 'SIMPLE',
        inputParameters: {
          resultFromFirst: '${first_task_ref.output.someResult}',
        },
      },
    ],
    inputParameters: ['someParam'],
    outputParameters: {
      finalResult: '${second_task_ref.output.result}',
    },
  },
]
```

Key patterns:
- **Data flow**: `${taskRef.output.field}` references output from earlier tasks
- **Workflow input**: `${workflow.input.field}` references workflow start parameters
- **Task types**: `SIMPLE` (worker-polled), `DO_WHILE` (loops), `WAIT` (external signal)

### Conductor Task Types Used

| Type | Use Case | Example |
|------|----------|---------|
| `SIMPLE` | Worker polls and executes | `project_clone`, `agent_invoke_claude` |
| `DO_WHILE` | Loop until condition | Agent chat (loop while user sends messages) |
| `WAIT` | Wait for external signal | `agent_wait_for_message` (REST triggers resume) |

---

## 2. Implement the Worker (`src/workers/your-task.ts`)

```typescript
import type { Task } from '../conductor.js'
import { config } from '../config.js'

export async function yourTaskName(task: Task) {
  const { someParam } = task.inputData as { someParam: string }

  // Do the work...
  const result = await doSomething(someParam)

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED' as const,
    outputData: { result },
    logs: [{ log: `Processed ${someParam}`, createdTime: Date.now() }],
  }
}
```

### TaskResult Interface

Every worker returns:

```typescript
{
  workflowInstanceId: string   // from task
  taskId: string               // from task
  status: 'COMPLETED' | 'FAILED'
  outputData: Record<string, unknown>  // passed to next task via ${ref.output.*}
  logs: Array<{ log: string; createdTime: number }>  // visible in Conductor UI
}
```

### Error Handling

Return `status: 'FAILED'` instead of throwing — this lets Conductor handle retries:

```typescript
try {
  // work...
  return { ...task, status: 'COMPLETED', outputData: { result } }
} catch (err: any) {
  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'FAILED',
    outputData: { error: err.message },
    logs: [{ log: `Failed: ${err.message}`, createdTime: Date.now() }],
  }
}
```

### Common Worker Patterns

**Shell execution** (git, CLI tools):

```typescript
import { execSync } from 'node:child_process'

const output = execSync('git clone ...', {
  cwd: workDir,
  encoding: 'utf-8',
  timeout: 60_000,
})
```

**Calling other services via GraphQL**:

```typescript
const res = await fetch(config.projects.graphqlUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `mutation { ... }`, variables: { ... } }),
})
```

**Streaming long operations** (Claude, builds):

```typescript
import { spawn } from 'node:child_process'

const proc = spawn('claude', ['--output-format', 'text'], { cwd: localPath })
let output = ''
proc.stdout.on('data', (chunk) => {
  output += chunk.toString()
  // Throttle updates to Conductor logs
})
await new Promise((resolve, reject) => {
  proc.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`Exit ${code}`)))
})
```

**Activity logging** (real-time UI updates):

```typescript
async function logProjectActivity(projectId: number, workflowId: string, type: string, status: string, message: string) {
  await fetch(config.projects.graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation($input: ProjectsActivityInput!) {
        projects { projects { logActivity(input: $input) { id } } }
      }`,
      variables: { input: { projectId, workflowId, type, status, entries: [{ message, timestamp: new Date().toISOString() }] } },
    }),
  })
}
```

---

## 3. Register the Worker (`src/worker-runner.ts`)

```typescript
import { yourTaskName } from './workers/your-task.js'

const workers: Record<string, (task: Task) => Promise<TaskResult>> = {
  // ...existing workers...
  your_task_name: yourTaskName,
}
```

The worker runner polls Conductor for each registered task type (1s interval) and dispatches to the handler function.

---

## 4. Add a REST Trigger (`src/app.ts`)

Workflows are started via REST endpoints on the orchestration service:

```typescript
fastify.post<{ Body: { someId: number; someParam: string } }>(
  '/your-domain/your-action',
  async (request) => {
    const { someId, someParam } = request.body
    const workflowId = await startWorkflow('your_workflow_name', {
      someId,
      someParam,
    })
    return { someId, workflowId }
  },
)
```

`startWorkflow()` posts to Conductor's `/workflow` API and returns the workflow instance ID.

---

## 5. Wire Up the Domain Service Resolver

The domain service (e.g., projects) exposes a GraphQL mutation that calls the orchestration REST endpoint:

```typescript
// resolvers.ts
async yourAction(_: unknown, args: { input: { someId: number } }) {
  const res = await fetch(`${orchestrationUrl}/your-domain/your-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.input),
  })
  return res.json()  // { someId, workflowId }
}
```

This keeps the orchestration concern separate — the domain service doesn't know about Conductor.

---

## 6. Frontend Integration

### Trigger the Workflow

Call the GraphQL mutation from a composable:

```typescript
async function triggerAction(id: number) {
  return gql<{ domain: { action: { workflowId: string } } }>(`
    mutation($id: Int!) {
      domain { entities { action(id: $id) { workflowId } } }
    }
  `, { id })
}
```

### Subscribe to Activity Updates

For real-time progress, use GraphQL subscriptions:

```typescript
function subscribeToActivity(entityId: number, onEvent: (event: any) => void) {
  const ws = new WebSocket(gatewayWsUrl, 'graphql-transport-ws')
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'connection_init' }))
    ws.send(JSON.stringify({
      id: '1',
      type: 'subscribe',
      payload: {
        query: `subscription($entityId: Int!) {
          activityUpdated(entityId: $entityId) { type status entries { message timestamp } }
        }`,
        variables: { entityId },
      },
    }))
  }
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data)
    if (data.type === 'next') onEvent(data.payload.data.activityUpdated)
  }
  return () => ws.close()
}
```

---

## Data Flow Summary

```
User Action (Frontend)
  ↓ GraphQL mutation
Domain Service Resolver
  ↓ REST POST
Orchestration Service
  ↓ startWorkflow()
Conductor
  ↓ queues tasks
Workers poll & execute
  ↓ call back to services (GraphQL mutations, activity logs)
Activity logged → pubsub emitted
  ↓ WebSocket subscription
Frontend updates UI in real-time
```

---

## Checklist

- [ ] Task definitions added to `definitions.ts`
- [ ] Workflow definition added to `definitions.ts`
- [ ] Worker function implemented in `src/workers/`
- [ ] Worker registered in `worker-runner.ts`
- [ ] REST trigger endpoint added to `app.ts`
- [ ] Domain service resolver wired to orchestration REST
- [ ] Frontend composable calls mutation + subscribes to activity
- [ ] Tested end-to-end: trigger → worker executes → activity appears in UI
