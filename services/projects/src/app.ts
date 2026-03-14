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
      port: Number(getEnv('PROJECTS_PORT', '4004')),
      host: getEnv('PROJECTS_HOST', '0.0.0.0'),
    }),
  )

  app.use(
    pgPlugin({
      host: getEnv('PG_HOST', 'postgres'),
      port: Number(getEnv('PG_PORT', '5432')),
      user: getEnv('PG_USER', 'aegir'),
      password: getEnv('PG_PASSWORD', 'aegir_dev'),
      database: getEnv('PG_DATABASE', 'aegir'),
      searchPath: [getEnv('PG_SCHEMA', 'projects')],
      migrationsDir: join(__dirname, '..', 'data', 'migrations'),
    }),
  )

  await app.scan(['**/*.svc.ts'], { cwd: __dirname })

  const fastify = app.resolve<FastifyInstance>('fastify')

  fastify.register(federation as any, {
    schema: typeDefs,
    resolvers: bindResolversToScope(resolvers),
    graphiql: true,
    context: async (request: any) => ({ scope: request.scope }),
  })

  fastify.get('/health', async () => ({ status: 'ok', service: 'projects' }))

  return { app, fastify }
}
