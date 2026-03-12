import { describe, it, expect } from 'vitest'
import { handleProvisionAccount } from './provision-account.js'
import { createMockTask } from '../test-helpers.js'

describe('handleProvisionAccount', () => {
  it('succeeds with valid identityId', () => {
    const result = handleProvisionAccount(createMockTask({
      identityId: 'id-123',
      email: 'alice@test.com',
      name: 'Alice',
    }))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.accountId).toMatch(/^acct-/)
    expect(result.outputData?.identityId).toBe('id-123')
    expect(result.outputData?.email).toBe('alice@test.com')
  })

  it('fails when identityId is missing', () => {
    const result = handleProvisionAccount(createMockTask({ email: 'alice@test.com' }))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.error).toBe('Missing identityId from validation step')
  })
})
