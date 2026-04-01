import type { Db } from '@moribashi/pg'

export default class OrganizationsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[]; keycloakIdIn?: string[]; keyLike?: string; nameLike?: string }) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.keycloakIdIn?.length) {
      conditions.push('keycloak_id = ANY(:keycloakIdIn)')
      params.keycloakIdIn = input.keycloakIdIn
    }
    if (input.keyLike) {
      conditions.push('key ILIKE :keyPattern')
      params.keyPattern = `%${input.keyLike}%`
    }
    if (input.nameLike) {
      conditions.push('name ILIKE :namePattern')
      params.namePattern = `%${input.nameLike}%`
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      key: string
      name: string
      keycloakId: string | null
      protected: boolean
    }>(`SELECT id, key, name, keycloak_id, protected FROM organization ${where} ORDER BY id`, params)

    return { results }
  }

  /** Upsert organizations from Keycloak. Matches on keycloak_id or key, inserts if new. Skips protected orgs.
   *  Auto-creates SELF + SYS_CHILD relationships for new orgs. */
  async sync(inputs: { keycloakId: string; key: string; name: string }[]) {
    const results: { id: number; key: string; name: string; keycloakId: string | null }[] = []

    for (const input of inputs) {
      // Claim existing row by key (e.g. seeded before keycloak_id was set) — skip protected orgs
      const claimed = await this.db.query<{
        id: number
        key: string
        name: string
        keycloakId: string | null
      }>(
        `UPDATE organization SET keycloak_id = :keycloakId, name = :name, updated_at = now()
         WHERE key = :key AND protected = false AND (keycloak_id IS NULL OR keycloak_id LIKE 'kc-placeholder-%' OR keycloak_id = :keycloakId)
         RETURNING id, key, name, keycloak_id`,
        { keycloakId: input.keycloakId, key: input.key, name: input.name },
      )
      if (claimed[0]) {
        await this.ensureRelationships(claimed[0].id)
        results.push(claimed[0])
        continue
      }

      // Otherwise upsert by keycloak_id
      const rows = await this.db.query<{
        id: number
        key: string
        name: string
        keycloakId: string | null
      }>(
        `INSERT INTO organization (keycloak_id, key, name)
         VALUES (:keycloakId, :key, :name)
         ON CONFLICT (keycloak_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id, key, name, keycloak_id`,
        { keycloakId: input.keycloakId, key: input.key, name: input.name },
      )
      if (rows[0]) {
        await this.ensureRelationships(rows[0].id)
        results.push(rows[0])
      }
    }

    return results
  }

  /** Ensure an org has SELF + SYS_CHILD (from system org) relationships */
  private async ensureRelationships(orgId: number) {
    // SELF relationship
    await this.db.query(
      `INSERT INTO org_relationship (owner_org_id, related_org_id, relationship_type)
       VALUES (:orgId, :orgId, 'SELF')
       ON CONFLICT (owner_org_id, related_org_id, relationship_type) DO NOTHING`,
      { orgId },
    )
    // SYS_CHILD: system org (id=1) is parent of this org (skip for system org itself)
    if (orgId !== 1) {
      await this.db.query(
        `INSERT INTO org_relationship (owner_org_id, related_org_id, relationship_type)
         VALUES (:orgId, 1, 'SYS_CHILD')
         ON CONFLICT (owner_org_id, related_org_id, relationship_type) DO NOTHING`,
        { orgId },
      )
    }
  }
}
