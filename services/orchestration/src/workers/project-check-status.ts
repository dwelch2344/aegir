import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

export async function handleProjectCheckStatus(task: any): Promise<TaskResult> {
  const { projectId, localPath } = task.inputData ?? {}
  const wfId = task.workflowInstanceId

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'check-status',
    taskName: 'project_check_status',
    status: 'RUNNING',
    message: 'Running shipyard status check',
  })

  try {
    // A ship must have a shipyard.manifest for the CLI to work
    if (!existsSync(join(localPath, 'shipyard.manifest'))) {
      const report = {
        projectId,
        issues: ['No shipyard.manifest found — this project has not been onboarded to the Shipyard yet.'],
        servicesOk: 0,
        servicesMissing: 0,
        outdatedPatterns: 0,
      }

      await logProjectActivity({
        projectId,
        workflowId: wfId,
        type: 'check-status',
        taskName: 'project_check_status',
        status: 'COMPLETED',
        message: 'No shipyard.manifest found',
      })

      return {
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.taskId,
        status: 'COMPLETED',
        outputData: report,
        logs: [{ log: 'No shipyard.manifest found — skipping CLI status check', createdTime: Date.now() }],
      }
    }

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

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'check-status',
      taskName: 'project_check_status',
      status: 'COMPLETED',
      message: `${report.issues.length} issues found`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: report,
      logs: [{ log: `Status check complete: ${report.issues.length} issues found`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'check-status',
      taskName: 'project_check_status',
      status: 'FAILED',
      message: err.message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Status check failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
