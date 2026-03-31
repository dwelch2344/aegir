import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

export async function handleProjectResetStatus(task: any): Promise<TaskResult> {
  const { projectId, failedWorkflowId, reason } = task.inputData ?? {}

  try {
    const res = await fetch(config.projects.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($id: ID!, $input: ProjectsProjectUpdateInput!) {
          projects { projects { update(id: $id, input: $input) { id } } }
        }`,
        variables: {
          id: projectId,
          input: { status: 'PENDING' },
        },
      }),
    })
    const json = (await res.json()) as any
    if (json.errors?.length) {
      throw new Error(json.errors[0].message)
    }

    await logProjectActivity({
      projectId,
      workflowId: failedWorkflowId ?? task.workflowInstanceId,
      type: 'sync',
      taskName: 'project_reset_status',
      status: 'FAILED',
      message: `Sync failed, reset status to PENDING: ${reason ?? 'unknown'}`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { reset: true },
      logs: [{ log: `Reset project ${projectId} status to PENDING`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Reset status failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
