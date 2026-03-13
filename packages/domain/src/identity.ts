export type IdentityType = 'USER' | 'SUPER_USER' | 'SERVICE_ACCOUNT'

export interface Identity {
  id: number
  type: IdentityType
  label: string
  email: string
  organizationId?: number
}
