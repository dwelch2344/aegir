
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody(event)
  const { firstName, lastName, email } = body ?? {}

  if (!firstName && !lastName && !email) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const keycloakAccountUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL
    ?.replace('/protocol/openid-connect/token', '/account')

  if (!keycloakAccountUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Keycloak account URL not configured' })
  }

  // Fetch current profile first (Account API PUT requires full representation)
  const current = await $fetch<Record<string, any>>(keycloakAccountUrl, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
    },
  })

  const updated = {
    ...current,
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(email !== undefined && { email }),
  }

  await $fetch(keycloakAccountUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: updated,
  })

  return { ok: true }
})
