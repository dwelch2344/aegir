import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

async function checkedGqlFetch(url: string, body: object, label: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status}`)
  }
  const json = (await res.json()) as any
  if (json.errors?.length) {
    throw new Error(`${label}: ${json.errors[0].message}`)
  }
  return json
}

export async function handleProjectStoreMetadata(task: any): Promise<TaskResult> {
  const { projectId, localPath, manifestRaw, services, patterns } = task.inputData ?? {}
  const wfId = task.workflowInstanceId

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'sync',
    taskName: 'project_store_metadata',
    status: 'RUNNING',
    message: 'Storing project metadata',
  })

  try {
    const gqlUrl = config.projects.graphqlUrl

    // Update project with manifest data and local path
    await checkedGqlFetch(
      gqlUrl,
      {
        query: `mutation($id: ID!, $input: ProjectsProjectUpdateInput!) {
        projects { projects { update(id: $id, input: $input) { id } } }
      }`,
        variables: {
          id: projectId,
          input: {
            localPath,
            manifestRaw,
            status: 'READY',
            lastSyncedAt: new Date().toISOString(),
          },
        },
      },
      'Update project status',
    )

    // Persist services
    if (services?.length) {
      await checkedGqlFetch(
        gqlUrl,
        {
          query: `mutation($projectId: ID!, $services: [ProjectsServiceInput!]!) {
          projects { projects { replaceServices(projectId: $projectId, services: $services) } }
        }`,
          variables: { projectId, services },
        },
        'Replace services',
      )
    }

    // Persist patterns
    if (patterns?.length) {
      await checkedGqlFetch(
        gqlUrl,
        {
          query: `mutation($projectId: ID!, $patterns: [ProjectsPatternInput!]!) {
          projects { projects { replacePatterns(projectId: $projectId, patterns: $patterns) } }
        }`,
          variables: { projectId, patterns },
        },
        'Replace patterns',
      )
    }

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'sync',
      taskName: 'project_store_metadata',
      status: 'COMPLETED',
      message: `Stored ${services?.length ?? 0} services, ${patterns?.length ?? 0} patterns`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: {
        servicesStored: services?.length ?? 0,
        patternsStored: patterns?.length ?? 0,
      },
      logs: [
        {
          log: `Stored metadata for project ${projectId}: ${services?.length ?? 0} services, ${patterns?.length ?? 0} patterns`,
          createdTime: Date.now(),
        },
      ],
    }
  } catch (err: any) {
    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'sync',
      taskName: 'project_store_metadata',
      status: 'FAILED',
      message: err.message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Store metadata failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
