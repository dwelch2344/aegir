import type { ResolverMap } from '@moribashi/graphql'
import type BcpService from './bcp/bcp.svc.js'
import type CatalogService from './catalog/catalog.svc.js'
import type ContextService from './context/context.svc.js'

export interface RequestCradle {
  contextService: ContextService
  bcpService: BcpService
  catalogService: CatalogService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    practices: () => ({}),
  },

  // ─── Query namespace containers ─────────────────────────

  Practices: {
    context: () => ({}),
    bcp: () => ({}),
    catalog: () => ({}),
  },
  PracticesContext: {
    files: () => ({}),
    topics: () => ({}),
  },
  PracticesBcp: {
    categories: () => ({}),
  },
  PracticesCatalog: {
    entries: () => ({}),
  },

  // ─── Context queries ───────────────────────────────────

  PracticesContextFiles: {
    async search(this: RequestCradle, _: unknown, args: { input: { organizationId?: number; tier?: string } }) {
      return this.contextService.searchFiles(args.input)
    },
  },
  PracticesContextTopics: {
    async search(this: RequestCradle, _: unknown, args: { input: { organizationId?: number } }) {
      return this.contextService.searchTopics(args.input)
    },
  },

  // ─── Context federation references ─────────────────────

  PracticesContextFile: {
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.contextService.searchFiles({})
      return results.find((f: any) => f.id === ref.id) ?? null
    },
  },
  PracticesContextTopic: {
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.contextService.searchTopics({})
      return results.find((t: any) => t.id === ref.id) ?? null
    },
  },

  // ─── BCP queries ───────────────────────────────────────

  PracticesBcpCategories: {
    async search(this: RequestCradle, _: unknown, args: { input: { organizationId?: number } }) {
      return this.bcpService.searchCategories(args.input)
    },
  },
  PracticesBcpCategory: {
    async entries(this: RequestCradle, parent: { id: string }) {
      const { results } = await this.bcpService.searchEntries({ categoryIdIn: [parent.id] })
      return results
    },
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.bcpService.searchCategories({})
      return results.find((c: any) => c.id === ref.id) ?? null
    },
  },
  PracticesBcpEntry: {
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.bcpService.searchEntries({})
      return results.find((e: any) => e.id === ref.id) ?? null
    },
  },

  // ─── Catalog queries ──────────────────────────────────

  PracticesCatalogEntries: {
    async search(
      this: RequestCradle,
      _: unknown,
      args: { input: { organizationId?: number; idIn?: string[]; patternIdIn?: string[] } },
    ) {
      return this.catalogService.search(args.input)
    },
  },
  PracticesCatalogEntry: {
    parameters(parent: { parameters: Record<string, unknown> }) {
      return JSON.stringify(parent.parameters)
    },
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.catalogService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
  },

  // ─── Mutations ─────────────────────────────────────────

  Mutation: {
    practices: () => ({}),
  },
  PracticesOps: {
    context: () => ({}),
    bcp: () => ({}),
    catalog: () => ({}),
  },

  // ─── Context mutations ─────────────────────────────────

  PracticesContextOps: {
    files: () => ({}),
    topics: () => ({}),
  },
  PracticesContextFilesOps: {
    async upsert(
      this: RequestCradle,
      _: unknown,
      args: {
        input: {
          organizationId: number
          tier: string
          path: string
          description?: string
          content?: string | null
        }
      },
    ) {
      return this.contextService.upsertFile(args.input)
    },
    async updateContent(this: RequestCradle, _: unknown, args: { id: string; input: { content: string } }) {
      return this.contextService.updateFileContent(args.id, args.input.content)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.contextService.deleteFile(args.id)
    },
  },
  PracticesContextTopicsOps: {
    async upsert(this: RequestCradle, _: unknown, args: { input: any }) {
      return this.contextService.upsertTopic(args.input)
    },
    async updateContent(
      this: RequestCradle,
      _: unknown,
      args: { id: string; input: { systemContent?: string; projectContent?: string } },
    ) {
      return this.contextService.updateTopicContent(args.id, args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.contextService.deleteTopic(args.id)
    },
  },

  // ─── BCP mutations ─────────────────────────────────────

  PracticesBcpOps: {
    categories: () => ({}),
    entries: () => ({}),
  },
  PracticesBcpCategoriesOps: {
    async upsert(this: RequestCradle, _: unknown, args: { input: any }) {
      return this.bcpService.upsertCategory(args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.bcpService.deleteCategory(args.id)
    },
  },
  PracticesBcpEntriesOps: {
    async upsert(this: RequestCradle, _: unknown, args: { input: any }) {
      return this.bcpService.upsertEntry(args.input)
    },
    async updateContent(this: RequestCradle, _: unknown, args: { id: string; input: { content: string } }) {
      return this.bcpService.updateEntryContent(args.id, args.input.content)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.bcpService.deleteEntry(args.id)
    },
  },

  // ─── Catalog mutations ─────────────────────────────────

  PracticesCatalogOps: {
    entries: () => ({}),
  },
  PracticesCatalogEntriesOps: {
    async upsert(this: RequestCradle, _: unknown, args: { input: any }) {
      const { parameters, ...rest } = args.input
      return this.catalogService.upsert({
        ...rest,
        parameters: parameters ? JSON.parse(parameters) : {},
      })
    },
    async update(this: RequestCradle, _: unknown, args: { id: string; input: Record<string, unknown> }) {
      return this.catalogService.update(args.id, args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.catalogService.delete(args.id)
    },
  },
}
