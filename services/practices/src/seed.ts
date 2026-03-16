/**
 * Seed script — loads filesystem YAML/MD registry files into the practices database.
 *
 * Usage: tsx src/seed.ts [--org <orgId>]
 *
 * Idempotent: uses upserts so it's safe to run repeatedly.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEnv } from '@aegir/common'
import { buildApp } from './app.js'
import { seedFromDisk } from './seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE = getEnv('WORKSPACE', join(__dirname, '..', '..', '..'))

const orgId = Number(process.argv.find((_, i, a) => a[i - 1] === '--org') ?? '1')

async function main() {
  const { app } = await buildApp()

  const contextService = app.resolve<any>('contextService')
  const bcpService = app.resolve<any>('bcpService')
  const catalogService = app.resolve<any>('catalogService')

  await seedFromDisk({ contextService, bcpService, catalogService }, { workspace: WORKSPACE, orgId })

  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err)
  process.exit(1)
})
