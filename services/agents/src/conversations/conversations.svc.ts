import type { Db } from '@moribashi/pg'

export interface Conversation {
  id: string
  organizationId: number
  projectId: string | null
  title: string
  workflowId: string | null
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: string
  text: string
  createdAt: string
}

export default class ConversationsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: string[]; organizationId?: number; projectId?: string | null } = {}) {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (input.idIn?.length) {
      conditions.push('id = ANY(:idIn)')
      params.idIn = input.idIn
    }
    if (input.organizationId != null) {
      conditions.push('organization_id = :organizationId')
      params.organizationId = input.organizationId
    }
    if (input.projectId !== undefined) {
      if (input.projectId === null) {
        conditions.push('project_id IS NULL')
      } else {
        conditions.push('project_id = :projectId')
        params.projectId = input.projectId
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<Conversation>(
      `SELECT id, organization_id, project_id, title, workflow_id, created_at, updated_at FROM conversation ${where} ORDER BY updated_at DESC`,
      params,
    )
    return { results }
  }

  async create(input: { organizationId: number; projectId?: string; title?: string }) {
    const rows = await this.db.query<Conversation>(
      `INSERT INTO conversation (organization_id, project_id, title) VALUES (:organizationId, :projectId, :title) RETURNING id, organization_id, project_id, title, workflow_id, created_at, updated_at`,
      { organizationId: input.organizationId, projectId: input.projectId || null, title: input.title || 'New conversation' },
    )
    return rows[0]
  }

  async update(id: string, input: { title?: string; workflowId?: string }) {
    const sets: string[] = ['updated_at = now()']
    const params: Record<string, unknown> = { id }
    if (input.title !== undefined) {
      sets.push('title = :title')
      params.title = input.title
    }
    if (input.workflowId !== undefined) {
      sets.push('workflow_id = :workflowId')
      params.workflowId = input.workflowId
    }
    const rows = await this.db.query<Conversation>(
      `UPDATE conversation SET ${sets.join(', ')} WHERE id = :id RETURNING id, organization_id, project_id, title, workflow_id, created_at, updated_at`,
      params,
    )
    return rows[0] ?? null
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM conversation WHERE id = :id', { id })
    return true
  }

  async messages(conversationId: string) {
    const results = await this.db.query<Message>(
      `SELECT id, conversation_id, role, text, created_at FROM message WHERE conversation_id = :conversationId ORDER BY created_at ASC`,
      { conversationId },
    )
    return { results }
  }

  async addMessage(input: { conversationId: string; role: string; text: string }) {
    const rows = await this.db.query<Message>(
      `INSERT INTO message (conversation_id, role, text) VALUES (:conversationId, :role, :text) RETURNING id, conversation_id, role, text, created_at`,
      input,
    )
    // Touch the conversation's updated_at
    await this.db.query(`UPDATE conversation SET updated_at = now() WHERE id = :id`, { id: input.conversationId })
    return rows[0]
  }
}
