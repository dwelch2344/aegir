import { describe, it, expect } from 'vitest'
import {
  taskDefs,
  onboardingWorkflow,
  selectHealthTaskDefs,
  selectHealthAcaWorkflow,
  agentChatTaskDefs,
  agentChatWorkflow,
} from './definitions.js'

describe('task definitions', () => {
  const allTaskDefs = [...taskDefs, ...selectHealthTaskDefs, ...agentChatTaskDefs]

  it('all task defs have unique names', () => {
    const names = allTaskDefs.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(allTaskDefs)('task "$name" has required fields', (def) => {
    expect(def.name).toBeTruthy()
    expect(def.timeoutSeconds).toBeGreaterThan(0)
    expect(def.ownerEmail).toContain('@')
  })
})

describe('onboarding workflow', () => {
  it('has correct name and version', () => {
    expect(onboardingWorkflow.name).toBe('user_onboarding')
    expect(onboardingWorkflow.version).toBe(1)
  })

  it('defines 3 sequential tasks', () => {
    expect(onboardingWorkflow.tasks).toHaveLength(3)
    expect(onboardingWorkflow.tasks.map((t) => t.name)).toEqual([
      'validate_identity',
      'provision_account',
      'send_welcome_email',
    ])
  })

  it('all task reference names are unique', () => {
    const refs = onboardingWorkflow.tasks.map((t) => t.taskReferenceName)
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('chains outputs correctly', () => {
    const provision = onboardingWorkflow.tasks[1]
    expect(provision.inputParameters?.identityId).toContain('validate_identity_ref')

    const email = onboardingWorkflow.tasks[2]
    expect(email.inputParameters?.accountId).toContain('provision_account_ref')
  })

  it('exposes expected output parameters', () => {
    expect(onboardingWorkflow.outputParameters).toHaveProperty('identityId')
    expect(onboardingWorkflow.outputParameters).toHaveProperty('accountId')
    expect(onboardingWorkflow.outputParameters).toHaveProperty('welcomeEmailSent')
  })
})

describe('select health ACA workflow', () => {
  it('has correct name', () => {
    expect(selectHealthAcaWorkflow.name).toBe('select_health_aca_new_contract')
  })

  it('defines 7 sequential tasks', () => {
    expect(selectHealthAcaWorkflow.tasks).toHaveLength(7)
  })

  it('every task has a corresponding task definition', () => {
    const defNames = selectHealthTaskDefs.map((d) => d.name)
    for (const task of selectHealthAcaWorkflow.tasks) {
      expect(defNames).toContain(task.name)
    }
  })

  it('all task reference names are unique', () => {
    const refs = selectHealthAcaWorkflow.tasks.map((t) => t.taskReferenceName)
    expect(new Set(refs).size).toBe(refs.length)
  })
})

describe('agent chat workflow', () => {
  it('has correct name', () => {
    expect(agentChatWorkflow.name).toBe('agent_chat_conversation')
  })

  it('uses a DO_WHILE loop', () => {
    const loop = agentChatWorkflow.tasks[0]
    expect(loop.type).toBe('DO_WHILE')
    expect(loop.loopCondition).toBeDefined()
    expect(loop.loopOver).toBeDefined()
    expect(loop.loopOver).toHaveLength(4)
  })

  it('loop starts with a WAIT task', () => {
    const waitTask = agentChatWorkflow.tasks[0].loopOver![0]
    expect(waitTask.type).toBe('WAIT')
    expect(waitTask.name).toBe('agent_wait_for_message')
  })
})
