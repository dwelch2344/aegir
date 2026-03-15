/** PUT /api/context/file — Update a context file's content */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const CONTEXT_DIR = process.env.SHIPYARD_CONTEXT_DIR || '/workspace/.agents/context'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.path || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'path and content are required' })
  }

  // Prevent path traversal
  const resolved = join(CONTEXT_DIR, body.path)
  if (!resolved.startsWith(CONTEXT_DIR)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  await mkdir(dirname(resolved), { recursive: true })
  await writeFile(resolved, body.content, 'utf-8')

  return { ok: true, path: body.path }
})
