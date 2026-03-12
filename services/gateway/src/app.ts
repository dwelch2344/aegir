import Fastify from 'fastify'
import cors from '@fastify/cors'
import gateway from '@mercuriusjs/gateway'
import { config } from './config.js'

export function createApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  app.register(gateway, {
    gateway: {
      services: [
        { name: 'iam', url: config.services.iam },
        { name: 'agents', url: config.services.agents },
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
