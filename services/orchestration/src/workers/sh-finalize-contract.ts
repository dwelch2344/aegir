import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { updateContractStatus } from '../integrations/agent-intel.js'
import { sendEmail } from '../integrations/email.js'
import { log, randomDelay } from '../utils.js'

export async function handleShFinalizeContract(task: any): Promise<TaskResult> {
  const { agentEmail, agentFullName, contractId, approvedStates } = task.inputData ?? {}
  const states = Array.isArray(approvedStates) ? approvedStates : [approvedStates]
  const writingNumber = config.selectHealth.writingNumber

  const logs = [log(`Finalizing contract ${contractId} for ${agentFullName}`)]

  try {
    await randomDelay()
    logs.push(log(`Downloading completed DocuSign documents`))
    logs.push(log(`Filing documents to Google Drive: agents/${agentFullName}/Select Health/`))

    await updateContractStatus({
      contractId,
      agentNpn: task.inputData?.agentNpn ?? '',
      status: 'ready_to_sell',
      carrierName: 'Select Health',
      states,
      writingNumber,
      effectiveDate: new Date().toISOString(),
    })

    logs.push(log(`Agent Intel updated — status: ready_to_sell, writing number: ${writingNumber}`))

    await randomDelay()

    await sendEmail({
      to: agentEmail,
      subject: `You're Ready to Sell — Select Health Contract Complete`,
      body: [
        `Dear ${agentFullName},`,
        ``,
        `Great news! Your contracting with Select Health through Health First Insurance is now complete.`,
        ``,
        `Contract Details:`,
        `  Contract ID: ${contractId}`,
        `  Carrier: Select Health`,
        `  Writing Number: ${writingNumber}`,
        `  Approved States: ${states.join(', ')}`,
        `  Status: Ready to Sell`,
        ``,
        `You are now fully appointed and ready to sell Select Health products in the above states.`,
        ``,
        `If you have any questions, please don't hesitate to reach out.`,
        ``,
        `Best regards,`,
        `Health First Contracting`,
      ].join('\n'),
    })

    logs.push(log(`"Ready to Sell" confirmation email sent to ${agentEmail}`))

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: {
        status: 'ready_to_sell',
        completedAt: new Date().toISOString(),
        writingNumber,
        contractId,
      },
      logs,
    }
  } catch (err: any) {
    logs.push(log(`Failed to finalize contract: ${err.message}`))
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs,
    }
  }
}
