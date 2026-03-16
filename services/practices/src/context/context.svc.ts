import type { Db } from '@moribashi/pg'

function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) (out as any)[k] = v.toISOString()
  }
  return out
}

export interface ContextFile {
  id: string
  organizationId: number
  tier: string
  path: string
  description: string
  content: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ContextTopic {
  id: string
  organizationId: number
  topicId: string
  systemPath: string
  projectPath: string
  systemContent: string | null
  projectContent: string | null
  triggerFiles: string[]
  triggerKeywords: string[]
  triggerCatalogRefs: string[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default class ContextService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  // --- Context Files ---

  async searchFiles(input: { organizationId?: number; tier?: string } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }
    if (input.tier) {
      conditions.push('tier = :tier')
      params.tier = input.tier
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<ContextFile>(
      `SELECT id, organization_id, tier, path, description, content, sort_order, created_at, updated_at
       FROM context_file ${where} ORDER BY sort_order, path`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async upsertFile(input: {
    organizationId: number
    tier: string
    path: string
    description?: string
    content?: string | null
  }) {
    const rows = await this.db.query<ContextFile>(
      `INSERT INTO context_file (organization_id, tier, path, description, content)
       VALUES (:organizationId, :tier, :path, :description, :content)
       ON CONFLICT (organization_id, tier, path)
       DO UPDATE SET description = COALESCE(EXCLUDED.description, context_file.description),
                     content = COALESCE(EXCLUDED.content, context_file.content),
                     updated_at = now()
       RETURNING id, organization_id, tier, path, description, content, sort_order, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        tier: input.tier,
        path: input.path,
        description: input.description ?? '',
        content: input.content ?? null,
      },
    )
    return serializeDates(rows[0])
  }

  async updateFileContent(id: string, content: string) {
    const rows = await this.db.query<ContextFile>(
      `UPDATE context_file SET content = :content, updated_at = now() WHERE id = :id
       RETURNING id, organization_id, tier, path, description, content, sort_order, created_at, updated_at`,
      { id, content },
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async deleteFile(id: string) {
    await this.db.query('DELETE FROM context_file WHERE id = :id', { id })
    return true
  }

  // --- Context Topics ---

  async searchTopics(input: { organizationId?: number } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<ContextTopic>(
      `SELECT id, organization_id, topic_id, system_path, project_path, system_content, project_content,
              trigger_files, trigger_keywords, trigger_catalog_refs, sort_order, created_at, updated_at
       FROM context_topic ${where} ORDER BY sort_order, topic_id`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async upsertTopic(input: {
    organizationId: number
    topicId: string
    systemPath?: string
    projectPath?: string
    systemContent?: string | null
    projectContent?: string | null
    triggerFiles?: string[]
    triggerKeywords?: string[]
    triggerCatalogRefs?: string[]
  }) {
    const rows = await this.db.query<ContextTopic>(
      `INSERT INTO context_topic (organization_id, topic_id, system_path, project_path, system_content, project_content,
                                   trigger_files, trigger_keywords, trigger_catalog_refs)
       VALUES (:organizationId, :topicId, :systemPath, :projectPath, :systemContent, :projectContent,
               :triggerFiles, :triggerKeywords, :triggerCatalogRefs)
       ON CONFLICT (organization_id, topic_id)
       DO UPDATE SET system_path = COALESCE(EXCLUDED.system_path, context_topic.system_path),
                     project_path = COALESCE(EXCLUDED.project_path, context_topic.project_path),
                     system_content = COALESCE(EXCLUDED.system_content, context_topic.system_content),
                     project_content = COALESCE(EXCLUDED.project_content, context_topic.project_content),
                     trigger_files = COALESCE(EXCLUDED.trigger_files, context_topic.trigger_files),
                     trigger_keywords = COALESCE(EXCLUDED.trigger_keywords, context_topic.trigger_keywords),
                     trigger_catalog_refs = COALESCE(EXCLUDED.trigger_catalog_refs, context_topic.trigger_catalog_refs),
                     updated_at = now()
       RETURNING id, organization_id, topic_id, system_path, project_path, system_content, project_content,
                 trigger_files, trigger_keywords, trigger_catalog_refs, sort_order, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        topicId: input.topicId,
        systemPath: input.systemPath ?? '',
        projectPath: input.projectPath ?? '',
        systemContent: input.systemContent ?? null,
        projectContent: input.projectContent ?? null,
        triggerFiles: input.triggerFiles ?? [],
        triggerKeywords: input.triggerKeywords ?? [],
        triggerCatalogRefs: input.triggerCatalogRefs ?? [],
      },
    )
    return serializeDates(rows[0])
  }

  async updateTopicContent(id: string, input: { systemContent?: string; projectContent?: string }) {
    const sets: string[] = ['updated_at = now()']
    const params: Record<string, unknown> = { id }

    if (input.systemContent !== undefined) {
      sets.push('system_content = :systemContent')
      params.systemContent = input.systemContent
    }
    if (input.projectContent !== undefined) {
      sets.push('project_content = :projectContent')
      params.projectContent = input.projectContent
    }

    const rows = await this.db.query<ContextTopic>(
      `UPDATE context_topic SET ${sets.join(', ')} WHERE id = :id
       RETURNING id, organization_id, topic_id, system_path, project_path, system_content, project_content,
                 trigger_files, trigger_keywords, trigger_catalog_refs, sort_order, created_at, updated_at`,
      params,
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async deleteTopic(id: string) {
    await this.db.query('DELETE FROM context_topic WHERE id = :id', { id })
    return true
  }
}
