import { execSync } from 'node:child_process'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleProjectCheckStatus(task: any): Promise<TaskResult> {
  const { projectId, localPath } = task.inputData ?? {}

  try {
    // Run shipyard status on the project
    const shipyardBin = config.projects.shipyardBin
    const catalogDir = config.projects.catalogDir
    const output = execSync(`node ${shipyardBin} status --ship ${localPath} --catalog ${catalogDir} --json`, {
      encoding: 'utf-8',
      timeout: 30_000,
    })

    const result = JSON.parse(output)

    // Save status report to projects service
    const gqlUrl = config.projects.graphqlUrl
    const report = {
      projectId,
      issues: result.issues ?? [],
      servicesOk: result.services?.filter((s: any) => s.status === 'ok').length ?? 0,
      servicesMissing: result.services?.filter((s: any) => s.status !== 'ok').length ?? 0,
      outdatedPatterns: result.patterns?.filter((p: any) => p.status === 'outdated').length ?? 0,
    }

    await fetch(gqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($input: ProjectsStatusReportInput!) {
          projects { projects { saveStatusReport(input: $input) { id } } }
        }`,
        variables: { input: report },
      }),
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: report,
      logs: [{ log: `Status check complete: ${report.issues.length} issues found`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Status check failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
