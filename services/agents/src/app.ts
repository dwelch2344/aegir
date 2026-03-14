import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEnv } from '@aegir/common'
import federation from '@mercuriusjs/federation'
import { createApp } from '@moribashi/core'
import type { ResolverMap } from '@moribashi/graphql'
import { pgPlugin } from '@moribashi/pg'
import { webPlugin } from '@moribashi/web'
import type { FastifyInstance } from 'fastify'
import { resolvers } from './resolvers.js'
import { typeDefs } from './schema.js'
import { startKafkaBridge, setPubSub, setWorkflowIdUpdater } from './kafka-bridge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function bindResolversToScope(map: ResolverMap<any>) {
  const bound: Record<string, Record<string, Function>> = {}
  for (const [type, fields] of Object.entries(map)) {
    bound[type] = {}
    for (const [field, fn] of Object.entries(fields)) {
      if (typeof fn === 'function') {
        bound[type][field] = (parent: any, args: any, ctx: any, info: any) => {
          const scope = ctx.scope
          const target = scope?.cradle ?? scope?.container?.cradle ?? {}
          return (fn as Function).call(target, parent, args, ctx, info)
        }
      } else {
        bound[type][field] = fn
      }
    }
  }
  return bound
}

export async function buildApp() {
  const app = createApp()

  app.use(
    webPlugin({
      port: Number(getEnv('AGENTS_PORT', '4003')),
      host: getEnv('AGENTS_HOST', '0.0.0.0'),
    }),
  )

  app.use(
    pgPlugin({
      host: getEnv('PG_HOST', 'postgres'),
      port: Number(getEnv('PG_PORT', '5432')),
      user: getEnv('PG_USER', 'aegir'),
      password: getEnv('PG_PASSWORD', 'aegir_dev'),
      database: getEnv('PG_DATABASE', 'aegir'),
      searchPath: [getEnv('PG_SCHEMA', 'agents')],
      migrationsDir: join(__dirname, '..', 'data', 'migrations'),
    }),
  )

  await app.scan(['**/*.svc.ts'], { cwd: __dirname })

  const fastify = app.resolve<FastifyInstance>('fastify')

  fastify.register(federation as any, {
    schema: typeDefs,
    resolvers: bindResolversToScope(resolvers),
    graphiql: true,
    subscription: true,
    context: async (request: any) => ({ scope: request.scope }),
  })

  fastify.get('/health', async () => ({ status: 'ok', service: 'agents' }))

  // Start Kafka bridge: consumes chat events and bridges to WebSocket pubsub.
  // We register the pubsub after Mercurius is ready so subscriptions work.
  fastify.addHook('onReady', async () => {
    const pubsub = (fastify as any).graphql?.pubsub
    if (pubsub) {
      setPubSub((msg) => pubsub.publish(msg))
    }

    // Register the workflowId updater so the Kafka bridge can update
    // conversations when workflow.started events arrive from orchestration.
    setWorkflowIdUpdater(async (conversationId, workflowId) => {
      try {
        const db = app.resolve<any>('db')
        await db.query(`UPDATE conversation SET workflow_id = :workflowId, updated_at = now() WHERE id = :id`, {
          id: conversationId,
          workflowId,
        })
      } catch (err: any) {
        console.error(`[kafka-bridge] failed to update workflowId: ${err.message}`)
      }
    })

    const ac = new AbortController()
    fastify.addHook('onClose', () => ac.abort())
    startKafkaBridge(ac.signal).catch((err) => {
      console.error(`[agents] kafka bridge failed to start: ${err.message}`)
    })
  })

  return { app, fastify }
}
