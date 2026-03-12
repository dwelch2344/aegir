import { describe, it, expect } from 'vitest'
import { config } from './config.js'

describe('gateway config', () => {
  it('has default port 4000', () => {
    expect(config.port).toBe(4000)
  })

  it('has default host 0.0.0.0', () => {
    expect(config.host).toBe('0.0.0.0')
  })

  it('has all service URLs configured', () => {
    expect(config.services.iam).toContain('/graphql')
    expect(config.services.agents).toContain('/graphql')
  })
})
