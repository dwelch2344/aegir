/**
 * Client-side safety net: catches unhandled 401 errors from any component
 * and redirects to OIDC login instead of showing a crash page.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { login, clear } = useOidcAuth()
  const route = useRoute()

  nuxtApp.hook('vue:error', async (err: any) => {
    if (err?.statusCode === 401 || err?.status === 401) {
      await clear()
      login('oidc', { callbackRedirectUrl: route.fullPath })
      return false
    }
  })
})
