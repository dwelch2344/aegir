import type { TaskResult } from '../conductor.js'

export function handleSendWelcomeEmail(task: any): TaskResult {
  const { email, name, accountId } = task.inputData ?? {}

  if (!email || !accountId) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: 'Missing email or accountId' },
    }
  }

  // In a real implementation this would call MailHog via SMTP.
  // For the demo, we simulate a successful send.
  return {
    workflowInstanceId: task.workflowInstanceId,
    taskId: task.taskId,
    status: 'COMPLETED',
    outputData: {
      sent: true,
      to: email,
      subject: `Welcome to aegir, ${name}!`,
      sentAt: new Date().toISOString(),
    },
    logs: [{ log: `Welcome email sent to ${email}`, createdTime: Date.now() }],
  }
}
