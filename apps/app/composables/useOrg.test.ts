import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be set before any module imports
// useOrg.ts uses ref/computed/readonly at module scope
function makeRef(val: any) {
  return { value: val }
}

;(globalThis as any).ref = makeRef
;(globalThis as any).computed = (fn: any) => ({ get value() { return fn() } })
;(globalThis as any).readonly = (r: any) => r
;(globalThis as any).$fetch = vi.fn()
;(globalThis as any).useCookie = (_name: string, opts?: any) => makeRef(opts?.default?.() ?? null)
;(globalThis as any).useRuntimeConfig = () => ({ public: { gatewayUrl: 'http://localhost:4000/graphql' } })
;(globalThis as any).useRequestHeaders = () => ({})
;(globalThis as any).logger = { error: vi.fn(), warn: vi.fn() }
;(globalThis as any).fetch = vi.fn()

// Mock localStorage
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, val),
}

// Now import after globals are set
const { useOrg } = await import('./useOrg.js')

describe('useOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.clear()
  })

  it('returns the composable interface', () => {
    const result = useOrg()
    expect(result).toHaveProperty('orgs')
    expect(result).toHaveProperty('activeOrg')
    expect(result).toHaveProperty('activeOrgId')
    expect(result).toHaveProperty('loading')
    expect(result).toHaveProperty('loaded')
    expect(result).toHaveProperty('fetchOrgs')
    expect(result).toHaveProperty('setActiveOrg')
    expect(result).toHaveProperty('onOrgSwitch')
  })

  it('setActiveOrg updates the active org id', () => {
    const { setActiveOrg, activeOrgId } = useOrg()
    setActiveOrg(42)
    expect(activeOrgId.value).toBe(42)
  })

  it('onOrgSwitch fires callback on org change', () => {
    const cb = vi.fn()
    const { setActiveOrg, onOrgSwitch } = useOrg()
    onOrgSwitch(cb)
    setActiveOrg(7)
    expect(cb).toHaveBeenCalledWith(7)
  })
})
