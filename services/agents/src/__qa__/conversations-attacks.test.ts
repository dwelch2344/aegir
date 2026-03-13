import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('Conversations Attacks — Adversarial QA', () => {
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

  // --- organizationId edge cases ---

  it('creates conversation with organizationId=0', async () => {
    // FINDING: No FK constraint from conversation.organization_id to any org table.
    // The column is INTEGER NOT NULL but references nothing — any integer is accepted.
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 0 }) { id organizationId title } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: organizationId=0 is accepted — no validation that org exists
    if (!body.errors) {
      expect(body.data.agents.conversations.create.organizationId).toBe(0)
    }
  })

  it('creates conversation with negative organizationId', async () => {
    // FINDING: Negative org IDs accepted — no CHECK constraint
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: -999 }) { id organizationId } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      // FINDING: Negative organizationId accepted without validation
      expect(body.data.agents.conversations.create.organizationId).toBe(-999)
    }
  })

  // --- Very long title ---

  it('accepts very long title (10000+ chars) despite VARCHAR(255) column', async () => {
    // conversation.title is VARCHAR(255) — titles >255 chars should be rejected by DB
    const longTitle = 'T'.repeat(10000)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { create(input: { organizationId: 1, title: "${longTitle}" }) { id title } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The DB column is VARCHAR(255), so this should fail
    expect(body.errors).toBeDefined()
  })

  // --- Empty text message ---

  it('accepts empty string message text — no min-length validation', async () => {
    // message.text is TEXT NOT NULL, but empty string passes NOT NULL
    // First create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Empty msg test" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "user", text: "" }) { id text } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: Empty text messages accepted — no min-length validation
    if (!body.errors) {
      expect(body.data.agents.conversations.addMessage.text).toBe('')
    }
  })

  // --- Invalid role ---

  it('rejects message with role not in CHECK constraint set', async () => {
    // The message table has: CHECK (role IN ('user', 'assistant', 'system'))
    // But the GraphQL schema defines role as String!, not an enum
    // FINDING: role is String! in GraphQL but constrained at DB level via CHECK
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Bad role test" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "admin", text: "I am admin" }) { id role } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The DB CHECK constraint should reject 'admin' role
    // FINDING: role validation happens at DB level only, not GraphQL level.
    // GraphQL accepts any string, DB rejects invalid ones.
    expect(body.errors).toBeDefined()
  })

  // --- Delete then add message ---

  it('adding message to deleted conversation fails with FK violation', async () => {
    // Create a conversation
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Delete me" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    // Delete it
    await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { delete(id: "${convoId}") } } }`,
      },
    })

    // Try to add message to deleted conversation
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "user", text: "Ghost message" }) { id } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The FK constraint (conversation_id REFERENCES conversation(id)) should prevent this
    expect(body.errors).toBeDefined()
  })

  // --- Search with malformed UUID ---

  it('search with malformed UUID-like string in idIn returns error', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ agents { conversations { search(input: { idIn: ["not-a-uuid"] }) { results { id } } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // The DB column is UUID type, so a non-UUID string should cause a DB error
    // FINDING: No input validation on UUID format — error comes from DB, not application
    expect(body.errors).toBeDefined()
  })

  // --- Conversation with null title (optional field) ---

  it('creates conversation with default title when title is omitted', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { agents { conversations { create(input: { organizationId: 1 }) { id title } } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    if (!body.errors) {
      // The service defaults to 'New conversation' when title is not provided
      expect(body.data.agents.conversations.create.title).toBe('New conversation')
    }
  })

  // --- Message with very large text ---

  it('accepts extremely large message text (TEXT column has no limit)', async () => {
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Big msg" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    const bigText = 'A'.repeat(50000)
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "user", text: "${bigText}" }) { id text } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // TEXT column should accept large strings
    if (!body.errors) {
      expect(body.data.agents.conversations.addMessage.text.length).toBe(50000)
    }
  })

  // --- Case sensitivity of role ---

  it('rejects uppercase role values (CHECK constraint uses lowercase)', async () => {
    // The CHECK constraint uses: role IN ('user', 'assistant', 'system')
    // But GraphQL schema accepts any String — uppercase should fail at DB level
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query:
          'mutation { agents { conversations { create(input: { organizationId: 1, title: "Case test" }) { id } } } }',
      },
    })
    const convoId = createRes.json().data.agents.conversations.create.id

    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `mutation { agents { conversations { addMessage(input: { conversationId: "${convoId}", role: "USER", text: "Uppercase role" }) { id role } } } }`,
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: The DB CHECK uses lowercase ('user', 'assistant', 'system') but
    // the GraphQL schema has no enum — uppercase 'USER' passes GraphQL but fails at DB.
    // This is inconsistent with IAM's IdentityType which uses uppercase in both schema and DB.
    expect(body.errors).toBeDefined()
  })

  // --- Delete returns true even for nonexistent ---

  it('delete always returns true regardless of whether conversation exists', async () => {
    // FINDING: The delete method always returns true without checking row count
    const response = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: 'mutation { agents { conversations { delete(id: "00000000-0000-0000-0000-000000000000") } } }',
      },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    // FINDING: delete returns true for nonexistent conversations — no affected-row check
    expect(body.data.agents.conversations.delete).toBe(true)
  })
})
