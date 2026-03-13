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

  /** Upsert organizations from Keycloak. Matches on keycloak_id or key, inserts if new. Skips protected orgs. */
  async sync(inputs: { keycloakId: string; key: string; name: string }[]) {
    const results: { id: number; key: string; name: string; keycloakId: string | null }[] = []

    for (const input of inputs) {
      // Claim existing row by key (e.g. seeded before keycloak_id was set) — skip protected orgs
      const claimed = await this.db.query<{
        id: number; key: string; name: string; keycloakId: string | null
      }>(
        `UPDATE organization SET keycloak_id = :keycloakId, name = :name, updated_at = now()
         WHERE key = :key AND protected = false AND (keycloak_id IS NULL OR keycloak_id LIKE 'kc-placeholder-%' OR keycloak_id = :keycloakId)
         RETURNING id, key, name, keycloak_id`,
        { keycloakId: input.keycloakId, key: input.key, name: input.name },
      )
      if (claimed[0]) { results.push(claimed[0]); continue }

      // Otherwise upsert by keycloak_id
      const rows = await this.db.query<{
        id: number; key: string; name: string; keycloakId: string | null
      }>(
        `INSERT INTO organization (keycloak_id, key, name)
         VALUES (:keycloakId, :key, :name)
         ON CONFLICT (keycloak_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id, key, name, keycloak_id`,
        { keycloakId: input.keycloakId, key: input.key, name: input.name },
      )
      if (rows[0]) results.push(rows[0])
    }

    return results
  }
}
