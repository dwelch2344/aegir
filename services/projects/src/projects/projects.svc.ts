import type { Db } from '@moribashi/pg'

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
      `SELECT id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, created_at, updated_at
       FROM project ${where} ORDER BY updated_at DESC`,
      params,
    )
    return { results }
  }

  async create(input: { organizationId: number; name: string; repoUrl: string; branch?: string }) {
    const rows = await this.db.query<Project>(
      `INSERT INTO project (organization_id, name, repo_url, branch)
       VALUES (:organizationId, :name, :repoUrl, :branch)
       RETURNING id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, created_at, updated_at`,
      {
        organizationId: input.organizationId,
        name: input.name,
        repoUrl: input.repoUrl,
        branch: input.branch ?? 'main',
      },
    )
    return rows[0]
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
    if (input.lastSyncedAt !== undefined) {
      sets.push('last_synced_at = :lastSyncedAt')
      params.lastSyncedAt = input.lastSyncedAt
    }

    const rows = await this.db.query<Project>(
      `UPDATE project SET ${sets.join(', ')} WHERE id = :id
       RETURNING id, organization_id, name, repo_url, branch, local_path, status, last_synced_at, manifest_raw, created_at, updated_at`,
      params,
    )
    return rows[0] ?? null
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
    return results
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
    return rows[0] ?? null
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
    return rows[0]
  }
}
