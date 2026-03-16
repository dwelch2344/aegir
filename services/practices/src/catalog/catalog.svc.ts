import type { Db } from '@moribashi/pg'

function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) (out as any)[k] = v.toISOString()
  }
  return out
}

export interface CatalogEntry {
  id: string
  organizationId: number
  patternId: string
  name: string
  version: string
  description: string
  preconditions: string[]
  provides: string[]
  parameters: Record<string, unknown>
  applicationInstructions: string
  testCriteria: string
  createdAt: string
  updatedAt: string
}

export default class CatalogService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { organizationId?: number; idIn?: string[]; patternIdIn?: string[] } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }
    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.patternIdIn?.length) {
      conditions.push('pattern_id = ANY(:patternIdIn)')
      params.patternIdIn = input.patternIdIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<CatalogEntry>(
      `SELECT id, organization_id, pattern_id, name, version, description, preconditions, provides,
              parameters, application_instructions, test_criteria, created_at, updated_at
       FROM catalog_entry ${where} ORDER BY pattern_id`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async upsert(input: {
    organizationId: number
    patternId: string
    name: string
    version?: string
    description?: string
    preconditions?: string[]
    provides?: string[]
    parameters?: Record<string, unknown>
    applicationInstructions?: string
    testCriteria?: string
  }) {
    const rows = await this.db.query<CatalogEntry>(
      `INSERT INTO catalog_entry (organization_id, pattern_id, name, version, description, preconditions, provides,
                                   parameters, application_instructions, test_criteria)
       VALUES (:organizationId, :patternId, :name, :version, :description, :preconditions, :provides,
               :parameters, :applicationInstructions, :testCriteria)
       ON CONFLICT (organization_id, pattern_id)
       DO UPDATE SET name = EXCLUDED.name,
                     version = EXCLUDED.version,
                     description = EXCLUDED.description,
                     preconditions = EXCLUDED.preconditions,
                     provides = EXCLUDED.provides,
                     parameters = EXCLUDED.parameters,
                     application_instructions = EXCLUDED.application_instructions,
                     test_criteria = EXCLUDED.test_criteria,
                     updated_at = now()
       RETURNING id, organization_id, pattern_id, name, version, description, preconditions, provides,
                 parameters, application_instructions, test_criteria, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        patternId: input.patternId,
        name: input.name,
        version: input.version ?? '0.0.0',
        description: input.description ?? '',
        preconditions: input.preconditions ?? [],
        provides: input.provides ?? [],
        parameters: JSON.stringify(input.parameters ?? {}),
        applicationInstructions: input.applicationInstructions ?? '',
        testCriteria: input.testCriteria ?? '',
      },
    )
    return serializeDates(rows[0])
  }

  async update(id: string, input: Record<string, unknown>) {
    const sets: string[] = ['updated_at = now()']
    const params: Record<string, unknown> = { id }

    if (input.name !== undefined) {
      sets.push('name = :name')
      params.name = input.name
    }
    if (input.version !== undefined) {
      sets.push('version = :version')
      params.version = input.version
    }
    if (input.description !== undefined) {
      sets.push('description = :description')
      params.description = input.description
    }
    if (input.applicationInstructions !== undefined) {
      sets.push('application_instructions = :applicationInstructions')
      params.applicationInstructions = input.applicationInstructions
    }
    if (input.testCriteria !== undefined) {
      sets.push('test_criteria = :testCriteria')
      params.testCriteria = input.testCriteria
    }

    const rows = await this.db.query<CatalogEntry>(
      `UPDATE catalog_entry SET ${sets.join(', ')} WHERE id = :id
       RETURNING id, organization_id, pattern_id, name, version, description, preconditions, provides,
                 parameters, application_instructions, test_criteria, created_at, updated_at`,
      params,
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM catalog_entry WHERE id = :id', { id })
    return true
  }
}
