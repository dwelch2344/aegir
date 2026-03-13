import { kcAdmin } from '../utils/keycloak-admin'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const userId = session.userInfo?.sub
  if (!userId) {
    throw createError({ statusCode: 500, statusMessage: 'User ID not available in session' })
  }

  return await kcAdmin(`/users/${userId}`)
})
