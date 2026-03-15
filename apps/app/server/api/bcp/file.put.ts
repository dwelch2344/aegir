/** PUT /api/bcp/file — Update a BCP file's content */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const BCP_DIR = process.env.SHIPYARD_BCP_DIR || '/workspace/.agents/bcp'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.path || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'path and content are required' })
  }

  // Prevent path traversal
  const resolved = join(BCP_DIR, body.path)
  if (!resolved.startsWith(BCP_DIR)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  await mkdir(dirname(resolved), { recursive: true })
  await writeFile(resolved, body.content, 'utf-8')

  return { ok: true, path: body.path }
})
