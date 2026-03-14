import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleProjectClone(task: any): Promise<TaskResult> {
  const { projectId, repoUrl, branch } = task.inputData ?? {}

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

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { localPath },
      logs: [{ log: `Cloned ${repoUrl} to ${localPath}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Clone failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
