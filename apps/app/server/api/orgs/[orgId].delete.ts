/** DELETE /api/orgs/:orgId — Delete organization */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Organization ID is required' })
  }

  await kcAdmin(`/organizations/${orgId}`, { method: 'DELETE' })
  return { ok: true }
})
