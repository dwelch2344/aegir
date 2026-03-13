import { config } from './config.js'

const baseUrl = () => config.conductor.url

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  // 409 = already exists, treat as success for idempotent registration
  // 500 with "already exists" = same (conductoross/conductor behavior)
  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => '')
    if (res.status === 500 && body.includes('already exists')) {
      return undefined
    }
    throw new Error(`Conductor ${options?.method ?? 'GET'} ${path} failed (${res.status}): ${body}`)
  }
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export interface TaskDef {
  name: string
  description?: string
  retryCount?: number
  retryLogic?: 'FIXED' | 'EXPONENTIAL_BACKOFF'
  retryDelaySeconds?: number
  timeoutSeconds?: number
  responseTimeoutSeconds?: number
  timeoutPolicy?: 'RETRY' | 'TIME_OUT_WF' | 'ALERT_ONLY'
  ownerEmail?: string
}

export interface WorkflowDef {
  name: string
  description?: string
  version?: number
  tasks: WorkflowTask[]
  outputParameters?: Record<string, string>
  failureWorkflow?: string
  schemaVersion?: number
  ownerEmail?: string
}

export interface WorkflowTask {
  name: string
  taskReferenceName: string
  type?: string
  inputParameters?: Record<string, any>
  // DO_WHILE support
  loopCondition?: string
  loopOver?: WorkflowTask[]
}

export interface TaskResult {
  workflowInstanceId: string
  taskId: string
  status: 'COMPLETED' | 'FAILED'
  outputData?: Record<string, any>
  logs?: { log: string; createdTime: number }[]
}

export async function registerTaskDefs(defs: TaskDef[]) {
  return request('/metadata/taskdefs', { method: 'POST', body: JSON.stringify(defs) })
}

export async function registerWorkflow(def: WorkflowDef) {
  return request('/metadata/workflow', { method: 'PUT', body: JSON.stringify([def]) })
}

export async function startWorkflow(name: string, input: Record<string, any> = {}, version = 1) {
  return request('/workflow', {
    method: 'POST',
    body: JSON.stringify({ name, version, input }),
  })
}

export async function pollTask(taskType: string, workerId: string): Promise<any | null> {
  const task = await request(`/tasks/poll/${taskType}?workerid=${workerId}`)
  return task || null
}

export async function updateTask(result: TaskResult) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(result) })
}

export async function getWorkflow(workflowId: string) {
  return request(`/workflow/${workflowId}`)
}

export async function signalWaitTask(workflowId: string, taskRefName: string, output: Record<string, any>) {
  const wf = await getWorkflow(workflowId)
  if (!wf) throw new Error(`Workflow ${workflowId} not found`)
  const waitTask = (wf.tasks ?? []).find(
    (t: any) => t.referenceTaskName?.startsWith(taskRefName) && t.status === 'IN_PROGRESS',
  )
  if (!waitTask) throw new Error(`No pending WAIT task "${taskRefName}" in workflow ${workflowId}`)
  return updateTask({
    workflowInstanceId: workflowId,
    taskId: waitTask.taskId,
    status: 'COMPLETED',
    outputData: output,
  })
}
