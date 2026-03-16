import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEnv } from '@aegir/common'
import { buildApp } from './app.js'
import { seedFromDisk } from './seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = getEnv('WORKSPACE', join(__dirname, '..', '..', '..'))

const { app } = await buildApp()
await app.start()

// Auto-seed from disk on startup (idempotent upserts)
try {
  const contextService = app.resolve<any>('contextService')
  const bcpService = app.resolve<any>('bcpService')
  const catalogService = app.resolve<any>('catalogService')
  await seedFromDisk({ contextService, bcpService, catalogService }, { workspace: WORKSPACE })
} catch (err) {
  console.error('[practices] auto-seed failed (non-fatal):', err)
}
