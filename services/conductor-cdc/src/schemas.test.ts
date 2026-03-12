import { describe, it, expect } from 'vitest'
import { WorkflowEventSchema, TaskEventSchema } from './schemas.js'
import type { WorkflowEvent, TaskEvent } from './schemas.js'

describe('WorkflowEventSchema', () => {
  const validEvent: WorkflowEvent = {
    event_type: 'CREATE',
    workflow_id: 'wf-1',
    workflow_type: 'user_onboarding',
    version: 1,
    status: 'RUNNING',
    correlation_id: null,
    input: '{"email":"test@test.com"}',
    output: null,
    start_time: 1000,
    end_time: null,
    create_time: 900,
    update_time: 1000,
    captured_at: Date.now(),
  }

  it('encodes and decodes a valid workflow event', () => {
    const buf = WorkflowEventSchema.toBuffer(validEvent)
    expect(buf).toBeInstanceOf(Buffer)
    const decoded = WorkflowEventSchema.fromBuffer(buf)
    expect(decoded.workflow_id).toBe('wf-1')
    expect(decoded.event_type).toBe('CREATE')
    expect(decoded.workflow_type).toBe('user_onboarding')
  })

  it('validates a correct event', () => {
    expect(WorkflowEventSchema.isValid(validEvent)).toBe(true)
  })

  it('rejects an event with invalid event_type', () => {
    expect(WorkflowEventSchema.isValid({ ...validEvent, event_type: 'INVALID' })).toBe(false)
  })

  it('rejects an event missing required fields', () => {
    const { workflow_id, ...incomplete } = validEvent
    expect(WorkflowEventSchema.isValid(incomplete)).toBe(false)
  })

  it('handles nullable fields correctly', () => {
    const withNulls = { ...validEvent, correlation_id: null, input: null, output: null, start_time: null, end_time: null }
    const buf = WorkflowEventSchema.toBuffer(withNulls)
    const decoded = WorkflowEventSchema.fromBuffer(buf)
    expect(decoded.correlation_id).toBeNull()
    expect(decoded.input).toBeNull()
  })
})

describe('TaskEventSchema', () => {
  const validEvent: TaskEvent = {
    event_type: 'UPDATE',
    task_id: 'task-1',
    workflow_id: 'wf-1',
    task_type: 'validate_identity',
    reference_task_name: 'validate_identity_ref',
    status: 'COMPLETED',
    worker_id: 'worker-1',
    input: '{}',
    output: '{"identityId":"id-1"}',
    start_time: 1000,
    end_time: 2000,
    poll_count: 1,
    retry_count: 0,
    captured_at: Date.now(),
  }

  it('encodes and decodes a valid task event', () => {
    const buf = TaskEventSchema.toBuffer(validEvent)
    const decoded = TaskEventSchema.fromBuffer(buf)
    expect(decoded.task_id).toBe('task-1')
    expect(decoded.task_type).toBe('validate_identity')
    expect(decoded.poll_count).toBe(1)
  })

  it('validates a correct event', () => {
    expect(TaskEventSchema.isValid(validEvent)).toBe(true)
  })

  it('rejects missing required fields', () => {
    const { task_id, ...incomplete } = validEvent
    expect(TaskEventSchema.isValid(incomplete)).toBe(false)
  })
})
