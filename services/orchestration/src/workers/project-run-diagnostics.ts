import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { logProjectActivity } from './project-activity.js'

function runClaude(promptFile: string, cwd: string, env: NodeJS.ProcessEnv): Promise<string> {
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
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const input = createReadStream(promptFile)
    input.pipe(child.stdin)

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Claude CLI timed out after 110s'))
    }, 110_000)

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

    const report = await runClaude(promptFile, localPath, env)

    // Save the report via GraphQL
    const gqlUrl = config.projects.graphqlUrl
    await fetch(gqlUrl, {
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

    await logProjectActivity({
      projectId,
      workflowId: wfId,
      type: 'diagnostics',
      taskName: 'project_run_diagnostics',
      status: 'COMPLETED',
      message: `Diagnostics complete (${report.trim().length} chars)`,
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
