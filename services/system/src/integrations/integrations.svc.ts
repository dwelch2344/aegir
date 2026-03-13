import type { Db } from '@moribashi/pg'

export default class IntegrationsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[]; keyIn?: string[] }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.keyIn?.length) {
      conditions.push('key = ANY(:keyIn)')
      params.keyIn = input.keyIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      key: string
      name: string
      metadata: string
    }>(`SELECT id, key, name, metadata FROM integration ${where} ORDER BY id`, params)

    return { results }
  }

  async getById(id: number) {
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
      metadata: string
    }>('SELECT id, key, name, metadata FROM integration WHERE id = :id', { id })

    return rows[0] ?? null
  }

  async upsert(input: { key: string; name: string; metadata?: string }) {
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
      metadata: string
    }>(
      `INSERT INTO integration (key, name, metadata)
       VALUES (:key, :name, :metadata)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, updated_at = now()
       RETURNING id, key, name, metadata`,
      { key: input.key, name: input.name, metadata: input.metadata ?? '{}' },
    )
    return rows[0]!
  }
}
