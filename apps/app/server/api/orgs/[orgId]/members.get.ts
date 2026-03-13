/** GET /api/orgs/:orgId/members — List organization members */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Organization ID is required' })
  }

  const members = await kcAdmin<any[]>(`/organizations/${orgId}/members`)
  return members.map((m: any) => ({
    id: m.id,
    email: m.email,
    firstName: m.firstName || '',
    lastName: m.lastName || '',
    username: m.username,
    enabled: m.enabled,
    emailVerified: m.emailVerified,
  }))
})
