
/** GET /api/orgs/:orgId — Get organization details */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Organization ID is required' })
  }

  const org = await kcAdmin(`/organizations/${orgId}`)
  return org
})
