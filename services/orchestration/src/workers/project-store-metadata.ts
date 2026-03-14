import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

export async function handleProjectStoreMetadata(task: any): Promise<TaskResult> {
  const { projectId, localPath, manifestRaw, services, patterns } = task.inputData ?? {}

  try {
    const gqlUrl = config.projects.graphqlUrl

    // Update project with manifest data and local path
    await fetch(gqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    })

    // Persist services
    if (services?.length) {
      await fetch(gqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($projectId: ID!, $services: [ProjectsServiceInput!]!) {
            projects { projects { replaceServices(projectId: $projectId, services: $services) } }
          }`,
          variables: { projectId, services },
        }),
      })
    }

    // Persist patterns
    if (patterns?.length) {
      await fetch(gqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($projectId: ID!, $patterns: [ProjectsPatternInput!]!) {
            projects { projects { replacePatterns(projectId: $projectId, patterns: $patterns) } }
          }`,
          variables: { projectId, patterns },
        }),
      })
    }

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
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Store metadata failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
