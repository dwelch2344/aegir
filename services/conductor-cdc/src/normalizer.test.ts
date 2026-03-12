import { describe, it, expect } from 'vitest'
import { normalizeWorkflowEvent, normalizeTaskEvent } from './normalizer.js'

describe('normalizeWorkflowEvent', () => {
  it('normalizes a create event with json_data', () => {
    const payload = {
      op: 'c',
      after: {
        workflow_id: 'wf-1',
        json_data: JSON.stringify({
          workflowId: 'wf-1',
          workflowName: 'user_onboarding',
          workflowVersion: 1,
          status: 'RUNNING',
          correlationId: 'corr-1',
          input: { email: 'test@example.com' },
          output: null,
          startTime: 1000,
          endTime: null,
          createTime: 900,
          updateTime: 1000,
        }),
      },
    }
    const event = normalizeWorkflowEvent(payload)
    expect(event).not.toBeNull()
    expect(event!.event_type).toBe('CREATE')
    expect(event!.workflow_id).toBe('wf-1')
    expect(event!.workflow_type).toBe('user_onboarding')
    expect(event!.version).toBe(1)
    expect(event!.status).toBe('RUNNING')
    expect(event!.correlation_id).toBe('corr-1')
    expect(event!.input).toContain('test@example.com')
    expect(event!.captured_at).toBeGreaterThan(0)
  })

  it('normalizes a delete event using before', () => {
    const payload = {
      op: 'd',
      before: {
        workflow_id: 'wf-2',
        json_data: JSON.stringify({
          workflowId: 'wf-2',
          workflowName: 'cleanup',
          status: 'COMPLETED',
          createTime: 100,
          updateTime: 200,
        }),
      },
      after: null,
    }
    const event = normalizeWorkflowEvent(payload)
    expect(event!.event_type).toBe('DELETE')
    expect(event!.workflow_id).toBe('wf-2')
  })

  it('returns null when row is missing', () => {
    expect(normalizeWorkflowEvent({ op: 'c', after: null })).toBeNull()
    expect(normalizeWorkflowEvent({ op: 'd', before: null })).toBeNull()
  })

  it('falls back to row columns when json_data is missing', () => {
    const payload = {
      op: 'u',
      after: {
        workflow_id: 'wf-3',
        workflow_type: 'simple',
        status: 'COMPLETED',
        version: 2,
        create_time: 100,
        update_time: 200,
      },
    }
    const event = normalizeWorkflowEvent(payload)
    expect(event!.workflow_id).toBe('wf-3')
    expect(event!.workflow_type).toBe('simple')
    expect(event!.event_type).toBe('UPDATE')
  })

  it('maps snapshot (r) op to CREATE', () => {
    const payload = {
      op: 'r',
      after: {
        json_data: JSON.stringify({
          workflowId: 'wf-snap',
          workflowName: 'snap',
          status: 'RUNNING',
          createTime: 100,
          updateTime: 100,
        }),
      },
    }
    const event = normalizeWorkflowEvent(payload)
    expect(event!.event_type).toBe('CREATE')
  })
})

describe('normalizeTaskEvent', () => {
  it('normalizes a task create event with json_data', () => {
    const payload = {
      op: 'c',
      after: {
        task_id: 'task-1',
        json_data: JSON.stringify({
          taskId: 'task-1',
          workflowInstanceId: 'wf-1',
          taskType: 'validate_identity',
          referenceTaskName: 'validate_identity_ref',
          status: 'IN_PROGRESS',
          workerId: 'worker-1',
          inputData: { email: 'test@example.com' },
          outputData: null,
          startTime: 1000,
          endTime: null,
          pollCount: 1,
          retryCount: 0,
        }),
      },
    }
    const event = normalizeTaskEvent(payload)
    expect(event).not.toBeNull()
    expect(event!.event_type).toBe('CREATE')
    expect(event!.task_id).toBe('task-1')
    expect(event!.workflow_id).toBe('wf-1')
    expect(event!.task_type).toBe('validate_identity')
    expect(event!.reference_task_name).toBe('validate_identity_ref')
    expect(event!.worker_id).toBe('worker-1')
    expect(event!.poll_count).toBe(1)
  })

  it('falls back to row columns when json_data is missing', () => {
    const payload = {
      op: 'u',
      after: {
        task_id: 'task-2',
        workflow_id: 'wf-2',
        task_type: 'send_email',
        reference_task_name: 'send_email_ref',
        status: 'COMPLETED',
        poll_count: 3,
        retry_count: 1,
      },
    }
    const event = normalizeTaskEvent(payload)
    expect(event!.task_id).toBe('task-2')
    expect(event!.task_type).toBe('send_email')
    expect(event!.poll_count).toBe(3)
    expect(event!.retry_count).toBe(1)
  })

  it('returns null when row is missing', () => {
    expect(normalizeTaskEvent({ op: 'c', after: null })).toBeNull()
  })
})
