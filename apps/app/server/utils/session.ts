import { getUserSession as _getUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'
import { kcAdmin } from './keycloak-admin'
import type { H3Event } from 'h3'

/** Wraps the OIDC getUserSession to hydrate userInfo from the JWT access token. */
export async function getUserSession(event: H3Event) {
  const session: any = await _getUserSession(event)

  if (session?.accessToken && !session.userInfo) {
    try {
      const [, payload] = session.accessToken.split('.')
      const claims: any = JSON.parse(Buffer.from(payload, 'base64url').toString())
      let sub = claims.sub
      // Keycloak 26.x lightweight tokens may omit `sub`; resolve via email lookup
      if (!sub && claims.email) {
        const users = await kcAdmin<{ id: string }[]>(`/users`, { query: { email: claims.email, exact: 'true' } })
        sub = users?.[0]?.id
      }
      session.claims = claims
      session.userName = claims.email
      session.userInfo = { sub, email: claims.email, name: claims.name }
    } catch (err) {
      logger.error('[session] Failed to hydrate userInfo:', err)
    }
  }
  return session
}
