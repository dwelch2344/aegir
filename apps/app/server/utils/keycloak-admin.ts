/**
 * Keycloak Admin API helper.
 * Uses the `aegir-admin-api` service account (client_credentials grant)
 * to call the Keycloak Admin REST API for organization and user management.
 */

const KEYCLOAK_BASE = process.env.KEYCLOAK_ADMIN_API_URL || 'http://keycloak:8080/infra/idp'
const CLIENT_ID = process.env.KEYCLOAK_ADMIN_API_CLIENT_ID || 'aegir-admin-api'
const CLIENT_SECRET = process.env.KEYCLOAK_ADMIN_API_CLIENT_SECRET || 'aegir-local-dev-admin-api-secret'
const REALM = 'global'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

/** Acquire a service-account access token (cached until ~60s before expiry). */
async function getServiceAccountToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken
  }

  const tokenUrl = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`
  const payload = {
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }
  const body = new URLSearchParams(payload)

  const res = await $fetch<{ access_token: string; expires_in: number }>(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  cachedToken = {
    accessToken: res.access_token,
    expiresAt: Date.now() + (res.expires_in - 60) * 1000,
  }

  return cachedToken.accessToken
}

/** Make an authenticated request to the Keycloak Admin REST API. */
export async function kcAdmin<T = any>(
  path: string,
  options: { method?: string; body?: any; query?: Record<string, string> } = {},
): Promise<T> {
  const token = await getServiceAccountToken()
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}${path}`

  const payload = {
    method: (options.method || 'GET') as any,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body,
    query: options.query,
  }
  return await $fetch<T>(url, payload)
}

/** Make a raw fetch that returns the full response (for Location headers, etc). */
export async function kcAdminRaw(path: string, options: { method?: string; body?: any } = {}): Promise<Response> {
  const token = await getServiceAccountToken()
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}${path}`

  return fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}
