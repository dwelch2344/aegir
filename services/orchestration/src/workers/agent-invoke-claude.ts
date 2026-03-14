import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'

interface StreamCallbacks {
  onChunk: (accumulated: string) => void
}

function runClaude(promptFile: string, env: NodeJS.ProcessEnv, callbacks?: StreamCallbacks): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--dangerously-skip-permissions'], {
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
      reject(new Error('Claude CLI timed out after 30m'))
    }, 1_800_000)

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

/** Push a log line to a Conductor task while it's in progress */
async function addTaskLog(taskId: string, log: string) {
  try {
    await fetch(`${config.conductor.url}/tasks/${taskId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log, createdTime: Date.now() }),
    })
  } catch {
    // best effort — don't break the worker
  }
}

/** Stream a partial response to the chat UI via pubsub (no DB persistence). */
async function streamToChat(conversationId: string, text: string) {
  try {
    await fetch(config.agents.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($input: AgentsStreamChunkInput!) {
          agents { conversations { streamChunk(input: $input) } }
        }`,
        variables: {
          input: { conversationId, text },
        },
      }),
    })
  } catch {
    // best effort
  }
}

export async function handleAgentInvokeClaude(task: any): Promise<TaskResult> {
  const { text, messages, conversationId } = task.inputData ?? {}
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

    promptFile = join(tmpdir(), `claude-prompt-${randomUUID()}.txt`)
    await writeFile(promptFile, prompt, 'utf-8')

    const env = { ...process.env }
    delete env.CLAUDECODE

    // Throttle streaming updates — at most every 2s
    let lastStreamAt = 0
    const STREAM_INTERVAL = 2000
    let streamedOnce = false

    const stdout = await runClaude(promptFile, env, {
      onChunk(accumulated) {
        const now = Date.now()
        if (now - lastStreamAt < STREAM_INTERVAL) return
        lastStreamAt = now
        streamedOnce = true

        // Push to Conductor logs
        addTaskLog(task.taskId, `[streaming] ${accumulated.length} chars so far`)

        // Push partial response to the chat UI
        if (conversationId) {
          streamToChat(conversationId, accumulated)
        }
      },
    })

    const response = stdout.trim()

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { response, streamed: streamedOnce },
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
