import { config } from '../config.js'

export type ContractStatus =
  | 'contract_requested'
  | 'agent_signed'
  | 'hf_signed'
  | 'fully_signed'
  | 'ready_to_sell'

interface UpdateContractStatusInput {
  contractId: string
  agentNpn: string
  status: ContractStatus
  carrierName: string
  states?: string[]
  writingNumber?: string
  effectiveDate?: string
}

/**
 * Agent Intel API client.
 *
 * When AGENT_INTEL_URL is not configured (empty or default localhost),
 * operations are logged but not executed. This allows the workflow to
 * run end-to-end in dev without a live Agent Intel instance.
 */
export async function updateContractStatus(input: UpdateContractStatusInput): Promise<{ updated: boolean }> {
  const { baseUrl, apiKey } = config.agentIntel

  if (!baseUrl || baseUrl === 'http://localhost:9090') {
    console.log(`[agent-intel] (not configured) Would update contract ${input.contractId} to "${input.status}" for NPN ${input.agentNpn}`)
    return { updated: true }
  }

  const res = await fetch(`${baseUrl}/api/contracts/${input.contractId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      status: input.status,
      agentNpn: input.agentNpn,
      carrierName: input.carrierName,
      states: input.states,
      writingNumber: input.writingNumber,
      effectiveDate: input.effectiveDate,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Agent Intel update failed (${res.status}): ${body}`)
  }

  return { updated: true }
}
