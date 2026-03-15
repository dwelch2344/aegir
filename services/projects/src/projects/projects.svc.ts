import { execSync } from 'node:child_process'
import type { Db } from '@moribashi/pg'

/** Convert any Date instances in a row to ISO-8601 strings (pg driver returns TIMESTAMPTZ as Date objects). */
function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) (out as any)[k] = v.toISOString()
  }
  return out
}

export interface Project {
  id: string
  organizationId: number
  name: string
  repoUrl: string
  branch: string
  localPath: string | null
  status: string
  lastSyncedAt: string | null
  manifestRaw: string | null
  contextNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectService {
  id: string
  projectId: string
  name: string
  type: string
  port: number
}

export interface ProjectPattern {
  id: string
  projectId: string
  patternId: string
  version: string
  appliedAt: string | null
}

export interface ProjectStatusReport {
  id: string
  projectId: string
  issues: string[]
  servicesOk: number
  servicesMissing: number
  outdatedPatterns: number
  checkedAt: string
}

export default class ProjectsService {
  private db: Db

  constructor({ db }: { db: Db }) {
    this.db = db
  }

  async search(input: { idIn?: string[]; organizationId?: number } = {}) {
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

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = await this.db.query<Project>(
      `SELECT id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, context_notes, created_at, updated_at
       FROM project ${where} ORDER BY updated_at DESC`,
      params,
    )
    return { results: results.map(serializeDates) }
  }

