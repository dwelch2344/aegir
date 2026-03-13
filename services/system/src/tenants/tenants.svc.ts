import type { Db } from '@moribashi/pg'

export default class TenantsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async getByKey(key: string) {
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
    }>('SELECT id, key, name FROM tenant WHERE key = :key', { key })

    if (!rows[0]) throw new Error(`Tenant not found: ${key}`)
    return rows[0]
  }

  async getById(id: number) {
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
    }>('SELECT id, key, name FROM tenant WHERE id = :id', { id })

    return rows[0] ?? null
  }

  async create(input: { key: string; name: string }) {
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
    }>(`INSERT INTO tenant (key, name) VALUES (:key, :name) RETURNING id, key, name`, {
      key: input.key,
      name: input.name,
    })
    return rows[0]!
  }

  async update(key: string, input: { name?: string }) {
    const sets: string[] = []
    const params: Record<string, unknown> = { key }

    if (input.name !== undefined) {
      sets.push('name = :name')
      params.name = input.name
    }

    if (!sets.length) return this.getByKey(key)

    sets.push('updated_at = now()')
    const rows = await this.db.query<{
      id: number
      key: string
      name: string
    }>(`UPDATE tenant SET ${sets.join(', ')} WHERE key = :key RETURNING id, key, name`, params)

    if (!rows[0]) throw new Error(`Tenant not found: ${key}`)
    return rows[0]
  }
}
