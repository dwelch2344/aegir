export type TenantIntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ERROR' | 'SUSPENDED'

export interface TenantIntegration {
  tenantId: number
  integrationId: number
  integrationKey: string
  status: TenantIntegrationStatus
  name: string
  metadata: string
  ordinal: number | null
}
