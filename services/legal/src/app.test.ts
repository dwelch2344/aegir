import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

describe('Legal Service', () => {
  let fastify: FastifyInstance
  let stop: () => Promise<void>

  beforeAll(async () => {
    const result = await buildApp()
    fastify = result.fastify
    stop = () => result.app.stop()
    await fastify.ready()
  })

  afterAll(async () => {
    await stop()
  })

  it('responds to health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: 'legal' })
  })

  it('serves the federated schema', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ _service { sdl } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data._service.sdl).toContain('type Contract')
    expect(body.data._service.sdl).toContain('enum ContractStatus')
  })

  it('resolves the contracts query', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ contracts(organizationId: 2) { id organizationId status carrierName } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const contracts = response.json().data.contracts
    expect(contracts).toHaveLength(3)
    expect(contracts[0]).toHaveProperty('id')
    expect(contracts[0]).toHaveProperty('organizationId')
    expect(contracts[0]).toHaveProperty('status')
    expect(contracts[0]).toHaveProperty('carrierName')
  })
})
