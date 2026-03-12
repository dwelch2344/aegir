export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.oidcAuth?.enabled === false) return
  if (!(to.matched.length > 0)) return
  if (to.path.startsWith('/auth/')) return

  const { loggedIn, login, clear } = useOidcAuth()
  if (!loggedIn.value) {
    await login('oidc', { callbackRedirectUrl: to.fullPath })
    return
  }

  // Allow access to org management pages without an active org
  if (to.path.startsWith('/orgs')) return

  // Require org membership for all other pages
  const { orgs, loaded, fetchOrgs } = useOrg()
  if (!loaded.value) {
    try {
      await fetchOrgs()
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.status === 401) {
        // Clear stale session cookie before re-authenticating to avoid
        // an infinite loop (Keycloak has a session but the app doesn't)
        await clear()
        await login('oidc', { callbackRedirectUrl: to.fullPath })
        return
      }
      throw err
    }
  }
  if (orgs.value.length === 0) {
    return navigateTo('/orgs?reason=no-org')
  }
})
