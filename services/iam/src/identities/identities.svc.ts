import type { Db } from '@moribashi/pg'

export default class IdentitiesService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: number[]; labelLike?: string; emailLike?: string }) {
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
    if (input.emailLike) {
      conditions.push('email ILIKE :emailPattern')
      params.emailPattern = `%${input.emailLike}%`
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<{
      id: number
      type: string
      label: string
      email: string
      keycloakId: string | null
      organizationId: number | null
    }>(`SELECT id, type, label, email, keycloak_id, organization_id FROM identity ${where} ORDER BY id`, params)

    return { results }
  }

  /** Upsert identities from Keycloak. Matches on keycloak_id or email, inserts if new. */
  async sync(inputs: { keycloakId: string; label: string; email: string }[]) {
    const results: {
      id: number
      type: string
      label: string
      email: string
      keycloakId: string | null
      organizationId: number | null
    }[] = []

    for (const input of inputs) {
      // Claim existing row by email (e.g. seeded before keycloak_id was set)
      const claimed = await this.db.query<{
        id: number
        type: string
        label: string
        email: string
        keycloakId: string | null
        organizationId: number | null
      }>(
        `UPDATE identity SET keycloak_id = :keycloakId, label = :label, updated_at = now()
         WHERE email = :email AND (keycloak_id IS NULL OR keycloak_id LIKE 'kc-placeholder-%' OR keycloak_id = :keycloakId)
         RETURNING id, type, label, email, keycloak_id, organization_id`,
        { keycloakId: input.keycloakId, label: input.label, email: input.email },
      )
      if (claimed[0]) {
        results.push(claimed[0])
        continue
      }

      // Otherwise upsert by keycloak_id
      const rows = await this.db.query<{
        id: number
        type: string
        label: string
        email: string
        keycloakId: string | null
        organizationId: number | null
      }>(
        `INSERT INTO identity (keycloak_id, label, email, type)
         VALUES (:keycloakId, :label, :email, 'USER')
         ON CONFLICT (keycloak_id) DO UPDATE SET label = EXCLUDED.label, email = EXCLUDED.email, updated_at = now()
         RETURNING id, type, label, email, keycloak_id, organization_id`,
        { keycloakId: input.keycloakId, label: input.label, email: input.email },
      )
      if (rows[0]) results.push(rows[0])
    }

    return results
  }
}
