/**
 * Shared test helpers for orchestration worker tests.
 * Creates mock task objects that mirror Conductor's task shape.
 */

export function createMockTask(inputData: Record<string, any> = {}, overrides: Record<string, any> = {}) {
  return {
    workflowInstanceId: 'wf-test-123',
    taskId: 'task-test-456',
    inputData,
    ...overrides,
  }
}
