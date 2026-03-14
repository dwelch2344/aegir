import type { Db } from '@moribashi/pg'

export default class MembershipsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[]; identityIdIn?: number[]; organizationIdIn?: number[] }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('m.id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.identityIdIn?.length) {
      conditions.push('m.identity_id = ANY(:identityIdIn)')
      params.identityIdIn = input.identityIdIn
    }
    if (input.organizationIdIn?.length) {
      conditions.push('m.organization_id = ANY(:organizationIdIn)')
      params.organizationIdIn = input.organizationIdIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      identityId: number
      organizationId: number
    }>(`SELECT m.id, m.identity_id, m.organization_id FROM membership m ${where} ORDER BY m.id`, params)

    return { results }
  }

  async create(input: { identityId: number; organizationId: number; roleIds?: number[] }) {
    const rows = await this.db.query<{
      id: number
      identityId: number
      organizationId: number
    }>(
      `INSERT INTO membership (identity_id, organization_id)
       VALUES (:identityId, :organizationId)
       RETURNING id, identity_id, organization_id`,
      { identityId: input.identityId, organizationId: input.organizationId },
    )
    const membership = rows[0]

    if (membership && input.roleIds?.length) {
      for (const roleId of input.roleIds) {
        await this.db.query(
          `INSERT INTO membership_role (membership_id, role_id) VALUES (:membershipId, :roleId)
           ON CONFLICT (membership_id, role_id) DO NOTHING`,
          { membershipId: membership.id, roleId },
        )
      }
    }

    return membership
  }

  async delete(membershipId: number) {
    const rows = await this.db.query<{ id: number }>(`DELETE FROM membership WHERE id = :membershipId RETURNING id`, {
      membershipId,
    })
    return rows.length > 0
  }

  async getRoles(membershipId: number) {
    return this.db.query<{
      id: number
      key: string
      name: string
    }>(
      `SELECT r.id, r.key, r.name
       FROM role r
       JOIN membership_role mr ON mr.role_id = r.id
       WHERE mr.membership_id = :membershipId
       ORDER BY r.id`,
      { membershipId },
    )
  }

  async assignRole(membershipId: number, roleId: number) {
    await this.db.query(
      `INSERT INTO membership_role (membership_id, role_id) VALUES (:membershipId, :roleId)
       ON CONFLICT (membership_id, role_id) DO NOTHING`,
      { membershipId, roleId },
    )
    return true
  }

  async removeRole(membershipId: number, roleId: number) {
    const rows = await this.db.query<{ membershipId: number }>(
      `DELETE FROM membership_role WHERE membership_id = :membershipId AND role_id = :roleId
       RETURNING membership_id`,
      { membershipId, roleId },
    )
    return rows.length > 0
  }
}
