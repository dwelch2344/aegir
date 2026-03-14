import cors from '@fastify/cors'
import gateway from '@mercuriusjs/gateway'
import Fastify from 'fastify'
import { config } from './config.js'

export function createApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  app.register(gateway, {
    gateway: {
      services: [
        { name: 'iam', url: config.services.iam },
        { name: 'system', url: config.services.system },
        { name: 'agents', url: config.services.agents },
        { name: 'projects', url: config.services.projects },
      ],
      pollingInterval: 5000,
      retryServicesCount: 10,
      retryServicesInterval: 3000,
    },
    graphiql: true,
  })

  app.get('/health', async () => ({ status: 'ok', service: 'gateway' }))

  return app
}
