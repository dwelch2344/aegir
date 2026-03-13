import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleAgentGatherContext(task: any): Promise<TaskResult> {
  const { conversationId } = task.inputData ?? {}

  try {
    const res = await fetch(config.agents.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($input: AgentsConversationSearchInput!) {
          agents { conversations { search(input: $input) {
            results { messages { role text } }
          } } }
        }`,
        variables: { input: { idIn: [conversationId] } },
      }),
    })

    const json = await res.json()
    const convo = json.data?.agents?.conversations?.search?.results?.[0]
    const messages = (convo?.messages ?? []).map((m: any) => ({ role: m.role, text: m.text }))

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { messages },
      logs: [
        { log: `Gathered ${messages.length} messages for conversation ${conversationId}`, createdTime: Date.now() },
      ],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Failed to gather context: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
