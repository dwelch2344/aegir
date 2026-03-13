import type { TaskResult } from '../conductor.js'
import { log, randomDelay } from '../utils.js'

const ELIGIBLE_STATES = ['UT', 'ID', 'CO', 'NV']

export async function handleShValidateAgentInfo(task: any): Promise<TaskResult> {
  const {
    agentFirstName,
    agentLastName,
    agentEmail,
    agentPhone,
    agentNpn,
    residentState,
    requestedStates,
    hasC4CoCertification,
    hasCoLicense,
    ignoreValidationErrors,
  } = task.inputData ?? {}

  const logs: { log: string; createdTime: number }[] = []
  logs.push(log(`Starting agent validation for ${agentFirstName} ${agentLastName}`))

  await randomDelay()

  const errors: string[] = []
  const warnings: string[] = []

  if (!agentFirstName || typeof agentFirstName !== 'string' || agentFirstName.trim().length < 1)
    errors.push('First name is required')
  if (!agentLastName || typeof agentLastName !== 'string' || agentLastName.trim().length < 1)
    errors.push('Last name is required')
  if (!agentEmail || typeof agentEmail !== 'string' || !agentEmail.includes('@')) errors.push('Valid email is required')
  if (!agentPhone || typeof agentPhone !== 'string') errors.push('Phone number is required')
  if (!agentNpn || typeof agentNpn !== 'string') errors.push('NPN (National Producer Number) is required')
  if (!residentState || typeof residentState !== 'string') errors.push('Resident state is required')

  logs.push(log(`Checked required fields — ${errors.length} issue(s) found`))

  const states: string[] = Array.isArray(requestedStates) ? requestedStates : []
  if (states.length === 0) {
    errors.push('At least one requested state is required')
  }
  const invalidStates = states.filter((s: string) => !ELIGIBLE_STATES.includes(s))
  if (invalidStates.length > 0) {
    errors.push(`Invalid states: ${invalidStates.join(', ')}. Must be one of: ${ELIGIBLE_STATES.join(', ')}`)
  }

  if (errors.length === 0) {
    const isResident = ELIGIBLE_STATES.includes(residentState)
    if (!isResident) {
      const wantsCo = states.includes('CO')
      const onlyCo = states.length === 1 && wantsCo
      if (wantsCo && hasC4CoCertification && hasCoLicense && onlyCo) {
        logs.push(log(`Non-resident CO exception approved (C4 cert + CO license)`))
      } else if (wantsCo && hasC4CoCertification && hasCoLicense) {
        errors.push('Non-resident agents with CO exception can only appoint for CO, not other states')
      } else {
        errors.push(
          `Agent must be a resident of UT, ID, CO, or NV to appoint with Select Health. Resident state "${residentState}" is not eligible.`,
        )
      }
    } else {
      logs.push(log(`Resident state ${residentState} is eligible`))
    }
  }

  if (errors.length > 0 && ignoreValidationErrors) {
    warnings.push(...errors)
    errors.length = 0
  }

  if (errors.length > 0) {
    logs.push(log(`Validation failed: ${errors.join('; ')}`))
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { errors },
      logs,
    }
  }

  const isResident = ELIGIBLE_STATES.includes(residentState)
  const approvedStates = isResident ? states : states.length > 0 ? states : ['CO']
  const contractId = `sh-aca-${Date.now()}`
  const agentFullName = `${agentFirstName.trim()} ${agentLastName.trim()}`

  if (warnings.length > 0) {
    logs.push(log(`Validation warnings (ignored): ${warnings.join('; ')}`))
  }
  logs.push(log(`Agent "${agentFullName}" validated for states: ${approvedStates.join(', ')}`))
  logs.push(log(`Contract ID generated: ${contractId}`))

  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: {
      contractId,
      agentFullName,
      approvedStates,
      validatedAt: new Date().toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    },
    logs,
  }
}
