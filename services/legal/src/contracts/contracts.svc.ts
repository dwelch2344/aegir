import type { Db } from '@moribashi/pg'

export default class ContractsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async findAll(organizationId: number) {
    return this.db.query<{
      id: string
      organizationId: number
      status: string
      carrierId: string
      carrierName: string
      createdAt: string
      updatedAt: string
    }>('SELECT id, organization_id, status, carrier_id, carrier_name, created_at, updated_at FROM contract WHERE organization_id = :organizationId ORDER BY created_at DESC', { organizationId })
  }

  async findById(id: string) {
    const results = await this.db.query<{
      id: string
      organizationId: number
      status: string
      carrierId: string
      carrierName: string
      createdAt: string
      updatedAt: string
    }>('SELECT id, organization_id, status, carrier_id, carrier_name, created_at, updated_at FROM contract WHERE id = :id', { id })

    return results[0] ?? null
  }
}
