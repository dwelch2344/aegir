import { describe, expect, it } from 'vitest'
import { createMockTask } from '../test-helpers.js'
import { handleSendWelcomeEmail } from './send-welcome-email.js'

describe('handleSendWelcomeEmail', () => {
  it('succeeds with email and accountId', () => {
    const result = handleSendWelcomeEmail(
      createMockTask({
        email: 'alice@test.com',
        name: 'Alice',
        accountId: 'acct-123',
      }),
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.sent).toBe(true)
    expect(result.outputData?.to).toBe('alice@test.com')
    expect(result.outputData?.subject).toContain('Alice')
  })

  it('fails when email is missing', () => {
    const result = handleSendWelcomeEmail(createMockTask({ accountId: 'acct-123' }))
    expect(result.status).toBe('FAILED')
  })

  it('fails when accountId is missing', () => {
    const result = handleSendWelcomeEmail(createMockTask({ email: 'alice@test.com' }))
    expect(result.status).toBe('FAILED')
  })
})
