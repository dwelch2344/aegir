/** POST /api/iam/bootstrap — Sync the current user as an IAM identity.
 *  If the system org has no members yet, the user becomes its Owner.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const userInfo = (session as any).userInfo as Record<string, any> | undefined
  const claims = (session as any).claims as Record<string, any> | undefined
  const keycloakId = userInfo?.sub
  const email = userInfo?.email
  if (!keycloakId || !email) {
    throw createError({ statusCode: 401, statusMessage: 'Missing user info in session' })
  }

  // Build display label from JWT claims (which have the full Keycloak profile),
  // falling back to the condensed userInfo.name, then email.
  const label =
    [claims?.given_name, claims?.family_name].filter(Boolean).join(' ') ||
    userInfo?.name ||
    claims?.preferred_username ||
    email

  const config = useRuntimeConfig()
  const gatewayUrl = config.gatewayUrl as string

  let res: any
  try {
    res = await $fetch<any>(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        query: `mutation Bootstrap($input: IamIdentitySyncInput!) {
          iam { identities { bootstrap(input: $input) {
            identity { id keycloakId label email }
            isFirstUser
            systemMembership { id organizationId }
          } } }
        }`,
        variables: {
          input: { keycloakId, label, email },
        },
      },
    })
  } catch (fetchErr: any) {
    logger.error('[bootstrap] Gateway request failed:', fetchErr?.message ?? fetchErr)
    throw createError({ statusCode: 502, statusMessage: 'IAM gateway unreachable' })
  }

  if (res.errors?.length) {
    logger.error('[bootstrap] GraphQL errors:', res.errors)
    throw createError({ statusCode: 500, statusMessage: res.errors[0].message })
  }

  return res.data.iam.identities.bootstrap
})
