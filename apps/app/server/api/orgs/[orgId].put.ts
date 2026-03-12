
/** PUT /api/orgs/:orgId — Update organization */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Organization ID is required' })
  }

  const body = await readBody(event)
  const { name, description } = body ?? {}

  // Fetch current org, merge changes
  const current = await kcAdmin(`/organizations/${orgId}`)
  const updated = {
    ...current,
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
  }

  await kcAdmin(`/organizations/${orgId}`, { method: 'PUT', body: updated })
  return { ok: true }
})
