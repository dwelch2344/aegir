import type { ResolverMap } from '@moribashi/graphql'
import mercurius from 'mercurius'
import type IdentitiesService from './identities/identities.svc.js'
import type MembershipsService from './memberships/memberships.svc.js'
import type OrgRelationshipsService from './org-relationships/org-relationships.svc.js'
import type OrganizationsService from './organizations/organizations.svc.js'
import type RolesService from './roles/roles.svc.js'

const { withFilter } = mercurius

export interface RequestCradle {
  identitiesService: IdentitiesService
  organizationsService: OrganizationsService
  rolesService: RolesService
  membershipsService: MembershipsService
  orgRelationshipsService: OrgRelationshipsService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    iam: () => ({}),
  },
  Iam: {
    identities: () => ({}),
    orgs: () => ({}),
    roles: () => ({}),
    memberships: () => ({}),
    orgRelationships: () => ({}),
  },
  IamIdentities: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.identitiesService.search(args.input as Parameters<IdentitiesService['search']>[0])
    },
  },
  IamOrganizations: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.organizationsService.search(args.input as Parameters<OrganizationsService['search']>[0])
    },
  },
  IamRoles: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.rolesService.search(args.input as Parameters<RolesService['search']>[0])
    },
  },
  IamMemberships: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.membershipsService.search(args.input as Parameters<MembershipsService['search']>[0])
    },
  },
  IamOrgRelationships: {
    async search(this: RequestCradle, _: unknown, args: { input: unknown }) {
      return this.orgRelationshipsService.search(args.input as Parameters<OrgRelationshipsService['search']>[0])
    },
  },
  Mutation: {
    iam: () => ({}),
  },
  IamOps: {
    identities: () => ({}),
    orgs: () => ({}),
    roles: () => ({}),
    memberships: () => ({}),
    orgRelationships: () => ({}),
  },
  IamIdentitiesOps: {
    _placeholder: () => null,
  },
  IamOrganizationsOps: {
    async sync(this: RequestCradle, _: unknown, args: { input: { keycloakId: string; key: string; name: string }[] }) {
      return this.organizationsService.sync(args.input)
    },
  },
  IamRolesOps: {
    async create(this: RequestCradle, _: unknown, args: { input: { key: string; name: string } }) {
      return this.rolesService.create(args.input)
    },
    async addPermission(
      this: RequestCradle,
      _: unknown,
      args: { input: { roleId: number; permission: string; relationshipType: string } },
    ) {
      return this.rolesService.addPermission(args.input)
    },
    async removePermission(
      this: RequestCradle,
      _: unknown,
      args: { input: { roleId: number; permission: string; relationshipType: string } },
    ) {
      return this.rolesService.removePermission(args.input)
    },
  },
  IamMembershipsOps: {
    async create(
      this: RequestCradle,
      _: unknown,
      args: { input: { identityId: number; organizationId: number; roleIds?: number[] } },
    ) {
      return this.membershipsService.create(args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { membershipId: number }) {
      return this.membershipsService.delete(args.membershipId)
    },
    async assignRole(this: RequestCradle, _: unknown, args: { input: { membershipId: number; roleId: number } }) {
      return this.membershipsService.assignRole(args.input.membershipId, args.input.roleId)
    },
    async removeRole(this: RequestCradle, _: unknown, args: { input: { membershipId: number; roleId: number } }) {
      return this.membershipsService.removeRole(args.input.membershipId, args.input.roleId)
    },
  },
  IamOrgRelationshipsOps: {
    async create(
      this: RequestCradle,
      _: unknown,
      args: { input: { ownerOrgId: number; relatedOrgId: number; relationshipType: string } },
    ) {
      return this.orgRelationshipsService.create(args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: number }) {
      return this.orgRelationshipsService.delete(args.id)
    },
  },
  // --- Entity resolvers ---
  Identity: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.identitiesService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
    async memberships(this: RequestCradle, parent: { id: number }) {
      const { results } = await this.membershipsService.search({ identityIdIn: [parent.id] })
      return results
    },
  },
  Organization: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.organizationsService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
    async memberships(this: RequestCradle, parent: { id: number }) {
      const { results } = await this.membershipsService.search({ organizationIdIn: [parent.id] })
      return results
    },
    async relationships(this: RequestCradle, parent: { id: number }) {
      const { results } = await this.orgRelationshipsService.search({
        ownerOrgIdIn: [parent.id],
      })
      return results
    },
  },
  Role: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.rolesService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
    async permissions(this: RequestCradle, parent: { id: number }) {
      return this.rolesService.getPermissions(parent.id)
    },
  },
  Membership: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.membershipsService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
    async identity(this: RequestCradle, parent: { identityId: number }) {
      const { results } = await this.identitiesService.search({ idIn: [parent.identityId] })
      return results[0] ?? null
    },
    async organization(this: RequestCradle, parent: { organizationId: number }) {
      const { results } = await this.organizationsService.search({ idIn: [parent.organizationId] })
      return results[0] ?? null
    },
    async roles(this: RequestCradle, parent: { id: number }) {
      return this.membershipsService.getRoles(parent.id)
    },
  },
  OrgRelationship: {
    async ownerOrg(this: RequestCradle, parent: { ownerOrgId: number }) {
      const { results } = await this.organizationsService.search({ idIn: [parent.ownerOrgId] })
      return results[0] ?? null
    },
    async relatedOrg(this: RequestCradle, parent: { relatedOrgId: number }) {
      const { results } = await this.organizationsService.search({ idIn: [parent.relatedOrgId] })
      return results[0] ?? null
    },
  },
  Subscription: {
    iamEcho: {
      subscribe: async (_root: unknown, args: { message: string }, { pubsub }: any) => {
        const topic = `IAM_ECHO_${Date.now()}_${Math.random().toString(36).slice(2)}`
        setTimeout(() => {
          pubsub.publish({
            topic,
            payload: {
              iamEcho: {
                message: args.message,
                echoedAt: new Date().toISOString(),
              },
            },
          })
        }, 0)
        return pubsub.subscribe(topic)
      },
    },
    iamNotifications: {
      subscribe: withFilter(
        (_root: unknown, _args: unknown, { pubsub }: any) => pubsub.subscribe('IAM_NOTIFICATIONS'),
        (payload: any, args: { topic?: string }) => {
          if (!args.topic) return true
          return payload.iamNotifications.topic === args.topic
        },
      ),
    },
  },
}
