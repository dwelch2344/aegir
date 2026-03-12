import { describe, it, expect, vi } from 'vitest'
import { handleShCreateSirconAffiliation } from './sh-create-sircon-affiliation.js'
import { handleShCarrierProcessing } from './sh-carrier-processing.js'
import { createMockTask } from '../test-helpers.js'

describe('handleShCreateSirconAffiliation', () => {
  it('returns COMPLETED with affiliation ID', async () => {
    const result = await handleShCreateSirconAffiliation(createMockTask({
      agentNpn: '12345',
      agentLastName: 'Smith',
      contractId: 'sh-aca-1',
    }))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.affiliationId).toMatch(/^sircon-/)
    expect(result.outputData?.contractId).toBe('sh-aca-1')
    expect(result.outputData?.status).toBe('created')
  })
})

describe('handleShCarrierProcessing', () => {
  it('returns COMPLETED with processing flags', async () => {
    const result = await handleShCarrierProcessing(createMockTask({
      contractId: 'sh-aca-1',
      agentFullName: 'Jane Smith',
    }))
    expect(result.status).toBe('COMPLETED')
    expect(result.outputData?.carrierProcessed).toBe(true)
    expect(result.outputData?.documentsDistributed).toBe(true)
  })
})
