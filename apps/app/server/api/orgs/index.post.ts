
/** POST /api/orgs — Create a new organization */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody(event)
  const { name, description } = body ?? {}

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Organization name is required' })
  }

  // Create the organization in Keycloak
  const res = await kcAdminRaw('/organizations', {
    method: 'POST',
    body: {
      name: name.trim(),
      description: description || '',
      enabled: true,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw createError({ statusCode: res.status, statusMessage: text || 'Failed to create organization' })
  }

  // Extract org ID from Location header
  const location = res.headers.get('Location') || ''
  const orgId = location.split('/').pop()

  // Add the creating user as a member
  const userInfo = (session as any).userInfo as Record<string, any> | undefined
  const userId = userInfo?.sub
  if (userId && orgId) {
    await kcAdmin(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: userId, // Keycloak expects just the user ID string
    })
  }

  return { id: orgId, name: name.trim() }
})
