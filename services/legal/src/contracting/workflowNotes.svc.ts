import type { Db } from '@moribashi/pg'

export interface WorkflowTaskNote {
  id: string
  authorIdentityId: number
  content: string
  visibility: string
  createdAt: string
  updatedAt: string
}

export default class WorkflowNotesService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async findByWorkflowTask(workflowId: string, taskName: string): Promise<WorkflowTaskNote[]> {
    return this.db.query<WorkflowTaskNote>(
      `SELECT n.id, n.author_identity_id, n.content, n.visibility, n.created_at, n.updated_at
       FROM note n
       JOIN workflow_task_note wtn ON wtn.note_id = n.id
       WHERE wtn.workflow_id = :workflowId AND wtn.task_name = :taskName
       ORDER BY n.created_at ASC`,
      { workflowId, taskName },
    )
  }

  async findByWorkflow(workflowId: string): Promise<(WorkflowTaskNote & { taskName: string })[]> {
    return this.db.query<WorkflowTaskNote & { taskName: string }>(
      `SELECT n.id, n.author_identity_id, n.content, n.visibility, n.created_at, n.updated_at, wtn.task_name
       FROM note n
       JOIN workflow_task_note wtn ON wtn.note_id = n.id
       WHERE wtn.workflow_id = :workflowId
       ORDER BY n.created_at ASC`,
      { workflowId },
    )
  }

  async addNote(workflowId: string, taskName: string, authorIdentityId: number, content: string): Promise<WorkflowTaskNote> {
    const rows = await this.db.query<WorkflowTaskNote>(
      `INSERT INTO note (author_identity_id, content)
       VALUES (:authorIdentityId, :content)
       RETURNING id, author_identity_id, content, visibility, created_at, updated_at`,
      { authorIdentityId, content },
    )
    const note = rows[0]

    await this.db.query(
      `INSERT INTO workflow_task_note (workflow_id, task_name, note_id)
       VALUES (:workflowId, :taskName, :noteId)`,
      { workflowId, taskName, noteId: note.id },
    )

    return note
  }
}
