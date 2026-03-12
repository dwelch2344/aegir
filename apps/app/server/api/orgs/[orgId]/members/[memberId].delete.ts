
/** DELETE /api/orgs/:orgId/members/:memberId — Remove a member from the organization */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const orgId = getRouterParam(event, 'orgId')
  const memberId = getRouterParam(event, 'memberId')

  if (!orgId || !memberId) {
    throw createError({ statusCode: 400, statusMessage: 'Organization ID and member ID are required' })
  }

  await kcAdmin(`/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' })
  return { ok: true }
})
