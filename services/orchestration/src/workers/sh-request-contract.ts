import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { updateContractStatus } from '../integrations/agent-intel.js'
import { sendEmail } from '../integrations/email.js'
import { log, randomDelay } from '../utils.js'

export async function handleShRequestContract(task: any): Promise<TaskResult> {
  const { agentFirstName, agentLastName, agentEmail, agentPhone, approvedStates, contractId } = task.inputData ?? {}
  const states = Array.isArray(approvedStates) ? approvedStates : [approvedStates]

  const logs = [log(`Preparing contract request for ${agentFirstName} ${agentLastName}`)]

  try {
    await randomDelay()
    logs.push(log(`Composing email to carrier contact: ${config.selectHealth.carrierContact}`))

    const { messageId } = await sendEmail({
      to: config.selectHealth.carrierContact,
      subject: `New Agent Contracting - 1`,
      body: [
        `Hi Amy,`,
        ``,
        `Can we please have contracting paperwork sent to the following broker for appointment under Health First?`,
        ``,
        `Broker Name: ${agentFirstName} ${agentLastName}`,
        `Broker E-mail: ${agentEmail}`,
        `Broker Phone #: ${agentPhone}`,
        `Broker Licensed State: ${states.join(', ')}`,
        ``,
        `Thank You!`,
        `Health First Contracting`,
      ].join('\n'),
    })

    logs.push(log(`Contract request email sent (messageId: ${messageId})`))

    await updateContractStatus({
      contractId,
      agentNpn: task.inputData?.agentNpn ?? '',
      status: 'contract_requested',
      carrierName: 'Select Health',
      states,
    })

    logs.push(log(`Agent Intel updated — status: contract_requested`))

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { emailSent: true, messageId, agentIntelStatus: 'contract_requested', contractId },
      logs,
    }
  } catch (err: any) {
    logs.push(log(`Failed to send contract request: ${err.message}`))
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs,
    }
  }
}
