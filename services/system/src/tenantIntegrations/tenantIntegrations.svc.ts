import type { Db } from '@moribashi/pg'

export default class TenantIntegrationsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async listByTenantId(tenantId: number) {
    return this.db.query<{
      integrationId: number
      integrationKey: string
      status: string
      name: string
      metadata: string
      ordinal: number | null
    }>(
      `SELECT
         ti.integration_id,
         i.key AS integration_key,
         ti.status,
         ti.name,
         ti.metadata,
         ti.ordinal
       FROM tenant_integration ti
       JOIN integration i ON i.id = ti.integration_id
       WHERE ti.tenant_id = :tenantId
       ORDER BY ti.ordinal NULLS LAST, i.key`,
      { tenantId },
    )
  }

  async upsert(
    tenantId: number,
    input: {
      integrationKey: string
      status?: string
      name?: string
      metadata?: string
      ordinal?: number
    },
  ) {
    // Resolve integration by key
    const integrations = await this.db.query<{ id: number; name: string }>(
      'SELECT id, name FROM integration WHERE key = :key',
      { key: input.integrationKey },
    )
    if (!integrations[0]) throw new Error(`Integration not found: ${input.integrationKey}`)
    const integration = integrations[0]

    const rows = await this.db.query<{
      integrationId: number
      integrationKey: string
      status: string
      name: string
      metadata: string
      ordinal: number | null
    }>(
      `INSERT INTO tenant_integration (tenant_id, integration_id, status, name, metadata, ordinal)
       VALUES (:tenantId, :integrationId, :status, :name, :metadata, :ordinal)
       ON CONFLICT (tenant_id, integration_id) DO UPDATE SET
         status = COALESCE(EXCLUDED.status, tenant_integration.status),
         name = COALESCE(EXCLUDED.name, tenant_integration.name),
         metadata = COALESCE(EXCLUDED.metadata, tenant_integration.metadata),
         ordinal = COALESCE(EXCLUDED.ordinal, tenant_integration.ordinal),
         updated_at = now()
       RETURNING
         integration_id,
         :integrationKey AS integration_key,
         status,
         name,
         metadata,
         ordinal`,
      {
        tenantId,
        integrationId: integration.id,
        integrationKey: input.integrationKey,
        status: input.status ?? 'PENDING',
        name: input.name ?? integration.name,
        metadata: input.metadata ?? '{}',
        ordinal: input.ordinal ?? null,
      },
    )
    return rows[0]!
  }
}
