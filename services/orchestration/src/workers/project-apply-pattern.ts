import { execSync } from 'node:child_process'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleProjectApplyPattern(task: any): Promise<TaskResult> {
  const { projectId, localPath, patternId, params } = task.inputData ?? {}

  try {
    const shipyardBin = config.projects.shipyardBin
    const catalogDir = config.projects.catalogDir

    // Build the apply command with params
    const args = [`node`, shipyardBin, `apply`, patternId, `--ship`, localPath, `--catalog`, catalogDir]
    if (params?.name) args.push(`--name`, params.name)
    if (params?.port) args.push(`--port`, String(params.port))
    if (params?.entity) args.push(`--entity`, params.entity)
    if (params?.fields) args.push(`--fields`, params.fields)

    const output = execSync(args.join(' '), {
      encoding: 'utf-8',
      timeout: 60_000,
      cwd: localPath,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: {
        patternId,
        output: output.trim(),
        localPath,
      },
      logs: [{ log: `Applied pattern "${patternId}" to project ${projectId}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message, stderr: err.stderr?.toString() },
      logs: [{ log: `Apply pattern failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
