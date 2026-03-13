import { describe, expect, it } from 'vitest'
import { getEnv, requireEnv } from './env.js'

describe('getEnv', () => {
  it('returns the value when set', () => {
    process.env.TEST_GET_ENV = 'hello'
    expect(getEnv('TEST_GET_ENV')).toBe('hello')
    delete process.env.TEST_GET_ENV
  })

  it('returns fallback when not set', () => {
    expect(getEnv('NONEXISTENT_VAR', 'default')).toBe('default')
  })

  it('returns undefined when not set and no fallback', () => {
    expect(getEnv('NONEXISTENT_VAR')).toBeUndefined()
  })
})

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env.TEST_REQUIRE_ENV = 'hello'
    expect(requireEnv('TEST_REQUIRE_ENV')).toBe('hello')
    delete process.env.TEST_REQUIRE_ENV
  })

  it('throws when not set', () => {
    expect(() => requireEnv('NONEXISTENT_VAR')).toThrow('Missing required environment variable: NONEXISTENT_VAR')
  })
})
