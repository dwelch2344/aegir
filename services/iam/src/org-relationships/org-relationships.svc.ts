import type { Db } from '@moribashi/pg'

export default class OrgRelationshipsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { ownerOrgIdIn?: number[]; relatedOrgIdIn?: number[]; relationshipTypeIn?: string[] }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.ownerOrgIdIn?.length) {
      conditions.push('owner_org_id = ANY(:ownerOrgIdIn)')
      params.ownerOrgIdIn = input.ownerOrgIdIn
    }
    if (input.relatedOrgIdIn?.length) {
      conditions.push('related_org_id = ANY(:relatedOrgIdIn)')
      params.relatedOrgIdIn = input.relatedOrgIdIn
    }
    if (input.relationshipTypeIn?.length) {
      conditions.push('relationship_type = ANY(:relationshipTypeIn)')
      params.relationshipTypeIn = input.relationshipTypeIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      ownerOrgId: number
      relatedOrgId: number
      relationshipType: string
    }>(`SELECT id, owner_org_id, related_org_id, relationship_type FROM org_relationship ${where} ORDER BY id`, params)

    return { results }
  }

  async create(input: { ownerOrgId: number; relatedOrgId: number; relationshipType: string }) {
    const rows = await this.db.query<{
      id: number
      ownerOrgId: number
      relatedOrgId: number
      relationshipType: string
    }>(
      `INSERT INTO org_relationship (owner_org_id, related_org_id, relationship_type)
       VALUES (:ownerOrgId, :relatedOrgId, :relationshipType)
       ON CONFLICT (owner_org_id, related_org_id, relationship_type) DO NOTHING
       RETURNING id, owner_org_id, related_org_id, relationship_type`,
      input,
    )
    return rows[0] ?? null
  }

  async delete(id: number) {
    const rows = await this.db.query<{ id: number }>(`DELETE FROM org_relationship WHERE id = :id RETURNING id`, { id })
    return rows.length > 0
  }

  /** Walk org relationships transitively from a starting org for a given relationship type */
  async resolveTransitive(orgId: number, relationshipType: string) {
    return this.db.query<{
      id: number
      ownerOrgId: number
      relatedOrgId: number
      relationshipType: string
    }>(
      `WITH RECURSIVE chain AS (
         SELECT id, owner_org_id, related_org_id, relationship_type
         FROM org_relationship
         WHERE related_org_id = :orgId AND relationship_type = :relationshipType
         UNION
         SELECT r.id, r.owner_org_id, r.related_org_id, r.relationship_type
         FROM org_relationship r
         JOIN chain c ON r.related_org_id = c.owner_org_id
         WHERE r.relationship_type = :relationshipType
       )
       SELECT id, owner_org_id, related_org_id, relationship_type FROM chain`,
      { orgId, relationshipType },
    )
  }
}
