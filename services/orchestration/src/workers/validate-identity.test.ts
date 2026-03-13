import { describe, expect, it } from 'vitest'
import { createMockTask } from '../test-helpers.js'
import { handleValidateIdentity } from './validate-identity.js'

describe('handleValidateIdentity', () => {
  it('succeeds with valid email and name', () => {
    const result = handleValidateIdentity(createMockTask({ email: 'alice@test.com', name: 'Alice Chen' }))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.email).toBe('alice@test.com')
    expect(result.outputData?.name).toBe('Alice Chen')
    expect(result.outputData?.identityId).toMatch(/^id-/)
    expect(result.outputData?.validatedAt).toBeDefined()
  })

  it('fails when email is missing', () => {
    const result = handleValidateIdentity(createMockTask({ name: 'Alice' }))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('Invalid or missing email')
  })

  it('fails when email has no @', () => {
    const result = handleValidateIdentity(createMockTask({ email: 'not-an-email', name: 'Alice' }))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('Invalid or missing email')
  })

  it('fails when name is too short', () => {
    const result = handleValidateIdentity(createMockTask({ email: 'a@b.com', name: 'A' }))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('Name must be at least 2 characters')
  })

  it('fails with both errors when both fields invalid', () => {
    const result = handleValidateIdentity(createMockTask({}))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toHaveLength(2)
  })

  it('preserves workflowInstanceId and taskId', () => {
    const result = handleValidateIdentity(createMockTask({ email: 'a@b.com', name: 'Alice' }))
    expect(result.workflowInstanceId).toBe('wf-test-123')
    expect(result.taskId).toBe('task-test-456')
  })
})
