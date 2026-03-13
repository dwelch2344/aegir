import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockEvent, mockSession, setupNitroMocks } from '../../test-helpers.js'

describe('GET /api/orgs', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    const mod = await import('./index.get.js')
    // defineEventHandler mock returns the raw handler
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('returns orgs for the authenticated user', async () => {
    const orgList = [
      { id: 'org-1', name: 'Acme' },
      { id: 'org-2', name: 'Beta' },
    ]
    mocks.kcAdmin.mockResolvedValue(orgList)

    const handler = await getHandler()
    const event = createMockEvent()
    const result = await handler(event)

    expect(mocks.getUserSession).toHaveBeenCalledWith(event)
    expect(mocks.kcAdmin).toHaveBeenCalledWith('/users/user-123/organizations')
    expect(result).toEqual(orgList)
  })

  it('throws 401 when no access token', async () => {
    mocks.getUserSession.mockResolvedValue({})

    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Not authenticated')
  })

  it('throws 401 when no user sub', async () => {
    mocks.getUserSession.mockResolvedValue({ accessToken: 'tok', userInfo: {} })

    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Missing user ID in session')
  })
})

describe('POST /api/orgs', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    const mod = await import('./index.post.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('creates an org and adds the user as a member', async () => {
    mocks.readBody.mockResolvedValue({ name: 'New Org', description: 'test' })
    mocks.kcAdminRaw.mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { Location: '/admin/realms/global/organizations/org-new' },
      }),
    )

    const handler = await getHandler()
    const result = await handler(createMockEvent())

    expect(result).toEqual({ id: 'org-new', name: 'New Org' })
    expect(mocks.kcAdminRaw).toHaveBeenCalledWith(
      '/organizations',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ name: 'New Org' }),
      }),
    )
    // Should add creator as member
    expect(mocks.kcAdmin).toHaveBeenCalledWith(
      '/organizations/org-new/members',
      expect.objectContaining({
        method: 'POST',
        body: 'user-123',
      }),
    )
  })

  it('throws 400 when name is empty', async () => {
    mocks.readBody.mockResolvedValue({ name: '' })

    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Organization name is required')
  })

  it('throws 400 when name is missing', async () => {
    mocks.readBody.mockResolvedValue({})

    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Organization name is required')
  })

  it('trims whitespace from name', async () => {
    mocks.readBody.mockResolvedValue({ name: '  Padded Name  ' })
    mocks.kcAdminRaw.mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { Location: '/organizations/org-padded' },
      }),
    )

    const handler = await getHandler()
    const result = await handler(createMockEvent())

    expect(result.name).toBe('Padded Name')
  })
})
