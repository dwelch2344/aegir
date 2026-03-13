import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockEvent, setupNitroMocks } from '../../test-helpers.js'

describe('GET /api/orgs/:orgId', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId].get.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('returns org details', async () => {
    const org = { id: 'org-1', name: 'Acme', description: 'Test' }
    mocks.kcAdmin.mockResolvedValue(org)

    const handler = await getHandler()
    const event = createMockEvent({ params: { orgId: 'org-1' } })
    const result = await handler(event)

    expect(mocks.kcAdmin).toHaveBeenCalledWith('/organizations/org-1')
    expect(result).toEqual(org)
  })

  it('throws 400 when orgId is missing', async () => {
    const handler = await getHandler()
    await expect(handler(createMockEvent())).rejects.toThrow('Organization ID is required')
  })
})

describe('PUT /api/orgs/:orgId', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId].put.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('updates org with merged data', async () => {
    mocks.kcAdmin
      .mockResolvedValueOnce({ id: 'org-1', name: 'Old', description: 'Old desc' }) // GET
      .mockResolvedValueOnce(undefined) // PUT
    mocks.readBody.mockResolvedValue({ name: 'New Name' })

    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result).toEqual({ ok: true })
    expect(mocks.kcAdmin).toHaveBeenCalledWith(
      '/organizations/org-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({ name: 'New Name', description: 'Old desc' }),
      }),
    )
  })
})

describe('DELETE /api/orgs/:orgId', () => {
  let mocks: ReturnType<typeof setupNitroMocks>

  beforeEach(() => {
    vi.resetModules()
    mocks = setupNitroMocks()
  })

  async function getHandler() {
    await import('./[orgId].delete.js')
    return mocks.defineEventHandler.mock.calls[0][0]
  }

  it('deletes the org', async () => {
    const handler = await getHandler()
    const result = await handler(createMockEvent({ params: { orgId: 'org-1' } }))

    expect(result).toEqual({ ok: true })
    expect(mocks.kcAdmin).toHaveBeenCalledWith('/organizations/org-1', { method: 'DELETE' })
  })
})
