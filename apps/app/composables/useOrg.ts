/** Composable for managing the active organization context. */

interface KeycloakOrg {
  id: string
  name: string
  description?: string
  enabled?: boolean
}

interface Org {
  /** Our IAM organization ID (stable across IdP changes) */
  id: number
  key: string
  name: string
  keycloakId: string | null
}

const orgs = ref<Org[]>([])
const loading = ref(false)
const loaded = ref(false)

/** Event bus for org-switch — consumers call onOrgSwitch() to react */
const orgSwitchCallbacks: Array<(orgId: number) => void> = []

export function useOrg() {
  const activeOrgId = useCookie<number | null>('activeOrgId', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365, // persist across tabs & browser restarts
    watch: true,
  })

  const activeOrg = computed(() => orgs.value.find((o) => o.id === activeOrgId.value) || null)

  async function fetchOrgs() {
    loading.value = true
    try {
      const config = useRuntimeConfig()
      const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

      // 1. Get user's Keycloak orgs
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const kcOrgs = await $fetch<KeycloakOrg[]>('/api/orgs', { headers })

      // 2. Bootstrap identity (always — creates system org membership if first user)
      let identityId: number | null = null
      try {
        const bootstrapResult = await $fetch<{
          identity: { id: number }
          isFirstUser: boolean
        }>('/api/iam/bootstrap', { method: 'POST', headers })
        identityId = bootstrapResult.identity.id
      } catch (bootstrapErr) {
        logger.error('Failed to bootstrap identity', bootstrapErr)
      }

      // 3. Sync Keycloak orgs into IAM (if any)
      if (kcOrgs.length) {
        const syncInput = kcOrgs.map((kc) => ({
          keycloakId: kc.id,
          key: kc.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
          name: kc.name,
        }))

        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `mutation SyncOrgs($input: [IamOrganizationSyncInput!]!) {
              iam { orgs { sync(input: $input) { id key name keycloakId } } }
            }`,
            variables: { input: syncInput },
          }),
        })
        const json = (await response.json()) as {
          data?: { iam: { orgs: { sync: Org[] } } }
          errors?: { message: string }[]
        }

        if (json.errors?.length) {
          logger.error('Failed to sync orgs to IAM', json.errors)
          orgs.value = await fetchOrgsByKeycloakIds(
            gatewayUrl,
            kcOrgs.map((o) => o.id),
          )
        } else {
          orgs.value = json.data!.iam.orgs.sync
        }
      } else {
        orgs.value = []
      }

      // 4. Merge IAM membership orgs (system org + any non-Keycloak orgs)
      if (identityId) {
        try {
          const membershipOrgIds = await fetchMembershipOrgIds(gatewayUrl, identityId)
          const existingIds = new Set(orgs.value.map((o) => o.id))
          const missingIds = membershipOrgIds.filter((id) => !existingIds.has(id))
          if (missingIds.length > 0) {
            const iamOnlyOrgs = await fetchOrgsByIds(gatewayUrl, missingIds)
            orgs.value = [...orgs.value, ...iamOnlyOrgs]
          }
        } catch (mergeErr) {
          logger.error('Failed to merge IAM membership orgs', mergeErr)
        }
      }

      // 5. Set active org selection
      if (!activeOrgId.value || !orgs.value.find((o) => o.id === activeOrgId.value)) {
        if (orgs.value.length > 0) {
          activeOrgId.value = orgs.value[0].id
        } else {
          activeOrgId.value = null
        }
      }
      loaded.value = true
    } catch (err) {
      logger.error('failed to fetchOrgs', err)
    } finally {
      loading.value = false
    }
  }

  function setActiveOrg(orgId: number) {
    const prev = activeOrgId.value
    activeOrgId.value = orgId
    if (prev !== orgId) {
      // Notify all listeners
      for (const cb of orgSwitchCallbacks) {
        try {
          cb(orgId)
        } catch {}
      }
    }
  }

  /** Register a callback for org-switch events. Returns unsubscribe function. */
  function onOrgSwitch(cb: (orgId: number) => void) {
    orgSwitchCallbacks.push(cb)
    return () => {
      const idx = orgSwitchCallbacks.indexOf(cb)
      if (idx !== -1) orgSwitchCallbacks.splice(idx, 1)
    }
  }

  return {
    orgs: readonly(orgs),
    activeOrg,
    activeOrgId: readonly(activeOrgId),
    loading: readonly(loading),
    loaded: readonly(loaded),
    fetchOrgs,
    setActiveOrg,
    onOrgSwitch,
  }
}

/** Fallback: query IAM for orgs by their Keycloak IDs */
async function fetchOrgsByKeycloakIds(gatewayUrl: string, keycloakIds: string[]): Promise<Org[]> {
  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($input: IamOrganizationSearchInput!) {
          iam { orgs { search(input: $input) { results { id key name keycloakId } } } }
        }`,
        variables: { input: { keycloakIdIn: keycloakIds } },
      }),
    })
    const json = (await response.json()) as any
    return json.data?.iam?.orgs?.search?.results ?? []
  } catch {
    return []
  }
}

/** Fetch all org IDs where this identity has memberships */
async function fetchMembershipOrgIds(gatewayUrl: string, identityId: number): Promise<number[]> {
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($input: IamMembershipSearchInput!) {
        iam { memberships { search(input: $input) { results { organizationId } } } }
      }`,
      variables: { input: { identityIdIn: [identityId] } },
    }),
  })
  const json = (await response.json()) as any
  const results = json.data?.iam?.memberships?.search?.results ?? []
  return [...new Set(results.map((m: any) => m.organizationId as number))]
}

/** Fetch orgs by their IAM IDs */
async function fetchOrgsByIds(gatewayUrl: string, orgIds: number[]): Promise<Org[]> {
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($input: IamOrganizationSearchInput!) {
        iam { orgs { search(input: $input) { results { id key name keycloakId } } } }
      }`,
      variables: { input: { idIn: orgIds } },
    }),
  })
  const json = (await response.json()) as any
  return json.data?.iam?.orgs?.search?.results ?? []
}
