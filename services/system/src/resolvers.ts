import type { ResolverMap } from '@moribashi/graphql'
import type IntegrationsService from './integrations/integrations.svc.js'
import type TenantIntegrationsService from './tenant-integrations/tenant-integrations.svc.js'
import type TenantsService from './tenants/tenants.svc.js'

export interface RequestCradle {
  tenantsService: TenantsService
  integrationsService: IntegrationsService
  tenantIntegrationsService: TenantIntegrationsService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    async tenant(this: RequestCradle, _: unknown, args: { key: string }) {
      return this.tenantsService.getByKey(args.key)
    },
    system: () => ({}),
  },
  System: {
    metadata: () => null,
    integrations: () => ({}),
  },
  SystemIntegrations: {
    async search(this: RequestCradle, _: unknown, args: { input: { idIn?: number[]; keyIn?: string[] } }) {
      return this.integrationsService.search(args.input)
    },
  },
  Tenant: {
    async integrations(this: RequestCradle, parent: { id: number }) {
      return this.tenantIntegrationsService.listByTenantId(parent.id)
    },
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      return this.tenantsService.getById(Number(ref.id))
    },
  },
  TenantIntegration: {
    async integration(this: RequestCradle, parent: { integrationId: number }) {
      return this.integrationsService.getById(parent.integrationId)
    },
  },
  Mutation: {
    async tenant(this: RequestCradle, _: unknown, args: { key: string }) {
      return this.tenantsService.getByKey(args.key)
    },
    system: () => ({}),
  },
  SystemOps: {
    async createTenant(this: RequestCradle, _: unknown, args: { input: { key: string; name: string } }) {
      return this.tenantsService.create(args.input)
    },
    async updateTenant(this: RequestCradle, _: unknown, args: { key: string; input: { name?: string } }) {
      return this.tenantsService.update(args.key, args.input)
    },
    async upsertIntegration(
      this: RequestCradle,
      _: unknown,
      args: { input: { key: string; name: string; metadata?: string } },
    ) {
      return this.integrationsService.upsert(args.input)
    },
  },
  TenantOps: {
    integrations: () => ({}),
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      return this.tenantsService.getById(Number(ref.id))
    },
  },
  TenantIntegrationOps: {
    async upsert(
      this: RequestCradle,
      parent: { id: number },
      args: { input: { integrationKey: string; status?: string; name?: string; metadata?: string; ordinal?: number } },
    ) {
      return this.tenantIntegrationsService.upsert(parent.id, args.input)
    },
  },
  SystemIntegration: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      return this.integrationsService.getById(ref.id)
    },
  },
}
