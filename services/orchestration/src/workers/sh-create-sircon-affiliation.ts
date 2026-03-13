import type { TaskResult } from '../conductor.js'
import { log, randomDelay } from '../utils.js'

export async function handleShCreateSirconAffiliation(task: any): Promise<TaskResult> {
  const { agentNpn, agentLastName, contractId } = task.inputData ?? {}

  const logs = [log(`Starting Sircon affiliation for NPN ${agentNpn} (${agentLastName})`)]

  await randomDelay()
  logs.push(log(`Connecting to Sircon — Maintain Firm Association`))

  await randomDelay()
  logs.push(log(`Creating DOI affiliation with Health First (EIN 464344936) in state UT`))

  const affiliationId = `sircon-${Date.now()}`
  logs.push(log(`Sircon affiliation ${affiliationId} created for NPN ${agentNpn}`))

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: { affiliationId, contractId, status: 'created' },
    logs,
  }
}
