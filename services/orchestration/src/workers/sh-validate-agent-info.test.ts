import { describe, it, expect } from 'vitest'
import { handleShValidateAgentInfo } from './sh-validate-agent-info.js'
import { createMockTask } from '../test-helpers.js'

function validAgentInput(overrides: Record<string, any> = {}) {
  return {
    agentFirstName: 'Jane',
    agentLastName: 'Smith',
    agentEmail: 'jane@test.com',
    agentPhone: '555-1234',
    agentNpn: '12345678',
    residentState: 'UT',
    requestedStates: ['UT', 'ID'],
    ...overrides,
  }
}

describe('handleShValidateAgentInfo', () => {
  it('succeeds with valid resident agent data', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput()))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.agentFullName).toBe('Jane Smith')
    expect(result.outputData?.approvedStates).toEqual(['UT', 'ID'])
    expect(result.outputData?.contractId).toMatch(/^sh-aca-/)
  })

  it('fails when first name is missing', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({ agentFirstName: '' })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('First name is required')
  })

  it('fails when email is invalid', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({ agentEmail: 'bad' })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('Valid email is required')
  })

  it('fails when no requested states', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({ requestedStates: [] })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors).toContain('At least one requested state is required')
  })

  it('fails with invalid states', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({ requestedStates: ['CA', 'TX'] })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors[0]).toContain('Invalid states: CA, TX')
  })

  it('fails for non-resident without CO exception', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({
      residentState: 'CA',
      requestedStates: ['UT'],
    })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors[0]).toContain('not eligible')
  })

  it('succeeds for non-resident with CO exception (CO only)', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({
      residentState: 'CA',
      requestedStates: ['CO'],
      hasC4CoCertification: true,
      hasCoLicense: true,
    })))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.approvedStates).toEqual(['CO'])
  })

  it('fails for non-resident with CO exception requesting multiple states', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({
      residentState: 'CA',
      requestedStates: ['CO', 'UT'],
      hasC4CoCertification: true,
      hasCoLicense: true,
    })))
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.errors[0]).toContain('can only appoint for CO')
  })

  it('demotes errors to warnings with ignoreValidationErrors', async () => {
    const result = await handleShValidateAgentInfo(createMockTask(validAgentInput({
      residentState: 'CA',
      requestedStates: ['UT'],
      ignoreValidationErrors: true,
    })))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.warnings).toBeDefined()
    expect(result.outputData?.warnings.length).toBeGreaterThan(0)
  })
})
