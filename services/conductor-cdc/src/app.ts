import { getEnv } from '@aegir/common'
import Fastify from 'fastify'
import { registerSchemas, startCdcProcessor } from './cdc-processor.js'
import { getConnectorStatus, registerDebeziumConnector } from './debezium.js'
import { ensureTopics } from './kafka.js'
import { initaegirSinkDb, startaegirSinkConsumer } from './rebuilt-sink.js'
import { initSinkDb, startSinkConsumer } from './sink.js'

export async function buildApp() {
  const fastify = Fastify({ logger: true })
  const ac = new AbortController()

  fastify.get('/health', async () => {
    const status = await getConnectorStatus()
    return {
      status: 'ok',
      service: 'conductor-cdc',
      connector: status?.connector?.state || 'unknown',
    }
  })

  fastify.addHook('onClose', () => ac.abort())

  return {
    async start() {
      const port = Number(getEnv('CDC_PORT', '4020'))
      const host = getEnv('CDC_HOST', '0.0.0.0')

      // 1. Ensure normalized Kafka topics exist
      await ensureTopics()
      console.log('[cdc] topics ready')

      // 2. Register Avro schemas with Redpanda Schema Registry
      await registerSchemas()
      console.log('[cdc] schemas registered')

      // 3. Register the Debezium connector (with retries)
      await registerWithRetry(registerDebeziumConnector, 'Debezium connector')

      // 4. Initialize the sink database tables
      const sinkPool = await initSinkDb()

      // 5. Initialize the aegir sink database tables (conductor schema)
      const aegirSinkPool = await initaegirSinkDb()

      // 6. Start the CDC processor (raw Debezium → normalized Avro)
      startCdcProcessor(ac.signal)
      console.log('[cdc] CDC processor started')

      // 7. Start the sink consumer (normalized Avro → conductor_cdc postgres)
      startSinkConsumer(sinkPool, ac.signal)
      console.log('[cdc] sink consumer started')

      // 8. Start the aegir sink consumer (normalized Avro → aegir.conductor schema)
      startaegirSinkConsumer(aegirSinkPool, ac.signal)
      console.log('[cdc] aegir sink consumer started')

      await fastify.listen({ port, host })
    },
    fastify,
  }
}

async function registerWithRetry(fn: () => Promise<void>, label: string, maxAttempts = 30, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn()
      return
    } catch (err: any) {
      console.warn(`[cdc] attempt ${attempt}/${maxAttempts} - ${label} not ready: ${err.message}`)
      if (attempt === maxAttempts) throw err
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}
