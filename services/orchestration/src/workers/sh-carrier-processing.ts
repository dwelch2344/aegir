import type { TaskResult } from '../conductor.js'
import { randomDelay, log } from '../utils.js'

export async function handleShCarrierProcessing(task: any): Promise<TaskResult> {
  const { contractId, agentFullName } = task.inputData ?? {}

  const logs = [log(`Submitting contract ${contractId} to Select Health for processing`)]

  await randomDelay()
  logs.push(log(`Carrier acknowledgment received — processing in progress`))

  await randomDelay()
  logs.push(log(`Carrier processing complete for ${agentFullName}`))
  logs.push(log(`Completed DocuSign copies distributed to all parties`))

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: { carrierProcessed: true, documentsDistributed: true, contractId },
    logs,
  }
}
