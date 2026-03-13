import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('Agents Service', () => {
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
    expect(response.json()).toEqual({ status: 'ok', service: 'agents' })
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
    expect(body.data._service.sdl).toContain('type AgentsConversation')
    expect(body.data._service.sdl).toContain('type AgentsMessage')
    expect(body.data._service.sdl).toContain('type Agents')
  })

  it('creates a conversation', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Test conversation" }) { id organizationId title workflowId createdAt updatedAt } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const convo = response.json().data.agents.conversations.create
    expect(convo.id).toBeTruthy()
    expect(convo.organizationId).toBe(1)
    expect(convo.title).toBe('Test conversation')
    expect(convo.workflowId).toBeNull()
    expect(convo.createdAt).toBeTruthy()
    expect(convo.updatedAt).toBeTruthy()
  })

  it('searches conversations with empty result', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ agents { conversations { search(input: { organizationId: 99999 }) { results { id title } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.agents.conversations.search.results
    expect(results).toHaveLength(0)
  })

  it('searches conversations by organizationId', async () => {
    // First create a conversation for org 42
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 42, title: "Org 42 convo" }) { id } } } }',
      },
    })

    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          '{ agents { conversations { search(input: { organizationId: 42 }) { results { id organizationId title } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const results = response.json().data.agents.conversations.search.results
    expect(results.length).toBeGreaterThanOrEqual(1)
    for (const r of results) {
      expect(r.organizationId).toBe(42)
    }
  })

  it('updates a conversation title', async () => {
    // Create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Original" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    // Update it
    const updateRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { update(id: "${convoId}", input: { title: "Updated title" }) { id title } } } }`,
      },
    })
    expect(updateRes.statusCode).toBe(200)
    const updated = updateRes.json().data.agents.conversations.update
    expect(updated.id).toBe(convoId)
    expect(updated.title).toBe('Updated title')
  })

  it('deletes a conversation', async () => {
    // Create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "To delete" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    // Delete it
    const deleteRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { delete(id: "${convoId}") } } }`,
      },
    })
    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.json().data.agents.conversations.delete).toBe(true)

    // Verify it's gone
    const searchRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ agents { conversations { search(input: { idIn: ["${convoId}"] }) { results { id } } } } }`,
      },
    })
    expect(searchRes.json().data.agents.conversations.search.results).toHaveLength(0)
  })

  it('adds a message to a conversation', async () => {
    // Create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { agents { conversations { create(input: { organizationId: 1, title: "Chat" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    // Add a message
    const addRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "user", text: "Hello world" }) { id conversationId role text createdAt } } } }`,
      },
    })
    expect(addRes.statusCode).toBe(200)
    const msg = addRes.json().data.agents.conversations.addMessage
    expect(msg.id).toBeTruthy()
    expect(msg.conversationId).toBe(convoId)
    expect(msg.role).toBe('user')
    expect(msg.text).toBe('Hello world')
    expect(msg.createdAt).toBeTruthy()
  })

  it('queries messages on a conversation', async () => {
    // Create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Messages test" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    // Add multiple messages
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "user", text: "First" }) { id } } } }`,
      },
    })
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "assistant", text: "Second" }) { id } } } }`,
      },
    })

    // Query messages through conversation
    const searchRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{ agents { conversations { search(input: { idIn: ["${convoId}"] }) { results { id messages { id role text } } } } } }`,
      },
    })
    expect(searchRes.statusCode).toBe(200)
    const results = searchRes.json().data.agents.conversations.search.results
    expect(results).toHaveLength(1)
    expect(results[0].messages).toHaveLength(2)
    expect(results[0].messages[0].role).toBe('user')
    expect(results[0].messages[0].text).toBe('First')
    expect(results[0].messages[1].role).toBe('assistant')
    expect(results[0].messages[1].text).toBe('Second')
  })

  // --- Edge Cases ---

  it('update nonexistent conversation returns null', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { update(id: "00000000-0000-0000-0000-000000000000", input: { title: "Ghost" }) { id title } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const updated = response.json().data.agents.conversations.update
    expect(updated).toBeNull()
  })

  it('delete nonexistent conversation returns true', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { agents { conversations { delete(id: "00000000-0000-0000-0000-000000000000") } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    // The service always returns true for delete
    expect(response.json().data.agents.conversations.delete).toBe(true)
  })

  it('search with organizationId that has no conversations returns empty', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ agents { conversations { search(input: { organizationId: 777777 }) { results { id } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.agents.conversations.search.results).toHaveLength(0)
  })

  // --- Todo stubs ---

  it.todo('sendMessage requires running orchestration service - integration test needed')
})
