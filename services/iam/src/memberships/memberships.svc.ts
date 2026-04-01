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
    // Enforce owner limit: max 2 orgs where identity holds the Owner role
    const ownerRoleId = 1 // Owner role is always id=1
    if (input.roleIds?.includes(ownerRoleId)) {
      const ownerCount = await this.countOwnerMemberships(input.identityId)
      if (ownerCount >= 2) {
        throw new Error('An identity can be Owner of at most 2 organizations')
      }
    }

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
    // Enforce owner limit when assigning Owner role
    const ownerRoleId = 1
    if (roleId === ownerRoleId) {
      // Look up the identity for this membership
      const mship = await this.db.query<{ identityId: number }>(
        `SELECT identity_id FROM membership WHERE id = :membershipId`,
        { membershipId },
      )
      if (mship[0]) {
        const ownerCount = await this.countOwnerMemberships(mship[0].identityId)
        if (ownerCount >= 2) {
          throw new Error('An identity can be Owner of at most 2 organizations')
        }
      }
    }

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

  /** Count how many orgs this identity holds the Owner role in */
  private async countOwnerMemberships(identityId: number): Promise<number> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM membership m
       JOIN membership_role mr ON mr.membership_id = m.id
       WHERE m.identity_id = :identityId AND mr.role_id = 1`,
      { identityId },
    )
    return parseInt(rows[0]?.count ?? '0', 10)
  }
}
