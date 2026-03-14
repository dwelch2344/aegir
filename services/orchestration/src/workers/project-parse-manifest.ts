import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'

export async function handleProjectParseManifest(task: any): Promise<TaskResult> {
  const { localPath } = task.inputData ?? {}

  try {
    const manifestPath = join(localPath, 'shipyard.manifest')

    if (!existsSync(manifestPath)) {
      return {
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.taskId,
        status: 'COMPLETED',
        outputData: {
          hasManifest: false,
          manifestRaw: null,
          services: [],
          patterns: [],
        },
        logs: [{ log: `No shipyard.manifest found at ${localPath}`, createdTime: Date.now() }],
      }
    }

    const manifestRaw = readFileSync(manifestPath, 'utf-8')

    // Dynamic import yaml since it might not be in orchestration deps
    const { parse } = await import('yaml')
    const manifest = parse(manifestRaw)

    const services = (manifest.services ?? []).map((s: any) => ({
      name: s.name,
      type: s.type,
      port: s.port,
    }))

    const patterns = (manifest.catalog_refs ?? []).map((r: any) => ({
      patternId: r.id,
      version: r.version,
      appliedAt: r.applied_at ?? null,
    }))

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: {
        hasManifest: true,
        manifestRaw,
        services,
        patterns,
        name: manifest.name,
        type: manifest.type,
        capabilities: manifest.capabilities ?? [],
      },
      logs: [
        {
          log: `Parsed manifest: ${services.length} services, ${patterns.length} patterns`,
          createdTime: Date.now(),
        },
      ],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Manifest parse failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
