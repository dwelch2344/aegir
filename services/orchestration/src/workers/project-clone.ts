import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

export async function handleProjectClone(task: any): Promise<TaskResult> {
  const { projectId, repoUrl, branch } = task.inputData ?? {}
  const wfId = task.workflowInstanceId

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'sync',
    taskName: 'project_clone',
    status: 'RUNNING',
    message: `Cloning ${repoUrl} (branch: ${branch ?? 'main'})`,
  })

  try {
    const workspaceDir = config.projects.workspaceDir
    mkdirSync(workspaceDir, { recursive: true })

    const localPath = join(workspaceDir, projectId)

    if (existsSync(localPath)) {
      // Pull latest
      execSync(`git -C ${localPath} fetch origin && git -C ${localPath} reset --hard origin/${branch ?? 'main'}`, {
        timeout: 60_000,
      })
    } else {
      // Fresh clone
      execSync(`git clone --branch ${branch ?? 'main'} --depth 1 ${repoUrl} ${localPath}`, {
        timeout: 120_000,
      })
    }

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'sync',
      taskName: 'project_clone',
      status: 'COMPLETED',
      message: `Cloned to ${localPath}`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { localPath },
      logs: [{ log: `Cloned ${repoUrl} to ${localPath}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'sync',
      taskName: 'project_clone',
      status: 'FAILED',
      message: err.message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Clone failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
