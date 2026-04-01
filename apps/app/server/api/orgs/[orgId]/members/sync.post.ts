/** POST /api/orgs/:orgId/members/sync — Sync Keycloak org members into IAM identities + memberships.
 *  Fetches all members from Keycloak for the org, upserts them as IAM identities,
 *  and ensures each has a membership in the corresponding IAM organization.
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
  const iamOrgId = body?.iamOrgId as number | undefined
  if (!iamOrgId) {
    throw createError({ statusCode: 400, statusMessage: 'iamOrgId is required' })
  }

  // 1. Fetch all members of this Keycloak org
  const kcMembers = await kcAdmin<any[]>(`/organizations/${orgId}/members`)

  if (!kcMembers.length) {
    return { synced: 0, identities: [], memberships: [] }
  }

  // 2. Build sync input for IAM identity upsert
  const syncInput = kcMembers.map((m: any) => ({
    keycloakId: m.id,
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || m.email,
    email: m.email,
  }))

  // 3. Sync identities into IAM via GraphQL
  const config = useRuntimeConfig()
  const gatewayUrl = config.gatewayUrl as string

  const syncRes = await $fetch<any>(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      query: `mutation SyncIdentities($input: [IamIdentitySyncInput!]!) {
        iam { identities { sync(input: $input) { id keycloakId label email } } }
      }`,
      variables: { input: syncInput },
    },
  })

  if (syncRes.errors?.length) {
    throw createError({ statusCode: 500, statusMessage: syncRes.errors[0].message })
  }

  const syncedIdentities = syncRes.data.iam.identities.sync as {
    id: number
    keycloakId: string
    label: string
    email: string
  }[]

  // 4. Ensure each synced identity has a membership in this IAM org
  // First, fetch existing memberships for this org
  const mshipRes = await $fetch<any>(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      query: `query($input: IamMembershipSearchInput!) {
        iam { memberships { search(input: $input) { results { id identityId organizationId } } } }
      }`,
      variables: { input: { organizationIdIn: [iamOrgId] } },
    },
  })

  const existingMemberships = mshipRes.data?.iam?.memberships?.search?.results ?? []
  const existingIdentityIds = new Set(existingMemberships.map((m: any) => m.identityId))

  // Create memberships for identities that don't have one yet
  const newMemberships = []
  for (const identity of syncedIdentities) {
    if (!existingIdentityIds.has(identity.id)) {
      const createRes = await $fetch<any>(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          query: `mutation($input: IamMembershipCreateInput!) {
            iam { memberships { create(input: $input) { id identityId organizationId } } }
          }`,
          variables: { input: { identityId: identity.id, organizationId: iamOrgId } },
        },
      })
      if (createRes.data?.iam?.memberships?.create) {
        newMemberships.push(createRes.data.iam.memberships.create)
      }
    }
  }

  return {
    synced: syncedIdentities.length,
    identities: syncedIdentities,
    newMemberships: newMemberships.length,
  }
})
