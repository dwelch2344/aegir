import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

interface StreamCallbacks {
  onChunk: (accumulated: string) => void
}

function runClaude(
  promptFile: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  callbacks?: StreamCallbacks,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--dangerously-skip-permissions'], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      callbacks?.onChunk(stdout)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const input = createReadStream(promptFile)
    input.pipe(child.stdin)

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Claude CLI timed out after 5m'))
    }, 300_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr || `Claude CLI exited with code ${code}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function addTaskLog(taskId: string, log: string) {
  try {
    await fetch(`${config.conductor.url}/tasks/${taskId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log, createdTime: Date.now() }),
    })
  } catch {
    // best effort
  }
}

export async function handleProjectRunDiagnostics(task: any): Promise<TaskResult> {
  const { projectId, localPath } = task.inputData ?? {}
  const wfId = task.workflowInstanceId
  let promptFile: string | undefined

  await logProjectActivity({
    projectId,
    workflowId: wfId,
    type: 'diagnostics',
    taskName: 'project_run_diagnostics',
    status: 'RUNNING',
    message: 'Running Claude diagnostics on project',
  })

  try {
    const prompt = `You are analyzing a software project repository located at ${localPath}.

Please provide a comprehensive diagnostic report covering:

1. **Project Overview** — What kind of project is this? What's the tech stack?
2. **Structure** — Key directories and their purposes. How is the code organized?
3. **Dependencies** — Notable dependencies, any outdated or concerning ones?
4. **Build & Config** — Build system, configuration files, environment setup
5. **Code Quality** — Any obvious issues, anti-patterns, or areas of concern?
6. **Tests** — What testing framework is used? Are there tests? What's the coverage like?
7. **Documentation** — Is there adequate documentation?
8. **Recommendations** — Top 3-5 actionable improvements

Keep the report concise and actionable. Use markdown formatting.`

    promptFile = join(tmpdir(), `diagnostics-${randomUUID()}.txt`)
    await writeFile(promptFile, prompt, 'utf-8')

    const env = { ...process.env }
    delete env.CLAUDECODE

    let lastStreamAt = 0
    const STREAM_INTERVAL = 3000

    const report = await runClaude(promptFile, localPath, env, {
      onChunk(accumulated) {
        const now = Date.now()
        if (now - lastStreamAt < STREAM_INTERVAL) return
        lastStreamAt = now

        addTaskLog(task.taskId, `[streaming] ${accumulated.length} chars so far`)

        logProjectActivity({
          projectId,
          workflowId: wfId,
          type: 'diagnostics',
          taskName: 'project_run_diagnostics',
          status: 'RUNNING',
          message: `Generating report... (${accumulated.length} chars)`,
        })
      },
    })

    // Save the report via GraphQL
    const gqlUrl = config.projects.graphqlUrl
    const saveRes = await fetch(gqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($input: ProjectsDiagnosticsReportInput!) {
          projects { projects { saveDiagnosticsReport(input: $input) { id } } }
        }`,
        variables: {
          input: { projectId, report: report.trim() },
        },
      }),
    })
    const saveData = (await saveRes.json()) as any
    const reportId = saveData?.data?.projects?.projects?.saveDiagnosticsReport?.id

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'diagnostics',
      taskName: 'project_run_diagnostics',
      status: 'COMPLETED',
      message: `Diagnostics complete (${report.trim().length} chars)`,
      ...(reportId ? { reportId: String(reportId) } : {}),
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { report: report.trim() },
      logs: [{ log: `Diagnostics complete (${report.length} chars)`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    const message = err?.message || 'Diagnostics failed'

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'diagnostics',
      taskName: 'project_run_diagnostics',
      status: 'FAILED',
      message,
    })

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: message },
      logs: [{ log: `Diagnostics failed: ${message}`, createdTime: Date.now() }],
    }
  } finally {
    if (promptFile) unlink(promptFile).catch(() => {})
  }
}
