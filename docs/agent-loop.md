# Plan: Convert `agent_chat_respond` to a Persistent Conversation Loop

## Problem

Today, every user message starts a **new** workflow execution (`agent_chat_respond`). A 5-message conversation = 5 separate executions. There's no visual or logical grouping — you can't see the whole thread as a single workflow.

## Solution: DO_WHILE Loop + WAIT (Human) Task

Conductor OSS supports two key primitives that solve this:

1. **`DO_WHILE`** — a looping construct that repeats its child tasks until a condition evaluates to `false`
2. **`WAIT`** — a task that pauses the workflow until an external signal (API call) resumes it

## New Workflow: `agent_chat_conversation`

Instead of `agent_chat_respond` (fire-and-forget per message), we define a single long-lived workflow per conversation:

```
START → DO_WHILE (loop until closed) →
  ┌─ WAIT (for next user message)        ← pauses here
  ├─ agent_gather_context                 ← fetches full history
  ├─ agent_invoke_claude                  ← calls Claude
  └─ agent_deliver_response              ← saves response
→ END
```

The `DO_WHILE` condition: `$.agent_wait_for_message_ref.output.action != 'close'`

Each iteration is visible as a loop pass inside the **single** workflow execution.

## Changes Required

### 1. New task def: `agent_wait_for_message` (type: `WAIT`)

No worker needed — Conductor handles WAIT tasks natively. The workflow pauses until you POST to Conductor's `/tasks/{taskId}` endpoint with the user's message + an `action` field (`"continue"` or `"close"`).

### 2. Update workflow definition in `definitions.ts`

```ts
export const agentChatWorkflow: WorkflowDef = {
  name: 'agent_chat_conversation',
  description: 'Long-lived agent chat — loops waiting for human messages until closed',
  version: 1,
  schemaVersion: 2,
  ownerEmail: agentChatOwner,
  tasks: [
    {
      name: 'DO_WHILE',
      taskReferenceName: 'chat_loop_ref',
      type: 'DO_WHILE',
      loopCondition: "$.agent_wait_for_message_ref['action'] != 'close'",
      loopOver: [
        {
          name: 'WAIT',
          taskReferenceName: 'agent_wait_for_message_ref',
          type: 'WAIT',
          inputParameters: {},
        },
        {
          name: 'agent_gather_context',
          taskReferenceName: 'agent_gather_context_ref',
          type: 'SIMPLE',
          inputParameters: {
            conversationId: '${workflow.input.conversationId}',
          },
        },
        {
          name: 'agent_invoke_claude',
          taskReferenceName: 'agent_invoke_claude_ref',
          type: 'SIMPLE',
          inputParameters: {
            text: '${agent_wait_for_message_ref.output.text}',
            messages: '${agent_gather_context_ref.output.messages}',
          },
        },
        {
          name: 'agent_deliver_response',
          taskReferenceName: 'agent_deliver_response_ref',
          type: 'SIMPLE',
          inputParameters: {
            conversationId: '${workflow.input.conversationId}',
            response: '${agent_invoke_claude_ref.output.response}',
          },
        },
      ],
    },
  ],
}
```

### 3. Update `conductor.ts` — add a `signalWaitTask` helper

```ts
export async function signalWaitTask(workflowId: string, taskRefName: string, output: Record<string, any>) {
  // Find the pending WAIT task in the workflow, then complete it with output
  const wf = await getWorkflow(workflowId)
  const waitTask = wf.tasks.find((t: any) =>
    t.referenceTaskName === taskRefName && t.status === 'IN_PROGRESS'
  )
  if (!waitTask) throw new Error(`No pending WAIT task "${taskRefName}" in workflow ${workflowId}`)
  return updateTask({
    workflowInstanceId: workflowId,
    taskId: waitTask.taskId,
    status: 'COMPLETED',
    outputData: output,
  })
}
```

### 4. Update `app.ts` — change the `/agents/chat` endpoint

Two modes:
- **First message** (no `workflowId`): Starts the conversation workflow, then immediately signals the WAIT task with the first message
- **Subsequent messages** (has `workflowId`): Signals the existing workflow's WAIT task

```ts
// Start a new conversation
fastify.post('/agents/chat/start', async (req) => {
  const { conversationId } = req.body
  const workflowId = await startWorkflow('agent_chat_conversation', { conversationId })
  return { workflowId }
})

// Send a message into an existing conversation workflow
fastify.post('/agents/chat/message', async (req) => {
  const { workflowId, text } = req.body
  await signalWaitTask(workflowId, 'agent_wait_for_message_ref', { text, action: 'continue' })
  return { ok: true }
})

// Close the conversation
fastify.post('/agents/chat/close', async (req) => {
  const { workflowId } = req.body
  await signalWaitTask(workflowId, 'agent_wait_for_message_ref', { action: 'close' })
  return { ok: true }
})
```

### 5. Update `WorkflowDef` / `WorkflowTask` types in `conductor.ts`

Add `loopCondition`, `loopOver`, and `type: 'DO_WHILE' | 'WAIT'` to the interfaces.

### 6. Frontend changes (in `apps/app`)

The Vue frontend needs to:
- Store the `workflowId` when a conversation starts
- Send subsequent messages to `/agents/chat/message` instead of starting new workflows
- Add a "close conversation" action

## What This Gets You

- **One workflow per conversation** — all loop iterations visible as tasks inside it
- **No polling from the frontend** — the workflow waits natively until signaled
- **Clean shutdown** — sending `action: 'close'` exits the loop and completes the workflow
- **Conversation history preserved** — `agent_gather_context` still fetches the full thread each iteration
- **Timeouts** — you can set a `timeoutSeconds` on the WAIT task so stale conversations auto-close

## Risks / Considerations

- **Conductor WAIT task timeout**: Long-lived WAIT tasks need generous timeouts (hours/days) or `ALERT_ONLY` timeout policy. Default timeouts will kill the workflow.
- **DO_WHILE iteration limits**: Conductor has a default max loop iteration count (configurable). Need to set it high enough for long conversations.
- **Workflow versioning**: This is a breaking change to the workflow name/shape. Existing `agent_chat_respond` executions should be left to complete; new conversations use the new workflow.
