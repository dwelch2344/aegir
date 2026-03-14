/** Shared helper for project workers to log activity via the projects GraphQL service. */
import { config } from '../config.js'

export async function logProjectActivity(input: {
  projectId: string
  workflowId: string
  type: string
  taskName: string
  status: string
  message?: string
}) {
  try {
    await fetch(config.projects.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($input: ProjectsActivityLogInput!) {
          projects { projects { logActivity(input: $input) { activityId } } }
        }`,
        variables: { input },
      }),
    })
  } catch (err: any) {
    console.warn(`[activity] failed to log: ${err.message}`)
  }
}
