import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'
import { config } from '../config.js'
import { publishChatEvent } from '../kafka-bridge.js'
import type { ChatStreamChunkEvent, ChatResponseCompleteEvent, ChatErrorEvent } from '@aegir/kafka'

interface StreamEvent {
  type: string
  subtype?: string
  message?: {
    content?: Array<{ type: string; text?: string }>
  }
  result?: string
}

interface StreamCallbacks {
  /** Called with accumulated assistant text whenever new content arrives */
  onText: (accumulated: string) => void
  /** Called when Claude uses a tool (file read, edit, etc.) */
  onToolUse: (toolName: string) => void
}

/**
 * Run Claude CLI with stream-json output for real-time streaming.
 * Parses newline-delimited JSON events and extracts text content.
 */
function runClaude(
  promptFile: string,
  env: NodeJS.ProcessEnv,
  callbacks: StreamCallbacks,
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
      {
        env,
        cwd: cwd || undefined,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )

    let stderr = ''
    let lineBuf = ''
    let finalResult = ''
    let accumulatedText = ''

    child.stdout.on('data', (chunk: Buffer) => {
      lineBuf += chunk.toString()

      // Process complete lines (newline-delimited JSON)
      for (let newlineIdx = lineBuf.indexOf('\n'); newlineIdx !== -1; newlineIdx = lineBuf.indexOf('\n')) {
        const line = lineBuf.slice(0, newlineIdx).trim()
        lineBuf = lineBuf.slice(newlineIdx + 1)
        if (!line) continue

        try {
          const event: StreamEvent = JSON.parse(line)

          if (event.type === 'assistant' && event.message?.content) {
            // Extract text blocks from the assistant message
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                accumulatedText += block.text
                callbacks.onText(accumulatedText)
              }
              if (block.type === 'tool_use') {
                callbacks.onToolUse((block as any).name || 'unknown')
              }
            }
          }

          if (event.type === 'result' && event.result) {
            finalResult = event.result
          }
        } catch {
          // Ignore malformed lines
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // Pipe prompt from file to stdin
    const input = createReadStream(promptFile)
    input.pipe(child.stdin)

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Claude CLI timed out after 30m'))
    }, 1_800_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      // Prefer the result event's text, fall back to accumulated text
      const response = finalResult || accumulatedText
      if (code === 0) resolve(response)
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

export async function handleAgentInvokeClaude(task: any): Promise<TaskResult> {
  const { text, messages, conversationId, localPath } = task.inputData ?? {}
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

    const response = await runClaude(
      promptFile,
      env,
      {
        onText(accumulated) {
          const now = Date.now()
          if (now - lastStreamAt < STREAM_INTERVAL) return
          lastStreamAt = now

          addTaskLog(task.taskId, `[streaming] ${accumulated.length} chars so far`)

          if (conversationId) {
            // Publish stream chunk via Kafka
            const chunkEvent: ChatStreamChunkEvent = {
              type: 'chat.stream.chunk',
              conversationId,
              text: accumulated,
              done: false,
              timestamp: new Date().toISOString(),
            }
            publishChatEvent(conversationId, chunkEvent).catch(() => {})
          }
        },
        onToolUse(toolName) {
          addTaskLog(task.taskId, `[tool] ${toolName}`)
        },
      },
      localPath || undefined,
    )

    const trimmed = response.trim()

    // Publish completion event via Kafka
    if (conversationId) {
      const completeEvent: ChatResponseCompleteEvent = {
        type: 'chat.response.complete',
        conversationId,
        workflowId: task.workflowInstanceId,
        response: trimmed,
        timestamp: new Date().toISOString(),
      }
      await publishChatEvent(conversationId, completeEvent).catch(() => {})
    }

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { response: trimmed },
      logs: [{ log: `Claude responded (${trimmed.length} chars)`, createdTime: Date.now() }],
    }
  } catch (err: any) {
    const message = err?.stderr || err?.message || 'Claude CLI invocation failed'

    // Publish error event via Kafka
    if (conversationId) {
      const errorEvent: ChatErrorEvent = {
        type: 'chat.error',
        conversationId,
        workflowId: task.workflowInstanceId,
        error: message,
        timestamp: new Date().toISOString(),
      }
      await publishChatEvent(conversationId, errorEvent).catch(() => {})
    }

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
