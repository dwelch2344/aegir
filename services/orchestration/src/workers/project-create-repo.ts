import { execSync } from 'node:child_process'
import type { TaskResult } from '../conductor.js'
import { logProjectActivity } from './project-activity.js'

export async function handleProjectCreateRepo(task: any): Promise<TaskResult> {
  const { projectId, name, owner, description, visibility } = task.inputData ?? {}
  const wfId = task.workflowInstanceId

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'scaffold',
    taskName: 'project_create_repo',
    status: 'RUNNING',
    message: `Creating GitHub repository ${owner}/${name}`,
  })

  try {
    const vis = visibility === 'private' ? '--private' : '--public'
    const descFlag = description ? `--description "${description.replace(/"/g, '\\"')}"` : ''

    // Create the repo on GitHub
    const repoFullName = `${owner}/${name}`
    execSync(`gh repo create ${repoFullName} ${vis} ${descFlag}`, {
      encoding: 'utf-8',
      timeout: 30_000,
    })

    const repoUrl = `https://github.com/${repoFullName}.git`

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'scaffold',
      taskName: 'project_create_repo',
      status: 'COMPLETED',
      message: `Created repository ${repoFullName}`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { repoUrl, repoFullName },
      logs: [{ log: `Created GitHub repo ${repoFullName}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'scaffold',
      taskName: 'project_create_repo',
      status: 'FAILED',
      message: err.message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Repo creation failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
