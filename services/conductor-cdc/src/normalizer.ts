import type { TaskEvent, WorkflowEvent } from './schemas.js'

type DebeziumOp = 'c' | 'u' | 'd' | 'r' // create, update, delete, read (snapshot)

function opToEventType(op: DebeziumOp): 'CREATE' | 'UPDATE' | 'DELETE' {
  switch (op) {
    case 'c':
    case 'r':
      return 'CREATE'
    case 'u':
      return 'UPDATE'
    case 'd':
      return 'DELETE'
    default:
      return 'UPDATE'
  }
}

function safeJson(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

/**
 * Normalize a raw Debezium CDC event from a Conductor workflow table into our model.
 * Conductor stores workflows in a `workflow` table with JSON columns for data.
 */
export function normalizeWorkflowEvent(payload: any): WorkflowEvent | null {
  const op = payload.op as DebeziumOp
  const row = op === 'd' ? payload.before : payload.after
  if (!row) return null

  // Conductor stores workflow data as a JSON blob; parse it
  const data = typeof row.json_data === 'string' ? JSON.parse(row.json_data) : row.json_data

  if (!data) {
    // Fallback: try to extract directly from row columns
    return {
      event_type: opToEventType(op),
      workflow_id: row.workflow_id || row.id || '',
      workflow_type: row.workflow_type || '',
      version: row.version || 1,
      status: row.status || 'UNKNOWN',
      correlation_id: row.correlation_id || null,
      input: safeJson(row.input),
      output: safeJson(row.output),
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      create_time: row.create_time || Date.now(),
      update_time: row.update_time || Date.now(),
      captured_at: Date.now(),
    }
  }

  return {
    event_type: opToEventType(op),
    workflow_id: data.workflowId || row.workflow_id || '',
    workflow_type: data.workflowName || data.workflowType || '',
    version: data.workflowVersion || data.version || 1,
    status: data.status || 'UNKNOWN',
    correlation_id: data.correlationId || null,
    input: safeJson(data.input),
    output: safeJson(data.output),
    start_time: data.startTime || null,
    end_time: data.endTime || null,
    create_time: data.createTime || Date.now(),
    update_time: data.updateTime || Date.now(),
    captured_at: Date.now(),
  }
}

/**
 * Normalize a raw Debezium CDC event from a Conductor task table into our model.
 */
export function normalizeTaskEvent(payload: any): TaskEvent | null {
  const op = payload.op as DebeziumOp
  const row = op === 'd' ? payload.before : payload.after
  if (!row) return null

  const data = typeof row.json_data === 'string' ? JSON.parse(row.json_data) : row.json_data

  if (!data) {
    return {
      event_type: opToEventType(op),
      task_id: row.task_id || row.id || '',
      workflow_id: row.workflow_id || '',
      task_type: row.task_type || '',
      reference_task_name: row.reference_task_name || '',
      status: row.status || 'UNKNOWN',
      worker_id: row.worker_id || null,
      input: safeJson(row.input),
      output: safeJson(row.output),
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      poll_count: row.poll_count || 0,
      retry_count: row.retry_count || 0,
      captured_at: Date.now(),
    }
  }

  return {
    event_type: opToEventType(op),
    task_id: data.taskId || row.task_id || '',
    workflow_id: data.workflowInstanceId || row.workflow_id || '',
    task_type: data.taskType || '',
    reference_task_name: data.referenceTaskName || '',
    status: data.status || 'UNKNOWN',
    worker_id: data.workerId || null,
    input: safeJson(data.inputData),
    output: safeJson(data.outputData),
    start_time: data.startTime || null,
    end_time: data.endTime || null,
    poll_count: data.pollCount || 0,
    retry_count: data.retryCount || 0,
    captured_at: Date.now(),
  }
}
