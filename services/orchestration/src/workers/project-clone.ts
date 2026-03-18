import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

interface CloneOpts {
  projectId: string
  repoUrl: string
  repoFullName?: string
  branch: string
  localPath?: string
}

/**
 * Clone or pull a project repository to a local workspace directory.
 * Shared by the `project_clone` task handler and `ensureProjectWorkspace()`.
 */
export async function cloneRepo(opts: CloneOpts): Promise<string> {
  const { projectId, repoUrl, repoFullName, branch } = opts
  const workspaceDir = config.projects.workspaceDir
  mkdirSync(workspaceDir, { recursive: true })

  const localPath = opts.localPath ?? join(workspaceDir, projectId)

  if (existsSync(localPath)) {
    // Pull latest
    execSync(`git -C ${localPath} fetch origin && git -C ${localPath} reset --hard origin/${branch ?? 'main'}`, {
      timeout: 60_000,
    })
  } else {
    // Fresh clone — use gh for auth when we have a full name, fall back to repoUrl
    const cloneTarget = repoFullName || repoUrl

    // Check if repo is empty before cloning (--depth 1 fails on empty repos)
    let isEmpty = false
    try {
      const info = execSync(`gh repo view ${cloneTarget} --json isEmpty`, {
        encoding: 'utf-8',
        timeout: 15_000,
      })
      isEmpty = JSON.parse(info).isEmpty === true
    } catch {
      // If we can't check, assume non-empty and let clone handle errors
    }

    if (isEmpty) {
      // Empty repo: init locally and add remote (use SSH for auth)
      mkdirSync(localPath, { recursive: true })
      execSync(`git init ${localPath}`, { timeout: 10_000 })
      const remoteUrl = repoFullName ? `git@github.com:${repoFullName}.git` : repoUrl
      execSync(`git -C ${localPath} remote add origin ${remoteUrl}`, { timeout: 10_000 })
    } else {
      const branchArg = branch ? `-- --branch ${branch} --depth 1` : '-- --depth 1'
      execSync(`gh repo clone ${cloneTarget} ${localPath} ${branchArg}`, {
        timeout: 120_000,
      })
    }
  }

  return localPath
}

export async function handleProjectClone(task: any): Promise<TaskResult> {
  const { projectId, repoUrl, repoFullName, branch } = task.inputData ?? {}
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
    const localPath = await cloneRepo({ projectId, repoUrl, repoFullName, branch })

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
