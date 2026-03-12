import type { ResolverMap } from '@moribashi/graphql'
import mercurius from 'mercurius'
import type IdentitiesService from './identities/identities.svc.js'
import type OrganizationsService from './organizations/organizations.svc.js'

const { withFilter } = mercurius

export interface RequestCradle {
  identitiesService: IdentitiesService
  organizationsService: OrganizationsService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    iam: () => ({}),
  },
  Iam: {
    identities: () => ({}),
    orgs: () => ({}),
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
  Mutation: {
    iam: () => ({}),
  },
  IamOps: {
    identities: () => ({}),
    orgs: () => ({}),
  },
  IamIdentitiesOps: {
    _placeholder: () => null,
  },
  IamOrganizationsOps: {
    async sync(this: RequestCradle, _: unknown, args: { input: { keycloakId: string; key: string; name: string }[] }) {
      return this.organizationsService.sync(args.input)
    },
  },
  Identity: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.identitiesService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
  },
  Organization: {
    async __resolveReference(this: RequestCradle, ref: { id: number }) {
      const { results } = await this.organizationsService.search({ idIn: [ref.id] })
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
        (_root: unknown, _args: unknown, { pubsub }: any) =>
          pubsub.subscribe('IAM_NOTIFICATIONS'),
        (payload: any, args: { topic?: string }) => {
          if (!args.topic) return true
          return payload.iamNotifications.topic === args.topic
        },
      ),
    },
  },
}
