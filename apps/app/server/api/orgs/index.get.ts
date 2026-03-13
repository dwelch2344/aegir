/** GET /api/orgs — List organizations the current user belongs to */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const userInfo = (session as any).userInfo as Record<string, any> | undefined
  const userId = userInfo?.sub
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Missing user ID in session' })
  }

  try {
    const orgs = await kcAdmin<any[]>(`/organizations`, { query: { memberUserId: userId } })
    return orgs
  } catch (err) {
    logger.warn('Failed to fetch orgs from kcAdmin', err)
    throw err
  }
})
