import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'

function runClaude(promptFile: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--dangerously-skip-permissions'], {
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

    // Pipe prompt file into stdin
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

export async function handleAgentInvokeClaude(task: any): Promise<TaskResult> {
  const { text, messages } = task.inputData ?? {}
  let promptFile: string | undefined

  try {
    // Build prompt with conversation history
    const history = Array.isArray(messages) ? messages : []
    const parts: string[] = []

    if (history.length > 0) {
      parts.push('Here is the conversation so far:')
      parts.push('')
      for (const msg of history) {
        const label = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System'
        parts.push(`${label}: ${msg.text}`)
      }
      parts.push('')
      parts.push('Now respond to the latest message from the user:')
      parts.push('')
    }

    parts.push(text)
    const prompt = parts.join('\n')

    // Write prompt to a temp file and pipe it to stdin
    promptFile = join(tmpdir(), `claude-prompt-${randomUUID()}.txt`)
    await writeFile(promptFile, prompt, 'utf-8')

    // Unset CLAUDECODE to allow spawning Claude CLI from within a Claude Code session
    const env = { ...process.env }
    delete env.CLAUDECODE

    const stdout = await runClaude(promptFile, env)
    const response = stdout.trim()

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { response },
      logs: [{ log: `Claude responded (${response.length} chars)`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    const message = err?.stderr || err?.message || 'Claude CLI invocation failed'
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: message },
      logs: [{ log: `Claude invocation failed: ${message}`, createdTime: Date.now() }],
    }
  } finally {
    if (promptFile) unlink(promptFile).catch(() => {})
  }
}
