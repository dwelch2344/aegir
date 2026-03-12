import type { TaskResult } from '../conductor.js'

export function handleProvisionAccount(task: any): TaskResult {
  const { email, name, identityId } = task.inputData ?? {}

  if (!identityId) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: 'Missing identityId from validation step' },
    }
  }

  const accountId = `acct-${Date.now()}`
  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: {
      accountId,
      identityId,
      email,
      name,
      provisionedAt: new Date().toISOString(),
    },
    logs: [{ log: `Account ${accountId} provisioned for identity ${identityId}`, createdTime: Date.now() }],
  }
}
