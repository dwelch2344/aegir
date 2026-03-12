import { createApp } from './app.js'
import { config } from './config.js'

const MAX_RETRIES = 10
const RETRY_DELAY_MS = 3000

async function start(attempt = 1): Promise<void> {
  const app = createApp()
  try {
    await app.listen({ port: config.port, host: config.host })
  } catch (err: any) {
    if (attempt >= MAX_RETRIES) {
      app.log.error(`Gateway failed after ${MAX_RETRIES} attempts — giving up`)
      app.log.error(err)
      process.exit(1)
    }
    app.log.warn(`Gateway startup attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`)
    app.log.warn(`Retrying in ${RETRY_DELAY_MS / 1000}s...`)
    await app.close().catch(() => {})
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    return start(attempt + 1)
  }
}

start()
