import type { Db } from '@moribashi/pg'

export default class IdentitiesService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[]; labelLike?: string }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.labelLike) {
      conditions.push('label ILIKE :labelPattern')
      params.labelPattern = `%${input.labelLike}%`
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      type: string
      label: string
      email: string
      organizationId: number | null
    }>(`SELECT id, type, label, email, organization_id FROM identity ${where} ORDER BY id`, params)

    return { results }
  }
}
