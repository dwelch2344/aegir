import type { Db } from '@moribashi/pg'

function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) (out as any)[k] = v.toISOString()
  }
  return out
}

export interface BcpCategory {
  id: string
  organizationId: number
  categoryId: string
  label: string
  color: string
  description: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface BcpEntry {
  id: string
  categoryId: string
  organizationId: number
  entryId: string
  title: string
  description: string
  content: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default class BcpService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  // --- Categories ---

  async searchCategories(input: { organizationId?: number } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<BcpCategory>(
      `SELECT id, organization_id, category_id, label, color, description, sort_order, created_at, updated_at
       FROM bcp_category ${where} ORDER BY sort_order, label`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async upsertCategory(input: {
    organizationId: number
    categoryId: string
    label: string
    color?: string
    description?: string
    sortOrder?: number
  }) {
    const rows = await this.db.query<BcpCategory>(
      `INSERT INTO bcp_category (organization_id, category_id, label, color, description, sort_order)
       VALUES (:organizationId, :categoryId, :label, :color, :description, :sortOrder)
       ON CONFLICT (organization_id, category_id)
       DO UPDATE SET label = EXCLUDED.label,
                     color = EXCLUDED.color,
                     description = EXCLUDED.description,
                     sort_order = EXCLUDED.sort_order,
                     updated_at = now()
       RETURNING id, organization_id, category_id, label, color, description, sort_order, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        categoryId: input.categoryId,
        label: input.label,
        color: input.color ?? 'gray',
        description: input.description ?? '',
        sortOrder: input.sortOrder ?? 0,
      },
    )
    return serializeDates(rows[0])
  }

  async deleteCategory(id: string) {
    await this.db.query('DELETE FROM bcp_category WHERE id = :id', { id })
    return true
  }

  // --- Entries ---

  async searchEntries(input: { organizationId?: number; categoryIdIn?: string[] } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }
    if (input.categoryIdIn?.length) {
      conditions.push('category_id = ANY(:categoryIdIn)')
      params.categoryIdIn = input.categoryIdIn
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<BcpEntry>(
      `SELECT id, category_id, organization_id, entry_id, title, description, content, sort_order, created_at, updated_at
       FROM bcp_entry ${where} ORDER BY sort_order, title`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async upsertEntry(input: {
    organizationId: number
    categoryId: string
    entryId: string
    title: string
    description?: string
    content?: string | null
  }) {
    const rows = await this.db.query<BcpEntry>(
      `INSERT INTO bcp_entry (category_id, organization_id, entry_id, title, description, content)
       VALUES (:categoryId, :organizationId, :entryId, :title, :description, :content)
       ON CONFLICT (organization_id, entry_id)
       DO UPDATE SET category_id = EXCLUDED.category_id,
                     title = EXCLUDED.title,
                     description = COALESCE(EXCLUDED.description, bcp_entry.description),
                     content = COALESCE(EXCLUDED.content, bcp_entry.content),
                     updated_at = now()
       RETURNING id, category_id, organization_id, entry_id, title, description, content, sort_order, created_at, updated_at`,
      {
        categoryId: input.categoryId,
        organizationId: input.organizationId,
        entryId: input.entryId,
        title: input.title,
        description: input.description ?? '',
        content: input.content ?? null,
      },
    )
    return serializeDates(rows[0])
  }

  async updateEntryContent(id: string, content: string) {
    const rows = await this.db.query<BcpEntry>(
      `UPDATE bcp_entry SET content = :content, updated_at = now() WHERE id = :id
       RETURNING id, category_id, organization_id, entry_id, title, description, content, sort_order, created_at, updated_at`,
      { id, content },
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async deleteEntry(id: string) {
    await this.db.query('DELETE FROM bcp_entry WHERE id = :id', { id })
    return true
  }
}
