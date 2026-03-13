import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockEvent, setupNitroMocks } from '../../test-helpers.js'

describe('GET /api/orgs/:orgId/members', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId]/members.get.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('returns mapped member list', async () => {
    const rawMembers = [
      {
        id: 'u1',
        email: 'a@t.com',
        firstName: 'Alice',
        lastName: 'C',
        username: 'alice',
        enabled: true,
        emailVerified: true,
        extra: 'ignored',
      },
    ]
    mocks.kcAdmin.mockResolvedValue(rawMembers)

    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result).toEqual([
      {
        id: 'u1',
        email: 'a@t.com',
        firstName: 'Alice',
        lastName: 'C',
        username: 'alice',
        enabled: true,
        emailVerified: true,
      },
    ])
  })
})

describe('POST /api/orgs/:orgId/members', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId]/members.post.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('adds an existing user by userId', async () => {
    mocks.readBody.mockResolvedValue({ userId: 'user-existing' })

    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result).toEqual({ ok: true, userId: 'user-existing' })
    expect(mocks.kcAdmin).toHaveBeenCalledWith(
      '/organizations/org-1/members',
      expect.objectContaining({
        method: 'POST',
        body: 'user-existing',
      }),
    )
  })

  it('finds existing user by email and adds them', async () => {
    mocks.readBody.mockResolvedValue({ email: 'existing@test.com' })
    mocks.kcAdmin
      .mockResolvedValueOnce([{ id: 'user-found' }]) // /users?email=...
      .mockResolvedValueOnce(undefined) // /organizations/.../members

    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result).toEqual({ ok: true, userId: 'user-found' })
  })

  it('provisions a new user when email not found', async () => {
    mocks.readBody.mockResolvedValue({ email: 'new@test.com', firstName: 'New', lastName: 'User' })
    mocks.kcAdmin.mockResolvedValueOnce([]) // no existing user
    mocks.kcAdminRaw.mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { Location: '/admin/realms/global/users/user-new' },
      }),
    )

    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result.userId).toBe('user-new')
    expect(mocks.kcAdminRaw).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'User',
        }),
      }),
    )
  })

  it('throws 400 when neither userId nor email provided', async () => {
    mocks.readBody.mockResolvedValue({})

    const handler = await getHandler()
    await expect(handler(createMockEvent({ params: { orgId: 'org-1' } }))).rejects.toThrow(
      'Either userId or email is required',
    )
  })
})

describe('DELETE /api/orgs/:orgId/members/:memberId', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId]/members/[memberId].delete.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('removes the member', async () => {
    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1', memberId: 'user-1' } }))

    expect(result).toEqual({ ok: true })
    expect(mocks.kcAdmin).toHaveBeenCalledWith('/organizations/org-1/members/user-1', { method: 'DELETE' })
  })

  it('throws 400 when ids are missing', async () => {
    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Organization ID and member ID are required')
  })
})
