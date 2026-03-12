
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const keycloakAccountUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL
    ?.replace('/protocol/openid-connect/token', '/account')

  if (!keycloakAccountUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Keycloak account URL not configured' })
  }

  const response = await $fetch(keycloakAccountUrl, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
    },
  })

  return response
})
