/**
 * Shared test helpers for Nuxt server API tests.
 * Mocks Nitro auto-imported functions: getUserSession, kcAdmin, kcAdminRaw,
 * defineEventHandler, createError, readBody, getRouterParam.
 */
import { vi } from 'vitest'

export const mockSession = {
  accessToken: 'test-access-token',
  userInfo: {
    sub: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
  },
}

export function createMockEvent(options: { body?: any; params?: Record<string, string> } = {}) {
  const event = {
    _body: options.body,
    _params: options.params || {},
  }
  return event
}

/**
 * Set up global mocks for Nitro auto-imports.
 * Call this in a beforeEach or at the top of each test file.
 */
export function setupNitroMocks() {
  const getUserSessionMock = vi.fn().mockResolvedValue(mockSession)
  const kcAdminMock = vi.fn().mockResolvedValue([])
  const kcAdminRawMock = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 201,
      headers: { Location: '/organizations/org-123' },
    }),
  )
  const readBodyMock = vi.fn().mockResolvedValue({})
  const getRouterParamMock = vi.fn((event: any, name: string) => event._params?.[name])
  const createErrorMock = vi.fn((opts: any) => {
    const err = new Error(opts.statusMessage) as any
    err.statusCode = opts.statusCode
    err.statusMessage = opts.statusMessage
    return err
  })
  const defineEventHandlerMock = vi.fn((handler: any) => handler)

  // Register as globals (mimicking Nitro auto-imports)
  vi.stubGlobal('getUserSession', getUserSessionMock)
  vi.stubGlobal('kcAdmin', kcAdminMock)
  vi.stubGlobal('kcAdminRaw', kcAdminRawMock)
  vi.stubGlobal('readBody', readBodyMock)
  vi.stubGlobal('getRouterParam', getRouterParamMock)
  vi.stubGlobal('createError', createErrorMock)
  vi.stubGlobal('defineEventHandler', defineEventHandlerMock)
  vi.stubGlobal('$fetch', vi.fn())

  return {
    getUserSession: getUserSessionMock,
    kcAdmin: kcAdminMock,
    kcAdminRaw: kcAdminRawMock,
    readBody: readBodyMock,
    getRouterParam: getRouterParamMock,
    createError: createErrorMock,
    defineEventHandler: defineEventHandlerMock,
  }
}
