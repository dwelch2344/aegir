import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleAgentDeliverResponse(task: any): Promise<TaskResult> {
  const { conversationId, response } = task.inputData ?? {}

  try {
    const res = await fetch(config.agents.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($input: AgentsMessageAddInput!) {
          agents { conversations { addMessage(input: $input) { id } } }
        }`,
        variables: {
          input: { conversationId, role: 'assistant', text: response },
        },
      }),
    })

    const json = await res.json()
    const messageId = json.data?.agents?.conversations?.addMessage?.id

    if (!messageId) {
      throw new Error(json.errors?.[0]?.message ?? 'Failed to save assistant message')
    }

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { delivered: true, messageId },
      logs: [{ log: `Delivered response to conversation ${conversationId}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Failed to deliver response: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
