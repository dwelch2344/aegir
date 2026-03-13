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

  const body = await readBody(event)
  const { firstName, lastName } = body ?? {}

  if (!firstName && !lastName) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const current = await kcAdmin<Record<string, any>>(`/users/${userId}`)

  const updated = {
    ...current,
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
  }

  await kcAdmin(`/users/${userId}`, { method: 'PUT', body: updated })

  return { ok: true }
})
