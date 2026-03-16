import type { ResolverMap } from '@moribashi/graphql'
import mercurius from 'mercurius'
import type ConversationsService from './conversations/conversations.svc.js'
import { sendChatStartCommand } from './kafka-bridge.js'

const { withFilter } = mercurius

export interface RequestCradle {
  conversationsService: ConversationsService
}

export const resolvers: ResolverMap<RequestCradle> = {
  Query: {
    agents: () => ({}),
  },
  Agents: {
    conversations: () => ({}),
  },
  AgentsConversations: {
    async search(this: RequestCradle, _: unknown, args: { input: { idIn?: string[]; organizationId?: number; projectId?: string } }) {
      return this.conversationsService.search(args.input)
    },
  },
  AgentsConversation: {
    async messages(this: RequestCradle, parent: { id: string }) {
      const { results } = await this.conversationsService.messages(parent.id)
      return results
    },
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      const { results } = await this.conversationsService.search({ idIn: [ref.id] })
      return results[0] ?? null
    },
  },
  AgentsMessage: {
    async __resolveReference(this: RequestCradle, ref: { id: string }) {
      return ref
    },
  },
  Mutation: {
    agents: () => ({}),
  },
  AgentsOps: {
    conversations: () => ({}),
  },
  AgentsConversationsOps: {
    async create(this: RequestCradle, _: unknown, args: { input: { organizationId: number; projectId?: string; title?: string } }) {
      return this.conversationsService.create(args.input)
    },
    async update(
      this: RequestCradle,
      _: unknown,
      args: { id: string; input: { title?: string; workflowId?: string } },
    ) {
      return this.conversationsService.update(args.id, args.input)
    },
    async delete(this: RequestCradle, _: unknown, args: { id: string }) {
      return this.conversationsService.delete(args.id)
    },
    async addMessage(
      this: RequestCradle,
      _: unknown,
      args: { input: { conversationId: string; role: string; text: string } },
      ctx: any,
    ) {
      const message = await this.conversationsService.addMessage(args.input)
      // Publish to subscription so connected clients get real-time updates
      ctx.pubsub?.publish({
        topic: 'AGENTS_MESSAGE_ADDED',
        payload: { agentsMessageAdded: message },
      })
      return message
    },
    async streamChunk(
      this: RequestCradle,
      _: unknown,
      args: { input: { conversationId: string; text: string } },
      ctx: any,
    ) {
      // Publish a synthetic message to the subscription without persisting.
      // The UI will replace the "thinking" placeholder with the partial content.
      ctx.pubsub?.publish({
        topic: 'AGENTS_MESSAGE_ADDED',
        payload: {
          agentsMessageAdded: {
            id: `stream-${Date.now()}`,
            conversationId: args.input.conversationId,
            role: 'assistant',
            text: args.input.text,
            createdAt: new Date().toISOString(),
          },
        },
      })
      return true
    },
    async sendMessage(
      this: RequestCradle,
      _: unknown,
      args: { input: { conversationId: string; text: string; projectId?: string } },
      _ctx: any,
    ) {
      const { conversationId, text, projectId } = args.input

      // Save user message
      const userMessage = await this.conversationsService.addMessage({ conversationId, role: 'user', text })

      // Auto-title from first user message
      const { results: msgs } = await this.conversationsService.messages(conversationId)
      if (msgs.filter((m: any) => m.role === 'user').length === 1) {
        const title = text.length > 40 ? text.slice(0, 40) + '...' : text
        await this.conversationsService.update(conversationId, { title })
      }

      // Resolve projectId — use provided value, or fall back to conversation's projectId
      let effectiveProjectId = projectId ?? null
      if (!effectiveProjectId) {
        const { results: [convo] } = await this.conversationsService.search({ idIn: [conversationId] })
        effectiveProjectId = convo?.projectId ?? null
      }

      // Fire a short-lived workflow for this message via Kafka
      await sendChatStartCommand(conversationId, effectiveProjectId, text)

      return { userMessage, workflowId: null }
    },
  },
  Subscription: {
    agentsMessageAdded: {
      subscribe: withFilter(
        (_root: unknown, _args: unknown, { pubsub }: any) => pubsub.subscribe('AGENTS_MESSAGE_ADDED'),
        (payload: any, args: { conversationId: string }) => {
          return payload.agentsMessageAdded.conversationId === args.conversationId
        },
      ),
    },
  },
}
