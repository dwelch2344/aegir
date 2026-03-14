import { execSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { logProjectActivity } from './project-activity.js'

export async function handleProjectInitManifest(task: any): Promise<TaskResult> {
  const { projectId, localPath, name, projectType } = task.inputData ?? {}
  const wfId = task.workflowInstanceId

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'scaffold',
    taskName: 'project_init_manifest',
    status: 'RUNNING',
    message: `Initializing ship manifest for ${name}`,
  })

  try {
    const manifestPath = join(localPath, 'shipyard.manifest')

    // Only create if one doesn't already exist
    if (!existsSync(manifestPath)) {
      const manifest = buildManifest(name, projectType)
      writeFileSync(manifestPath, manifest)
    }

    // Create a basic README if missing
    const readmePath = join(localPath, 'README.md')
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, `# ${name}\n\nA Shipyard-managed project.\n`)
    }

    // Create .gitignore if missing
    const gitignorePath = join(localPath, '.gitignore')
    if (!existsSync(gitignorePath)) {
      writeFileSync(
        gitignorePath,
        ['node_modules/', 'dist/', '.env', '.env.local', '.DS_Store', '*.log'].join('\n') + '\n',
      )
    }

    // Stage, commit, and push the initial scaffold
    const opts = { cwd: localPath, encoding: 'utf-8' as const, timeout: 30_000 }
    execSync('git add -A', opts)

    const status = execSync('git status --porcelain', opts).trim()
    if (status) {
      execSync('git commit -m "shipyard: initialize project scaffold"', opts)
      execSync('git push -u origin HEAD', opts)
    }

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'scaffold',
      taskName: 'project_init_manifest',
      status: 'COMPLETED',
      message: `Ship manifest initialized and pushed`,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { localPath, manifestCreated: true },
      logs: [{ log: `Initialized manifest at ${manifestPath}`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'scaffold',
      taskName: 'project_init_manifest',
      status: 'FAILED',
      message: err.message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Manifest init failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}

function buildManifest(name: string, projectType: string): string {
  return `# ${name} — Ship Manifest
# Managed by the Shipyard platform.

shipyard_version: "0.1"
name: ${name}
type: ${projectType || 'web-app'}

stack:
  languages: [typescript]
  frameworks: []
  runtime: node-22

services: []

catalog_refs: []

capabilities: []

constraints:
  protected_paths:
    - shipyard.manifest

conventions:
  graphql_naming: moribashi
  migration_format: flyway
  service_scan_pattern: "**/*.svc.ts"
`
}
