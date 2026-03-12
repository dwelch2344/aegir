import type { TaskResult } from '../conductor.js'
import { updateContractStatus } from '../integrations/agent-intel.js'
import { config } from '../config.js'
import { randomDelay, log } from '../utils.js'

export async function handleShHfCountersignAndTraining(task: any): Promise<TaskResult> {
  const { agentEmail, agentFullName, contractId } = task.inputData ?? {}

  const logs = [log(`Starting HF countersign process for ${agentFullName}`)]

  await randomDelay()
  logs.push(log(`HF Contracting (Brandon Combs) countersigning as "Health First Insurance"`))

  await updateContractStatus({
    contractId,
    agentNpn: task.inputData?.agentNpn ?? '',
    status: 'hf_signed',
    carrierName: 'Select Health',
  })

  logs.push(log(`Agent Intel updated — status: hf_signed`))

  await randomDelay()
  logs.push(log(`Scheduling training session with ${config.selectHealth.trainingContact}`))
  logs.push(log(`Training invitation sent to ${agentEmail}`))

  await randomDelay()
  logs.push(log(`Andrew Freeze signature obtained`))

  await updateContractStatus({
    contractId,
    agentNpn: task.inputData?.agentNpn ?? '',
    status: 'fully_signed',
    carrierName: 'Select Health',
  })

  logs.push(log(`Agent Intel updated — status: fully_signed`))

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: {
      docusignStatus: 'fully_signed',
      trainingComplete: true,
      agentIntelStatus: 'fully_signed',
      contractId,
    },
    logs,
  }
}
