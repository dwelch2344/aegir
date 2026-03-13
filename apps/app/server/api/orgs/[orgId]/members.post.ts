/** POST /api/orgs/:orgId/members — Add a member to the organization.
 *  Body: { userId: string } — existing user ID
 *     OR { email: string, firstName?: string, lastName?: string } — provision a new user
 */
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

  let userId = body?.userId as string | undefined

  if (!userId) {
    // Provision a new user or find existing by email
    const email = body?.email as string | undefined
    if (!email) {
      throw createError({ statusCode: 400, statusMessage: 'Either userId or email is required' })
    }

    // Check if user already exists
    const existing = await kcAdmin<any[]>('/users', {
      query: { email, exact: 'true' },
    })

    if (existing.length > 0) {
      userId = existing[0].id
    } else {
      // Create a new user (they'll need to claim via Google/IdP login)
      const res = await kcAdminRaw('/users', {
        method: 'POST',
        body: {
          email,
          username: email,
          firstName: body.firstName || '',
          lastName: body.lastName || '',
          enabled: true,
          emailVerified: false,
          requiredActions: ['VERIFY_EMAIL'],
        },
      })

      if (!res.ok) {
        const text = await res.text()
        throw createError({ statusCode: res.status, statusMessage: text || 'Failed to create user' })
      }

      const location = res.headers.get('Location') || ''
      userId = location.split('/').pop()
    }
  }

  if (!userId) {
    throw createError({ statusCode: 500, statusMessage: 'Could not resolve user ID' })
  }

  // Add user to the organization
  await kcAdmin(`/organizations/${orgId}/members`, {
    method: 'POST',
    body: userId,
  })

  return { ok: true, userId }
})
