import type { TaskResult } from '../conductor.js'

export function handleValidateIdentity(task: any): TaskResult {
  const { email, name } = task.inputData ?? {}
  const errors: string[] = []

  if (!email || typeof email !== 'string' || !email.includes('@')) errors.push('Invalid or missing email')
  if (!name || typeof name !== 'string' || name.trim().length < 2) errors.push('Name must be at least 2 characters')

  if (errors.length > 0) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { errors },
      logs: [{ log: `Validation failed: ${errors.join(', ')}`, createdTime: Date.now() }],
    }
  }

  const identityId = `id-${Date.now()}`
  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: { identityId, email, name, validatedAt: new Date().toISOString() },
    logs: [{ log: `Identity validated for ${email}`, createdTime: Date.now() }],
  }
}
