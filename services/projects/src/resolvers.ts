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
    async sync(this: RequestCradle, _: unknown, args: { id: string }) {
      const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:4010'
      await this.projectsService.update(args.id, { status: 'CLONING' })
      const res = await fetch(`${orchestrationUrl}/projects/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: args.id }),
      })
      const data = (await res.json()) as { workflowId: string }
      return { projectId: args.id, workflowId: data.workflowId }
    },
    async replaceServices(
      this: RequestCradle,
      _: unknown,
      args: { projectId: string; services: { name: string; type: string; port: number }[] },
    ) {
      await this.projectsService.replaceServices(args.projectId, args.services)
      return true
    },
    async replacePatterns(
      this: RequestCradle,
      _: unknown,
      args: { projectId: string; patterns: { patternId: string; version: string; appliedAt?: string }[] },
    ) {
      await this.projectsService.replacePatterns(args.projectId, args.patterns)
      return true
    },
    async saveStatusReport(
      this: RequestCradle,
      _: unknown,
      args: {
        input: {
          projectId: string
          issues: string[]
          servicesOk: number
          servicesMissing: number
          outdatedPatterns: number
        }
      },
    ) {
      return this.projectsService.saveStatusReport(args.input)
    },
    async checkStatus(this: RequestCradle, _: unknown, args: { id: string }) {
      const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:4010'
      const res = await fetch(`${orchestrationUrl}/projects/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: args.id }),
      })
      const data = (await res.json()) as { workflowId: string }
      return { projectId: args.id, workflowId: data.workflowId }
    },
    async applyPattern(this: RequestCradle, _: unknown, args: { id: string; patternId: string; params?: string }) {
      const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:4010'
      const res = await fetch(`${orchestrationUrl}/projects/apply-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: args.id,
          patternId: args.patternId,
          params: args.params ? JSON.parse(args.params) : {},
        }),
      })
      const data = (await res.json()) as { workflowId: string }
      return { projectId: args.id, workflowId: data.workflowId }
    },
  },
}
