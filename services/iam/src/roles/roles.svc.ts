import type { Db } from '@moribashi/pg'

export default class RolesService {
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
    }>(`SELECT id, key, name FROM role ${where} ORDER BY id`, params)

    return { results }
  }

  async create(input: { key: string; name: string }) {
    const rows = await this.db.query<{ id: number; key: string; name: string }>(
      `INSERT INTO role (key, name) VALUES (:key, :name) RETURNING id, key, name`,
      input,
    )
    return rows[0]
  }

  async getPermissions(roleId: number) {
    return this.db.query<{
      id: number
      roleId: number
      permission: string
      relationshipType: string
    }>(`SELECT id, role_id, permission, relationship_type FROM role_permission WHERE role_id = :roleId ORDER BY id`, {
      roleId,
    })
  }

  async addPermission(input: { roleId: number; permission: string; relationshipType: string }) {
    const rows = await this.db.query<{
      id: number
      roleId: number
      permission: string
      relationshipType: string
    }>(
      `INSERT INTO role_permission (role_id, permission, relationship_type)
       VALUES (:roleId, :permission, :relationshipType)
       ON CONFLICT (role_id, permission, relationship_type) DO NOTHING
       RETURNING id, role_id, permission, relationship_type`,
      input,
    )
    return rows[0] ?? null
  }

  async removePermission(input: { roleId: number; permission: string; relationshipType: string }) {
    const rows = await this.db.query<{ id: number }>(
      `DELETE FROM role_permission
       WHERE role_id = :roleId AND permission = :permission AND relationship_type = :relationshipType
       RETURNING id`,
      input,
    )
    return rows.length > 0
  }
}
