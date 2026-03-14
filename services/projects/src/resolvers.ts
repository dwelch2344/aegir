import type { ResolverMap } from '@moribashi/graphql'
import type ProjectsService from './projects/projects.svc.js'

export interface RequestCradle {
  projectsService: ProjectsService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    projects: () => ({}),
  },
  Projects: {
    projects: () => ({}),
  },
  ProjectsProjects: {
    async search(this: RequestCradle, _: unknown, args: { input: { idIn?: string[]; organizationId?: number } }) {
      return this.projectsService.search(args.input)
    },
  },
  ProjectsProject: {
    async services(this: RequestCradle, parent: { id: string }) {
      return this.projectsService.services(parent.id)
    },
    async patterns(this: RequestCradle, parent: { id: string }) {
      return this.projectsService.patterns(parent.id)
    },
    async statusReport(this: RequestCradle, parent: { id: string }) {
      return this.projectsService.latestStatusReport(parent.id)
    },
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.projectsService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
  },
  Mutation: {
    projects: () => ({}),
  },
  ProjectsOps: {
    projects: () => ({}),
  },
  ProjectsProjectsOps: {
    async create(
      this: RequestCradle,
      _: unknown,
      args: { input: { organizationId: number; name: string; repoUrl: string; branch?: string } },
    ) {
      return this.projectsService.create(args.input)
    },
    async update(this: RequestCradle, _: unknown, args: { id: string; input: Record<string, unknown> }) {
      return this.projectsService.update(args.id, args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.projectsService.delete(args.id)
    },
    async sync(this: RequestCradle, _: unknown, args: { id: string }, ctx: any) {
      const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:4010'

      // Update status to CLONING
      await this.projectsService.update(args.id, { status: 'CLONING' })

      // Trigger the project_sync workflow via orchestration
      const res = await fetch(`${orchestrationUrl}/projects/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: args.id }),
      })
      const data = (await res.json()) as { workflowId: string }

      return { projectId: args.id, workflowId: data.workflowId }
    },
  },
}
