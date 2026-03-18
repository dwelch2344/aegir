/**
 * Ensures a project's workspace directory exists and is ready.
 *
 * Re-clones automatically when the directory is stale (e.g. after a container restart).
 * Used as:
 *  - A Conductor task (`ensure_project_cloned`) prepended to consuming workflows
 *  - A utility function callable inline by `agent-invoke-claude`
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { cloneRepo } from './project-clone.js'

interface ProjectInfo {
  localPath: string | null
  status: string
  repoUrl: string
  branch: string
}

/** Fetch project info from the projects GraphQL service. */
async function fetchProject(projectId: string): Promise<ProjectInfo> {
  const res = await fetch(config.projects.graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($input: ProjectsProjectSearchInput!) {
        projects { projects { search(input: $input) { results { localPath status repoUrl branch } } } }
      }`,
      variables: { input: { idIn: [projectId] } },
    }),
  })
  const json = (await res.json()) as any
  const project = json.data?.projects?.projects?.search?.results?.[0]
  if (!project) throw new Error(`Project ${projectId} not found`)
  return project
}

/**
 * Ensure a project workspace exists on disk and is ready.
 * Re-clones transparently if the directory was wiped (container restart, etc).
 */
export async function ensureProjectWorkspace(projectId: string): Promise<{
  localPath: string
  wasRecloned: boolean
}> {
  const project = await fetchProject(projectId)

  if (project.status === 'PENDING' || project.status === 'CLONING') {
    throw new Error(`Project ${projectId} is not ready (status: ${project.status}). Run sync first.`)
  }

  if (!project.repoUrl) {
    throw new Error(`Project ${projectId} has no repoUrl — run sync first.`)
  }

  // Determine expected path (use stored value or derive from convention)
  const localPath = project.localPath || join(config.projects.workspaceDir, projectId)

  // Check if the directory exists and has a .git folder
  if (existsSync(join(localPath, '.git'))) {
    return { localPath, wasRecloned: false }
  }

  // Directory is missing — re-clone
  await cloneRepo({
    projectId,
    repoUrl: project.repoUrl,
    branch: project.branch ?? 'main',
    localPath,
  })

  return { localPath, wasRecloned: true }
}

/** Conductor task handler for `ensure_project_cloned`. */
export async function handleEnsureProjectCloned(task: any): Promise<TaskResult> {
  const { projectId } = task.inputData ?? {}

  try {
    const { localPath, wasRecloned } = await ensureProjectWorkspace(projectId)

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { localPath, wasRecloned },
      logs: [
        {
          log: wasRecloned
            ? `Re-cloned project ${projectId} to ${localPath} (workspace was stale)`
            : `Project workspace verified at ${localPath}`,
          createdTime: Date.now(),
        },
      ],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Ensure cloned failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
