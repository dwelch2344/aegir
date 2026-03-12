import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock $fetch and fetch before importing
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('fetch', vi.fn())

// Set env vars for tests
process.env.KEYCLOAK_ADMIN_API_URL = 'http://keycloak:8080/infra/idp'
process.env.KEYCLOAK_ADMIN_API_CLIENT_ID = 'test-client'
process.env.KEYCLOAK_ADMIN_API_CLIENT_SECRET = 'test-secret'

import { kcAdmin, kcAdminRaw } from './keycloak-admin.js'

describe('kcAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // First call acquires token
    mockFetch.mockResolvedValueOnce({
      access_token: 'service-token',
      expires_in: 300,
    })
  })

  it('acquires a token and makes an authenticated GET request', async () => {
    const orgs = [{ id: 'org-1', name: 'Test' }]
    mockFetch.mockResolvedValueOnce(orgs)

    const result = await kcAdmin('/organizations')

    // First call: token request
    expect(mockFetch).toHaveBeenCalledWith(
      'http://keycloak:8080/infra/idp/realms/global/protocol/openid-connect/token',
      expect.objectContaining({ method: 'POST' }),
    )

    // Second call: admin API request
    expect(mockFetch).toHaveBeenCalledWith(
      'http://keycloak:8080/infra/idp/admin/realms/global/organizations',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer service-token',
        }),
      }),
    )

    expect(result).toEqual(orgs)
  })

  it('makes a POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await kcAdmin('/organizations/org-1/members', {
      method: 'POST',
      body: 'user-123',
    })

    // Token may be cached from previous test, so find the admin API call
    const adminCall = mockFetch.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('/admin/'),
    )
    expect(adminCall).toBeDefined()
    expect(adminCall![1].method).toBe('POST')
    expect(adminCall![1].body).toBe('user-123')
  })
})

describe('kcAdminRaw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Token acquisition
    mockFetch.mockResolvedValueOnce({
      access_token: 'service-token',
      expires_in: 300,
    })
  })

  it('returns a raw Response', async () => {
    const mockResponse = new Response(null, {
      status: 201,
      headers: { Location: '/organizations/new-org' },
    })
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse)

    const result = await kcAdminRaw('/organizations', {
      method: 'POST',
      body: { name: 'New Org' },
    })

    expect(result.status).toBe(201)
    expect(result.headers.get('Location')).toBe('/organizations/new-org')
  })
})
