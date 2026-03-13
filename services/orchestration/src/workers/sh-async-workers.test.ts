import { describe, expect, it, vi } from 'vitest'
import { createMockTask } from '../test-helpers.js'

// Mock external dependencies before importing the workers
vi.mock('../integrations/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, messageId: '<test@local>' }),
}))

vi.mock('../integrations/agent-intel.js', () => ({
  updateContractStatus: vi.fn().mockResolvedValue({ updated: true }),
}))

import { updateContractStatus } from '../integrations/agent-intel.js'
import { sendEmail } from '../integrations/email.js'
import { handleShAgentSignsDocusign } from './sh-agent-signs-docusign.js'
import { handleShFinalizeContract } from './sh-finalize-contract.js'
import { handleShHfCountersignAndTraining } from './sh-hf-countersign-and-training.js'
import { handleShRequestContract } from './sh-request-contract.js'

describe('handleShRequestContract', () => {
  it('sends email and updates status', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await handleShRequestContract(
      createMockTask({
        agentFirstName: 'Jane',
        agentLastName: 'Smith',
        agentEmail: 'jane@test.com',
        agentPhone: '555-1234',
        agentNpn: 'NPN123',
        approvedStates: ['UT'],
        contractId: 'sh-aca-1',
      }),
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.emailSent).toBe(true)
    expect(result.outputData?.agentIntelStatus).toBe('contract_requested')
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(updateContractStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'contract_requested', contractId: 'sh-aca-1' }),
    )
    vi.restoreAllMocks()
  })

  it('returns FAILED when email throws', async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP down'))
    const result = await handleShRequestContract(
      createMockTask({
        agentFirstName: 'Jane',
        agentLastName: 'Smith',
        agentEmail: 'jane@test.com',
        agentPhone: '555-1234',
        approvedStates: ['UT'],
        contractId: 'sh-aca-1',
      }),
    )
    expect(result.status).toBe('FAILED')
    expect(result.outputData?.error).toBe('SMTP down')
  })
})

describe('handleShAgentSignsDocusign', () => {
  it('updates status to agent_signed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await handleShAgentSignsDocusign(
      createMockTask({
        agentEmail: 'jane@test.com',
        agentFullName: 'Jane Smith',
        agentNpn: 'NPN123',
        contractId: 'sh-aca-1',
      }),
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.docusignStatus).toBe('agent_signed')
    expect(updateContractStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'agent_signed' }))
    vi.restoreAllMocks()
  })
})

describe('handleShHfCountersignAndTraining', () => {
  it('updates status through hf_signed to fully_signed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await handleShHfCountersignAndTraining(
      createMockTask({
        agentEmail: 'jane@test.com',
        agentFullName: 'Jane Smith',
        agentNpn: 'NPN123',
        contractId: 'sh-aca-1',
      }),
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.docusignStatus).toBe('fully_signed')
    expect(result.outputData?.trainingComplete).toBe(true)
    // Called twice: hf_signed then fully_signed
    const calls = vi.mocked(updateContractStatus).mock.calls
    const statuses = calls.map((c) => c[0].status)
    expect(statuses).toContain('hf_signed')
    expect(statuses).toContain('fully_signed')
    vi.restoreAllMocks()
  })
})

describe('handleShFinalizeContract', () => {
  it('finalizes contract and sends RTS email', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.mocked(sendEmail).mockResolvedValue({ sent: true, messageId: '<rts@local>' })
    const result = await handleShFinalizeContract(
      createMockTask({
        agentEmail: 'jane@test.com',
        agentFullName: 'Jane Smith',
        agentNpn: 'NPN123',
        contractId: 'sh-aca-1',
        approvedStates: ['UT', 'ID'],
      }),
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.status).toBe('ready_to_sell')
    expect(result.outputData?.writingNumber).toBeDefined()
    expect(updateContractStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready_to_sell' }))
    expect(sendEmail).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