  async create(input: { organizationId: number; name: string; repoUrl: string; branch?: string }) {
    const rows = await this.db.query<Project>(
      `INSERT INTO project (organization_id, name, repo_url, branch)
       VALUES (:organizationId, :name, :repoUrl, :branch)
       RETURNING id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, context_notes, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        name: input.name,
        repoUrl: input.repoUrl,
        branch: input.branch ?? 'main',
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
    if (input.branch !== undefined) {
      sets.push('branch = :branch')
      params.branch = input.branch
    }
    if (input.status !== undefined) {
      sets.push('status = :status')
      params.status = input.status
    }
    if (input.localPath !== undefined) {
      sets.push('local_path = :localPath')
      params.localPath = input.localPath
    }
    if (input.manifestRaw !== undefined) {
      sets.push('manifest_raw = :manifestRaw')
      params.manifestRaw = input.manifestRaw
    }
    if (input.contextNotes !== undefined) {
      sets.push('context_notes = :contextNotes')
      params.contextNotes = input.contextNotes
    }
    if (input.lastSyncedAt !== undefined) {
      sets.push('last_synced_at = :lastSyncedAt')
      params.lastSyncedAt = input.lastSyncedAt
    }

    const rows = await this.db.query<Project>(
      `UPDATE project SET ${sets.join(', ')} WHERE id = :id
       RETURNING id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, context_notes, created_at, updated_at`,
      params,
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM project WHERE id = :id', { id })
    return true
  }

  async services(projectId: string) {
    const results = await this.db.query<ProjectService>(
      `SELECT id, project_id, name, type, port FROM project_service WHERE project_id = :projectId ORDER BY port`,
      { projectId },
    )
    return results
  }

  async replaceServices(projectId: string, svcs: { name: string; type: string; port: number }[]) {
    await this.db.query('DELETE FROM project_service WHERE project_id = :projectId', { projectId })
    for (const svc of svcs) {
      await this.db.query(
        `INSERT INTO project_service (project_id, name, type, port) VALUES (:projectId, :name, :type, :port)`,
        { projectId, name: svc.name, type: svc.type, port: svc.port },
      )
    }
  }

  async patterns(projectId: string) {
    const results = await this.db.query<ProjectPattern>(
      `SELECT id, project_id, pattern_id, version, applied_at FROM project_pattern WHERE project_id = :projectId ORDER BY pattern_id`,
      { projectId },
    )
    return results.map(serializeDates)
  }

  async replacePatterns(projectId: string, pats: { patternId: string; version: string; appliedAt?: string }[]) {
    await this.db.query('DELETE FROM project_pattern WHERE project_id = :projectId', { projectId })
    for (const pat of pats) {
      await this.db.query(
        `INSERT INTO project_pattern (project_id, pattern_id, version, applied_at) VALUES (:projectId, :patternId, :version, :appliedAt)`,
        { projectId, patternId: pat.patternId, version: pat.version, appliedAt: pat.appliedAt ?? null },
      )
    }
  }

  async latestStatusReport(projectId: string) {
    const rows = await this.db.query<ProjectStatusReport>(
      `SELECT id, project_id, issues, services_ok, services_missing, outdated_patterns, checked_at
       FROM project_status_report WHERE project_id = :projectId ORDER BY checked_at DESC LIMIT 1`,
      { projectId },
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async activities(projectId: string) {
    const rows = await this.db.query<{
      id: string
      projectId: string
      workflowId: string
      type: string
      status: string
      reportId: string | null
      startedAt: string
      completedAt: string | null
    }>(
      `SELECT id, project_id, workflow_id, type, status, report_id, started_at, completed_at
       FROM project_activity WHERE project_id = :projectId ORDER BY started_at DESC LIMIT 20`,
      { projectId },
    )
    return rows.map(serializeDates)
  }

  async activityEntries(activityId: string) {
    const rows = await this.db.query<{
      id: string
      activityId: string
      taskName: string
      status: string
      message: string
      createdAt: string
    }>(
      `SELECT id, activity_id, task_name, status, message, created_at
       FROM project_activity_log WHERE activity_id = :activityId ORDER BY created_at`,
      { activityId },
    )
    return rows.map(serializeDates)
  }

  async diagnosticsReportById(id: string) {
    const rows = await this.db.query<{ id: string; projectId: string; report: string; createdAt: string }>(
      `SELECT id, project_id, report, created_at FROM project_diagnostics_report WHERE id = :id`,
      { id },
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async logActivity(input: {
    projectId: string
    workflowId: string
    type: string
    taskName: string
    status: string
    message?: string
    reportId?: string
  }) {
    // Upsert activity record
    let activityRows = await this.db.query<{ id: string }>(
      `SELECT id FROM project_activity WHERE workflow_id = :workflowId`,
      { workflowId: input.workflowId },
    )

    let activityId: string
    if (activityRows.length === 0) {
      const created = await this.db.query<{ id: string }>(
        `INSERT INTO project_activity (project_id, workflow_id, type, status)
         VALUES (:projectId, :workflowId, :type, 'RUNNING')
         RETURNING id`,
        { projectId: input.projectId, workflowId: input.workflowId, type: input.type },
      )
      activityId = created[0].id
    } else {
      activityId = activityRows[0].id
    }

    // If this is a terminal status for the activity, update it
    if (input.status === 'COMPLETED' || input.status === 'FAILED') {
      const reportClause = input.reportId ? ', report_id = :reportId' : ''
      await this.db.query(
        `UPDATE project_activity SET status = :status, completed_at = now()${reportClause} WHERE id = :id`,
        {
          id: activityId,
          status: input.status,
          ...(input.reportId ? { reportId: input.reportId } : {}),
        },
      )
    }

    // Insert log entry
    await this.db.query(
      `INSERT INTO project_activity_log (activity_id, task_name, status, message)
       VALUES (:activityId, :taskName, :status, :message)`,
      {
        activityId,
        taskName: input.taskName,
        status: input.status,
        message: input.message ?? '',
      },
    )

    return {
      activityId,
      projectId: input.projectId,
      type: input.type,
      taskName: input.taskName,
      status: input.status,
      message: input.message ?? '',
      timestamp: new Date().toISOString(),
    }
  }

  async commits(projectId: string, repoUrl: string, localPath: string | null) {
    if (!localPath) return []
    try {
      const log = execSync('git log --oneline --no-decorate -30', {
        cwd: localPath,
        encoding: 'utf-8',
        timeout: 10_000,
      }).trim()

      // Derive GitHub base URL from repoUrl
      let githubBase = ''
      if (repoUrl) {
        githubBase = repoUrl.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/')
      }

      return log
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const spaceIdx = line.indexOf(' ')
          const sha = line.slice(0, spaceIdx)
          return {
            sha,
            message: line.slice(spaceIdx + 1),
            url: githubBase ? `${githubBase}/commit/${sha}` : null,
          }
        })
    } catch {
      return []
    }
  }

  async latestDiagnosticsReport(projectId: string) {
    const rows = await this.db.query<{ id: string; projectId: string; report: string; createdAt: string }>(
      `SELECT id, project_id, report, created_at
       FROM project_diagnostics_report WHERE project_id = :projectId ORDER BY created_at DESC LIMIT 1`,
      { projectId },
    )
    return rows[0] ? serializeDates(rows[0]) : null
  }

  async saveDiagnosticsReport(input: { projectId: string; report: string }) {
    const rows = await this.db.query<{ id: string; projectId: string; report: string; createdAt: string }>(
      `INSERT INTO project_diagnostics_report (project_id, report)
       VALUES (:projectId, :report)
       RETURNING id, project_id, report, created_at`,
      { projectId: input.projectId, report: input.report },
    )
    return serializeDates(rows[0])
  }

  async saveStatusReport(report: {
    projectId: string
    issues: string[]
    servicesOk: number
    servicesMissing: number
    outdatedPatterns: number
  }) {
    const rows = await this.db.query<ProjectStatusReport>(
      `INSERT INTO project_status_report (project_id, issues, services_ok, services_missing, outdated_patterns)
       VALUES (:projectId, :issues, :servicesOk, :servicesMissing, :outdatedPatterns)
       RETURNING id, project_id, issues, services_ok, services_missing, outdated_patterns, checked_at`,
      {
        projectId: report.projectId,
        issues: JSON.stringify(report.issues),
        servicesOk: report.servicesOk,
        servicesMissing: report.servicesMissing,
        outdatedPatterns: report.outdatedPatterns,
      },
    )
    return serializeDates(rows[0])
  }
}
