import type { TaskResult } from '../conductor.js'
import { updateContractStatus } from '../integrations/agent-intel.js'
import { log, randomDelay } from '../utils.js'

export async function handleShAgentSignsDocusign(task: any): Promise<TaskResult> {
  const { agentEmail, agentFullName, contractId } = task.inputData ?? {}

  const logs = [log(`Preparing DocuSign envelope for ${agentFullName}`)]

  await randomDelay()
  logs.push(log(`DocuSign envelope created — sending to ${agentEmail}`))
  logs.push(log(`Subject: Agent Ind/Group Appointment with Health First - ${agentFullName}`))

  await randomDelay()
  logs.push(log(`DocuSign delivered — awaiting agent signature`))

  await updateContractStatus({
    contractId,
    agentNpn: task.inputData?.agentNpn ?? '',
    status: 'agent_signed',
    carrierName: 'Select Health',
  })

  logs.push(log(`Agent Intel updated — status: agent_signed`))

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: { docusignStatus: 'agent_signed', agentIntelStatus: 'agent_signed', contractId },
    logs,
  }
}
