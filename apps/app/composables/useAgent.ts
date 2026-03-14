import { readonly, ref } from 'vue'

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: string
}

export interface Conversation {
  id: string
  organizationId: number
  title: string
  workflowId: string | null
  createdAt: string
  updatedAt: string
}

function getWsUrls() {
  const config = useRuntimeConfig()
  return {
    iamWsUrl: config.public.iamWsUrl as string,
    agentsWsUrl: config.public.agentsWsUrl as string,
  }
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const config = useRuntimeConfig()
  const url = config.public.gatewayUrl as string
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }
  const json = await response.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0].message)
  }
  return json.data as T
}

// Shared reactive state
const conversations = ref<Conversation[]>([])
const activeId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const connected = ref(false)
const connecting = ref(false)
const loading = ref(false)

let notifSocket: WebSocket | null = null
let agentSocket: WebSocket | null = null

export function useAgent() {
  const { activeOrgId } = useOrg()

  function getOrgId(): number {
    const id = activeOrgId.value
    if (id == null) throw new Error('No active organization')
    return id
  }

  async function fetchConversations() {
    loading.value = true
    try {
      const orgId = getOrgId()
      const data = await gql<{ agents: { conversations: { search: { results: Conversation[] } } } }>(
        `query($input: AgentsConversationSearchInput!) { agents { conversations { search(input: $input) { results { id organizationId title workflowId createdAt updatedAt } } } } }`,
        { input: { organizationId: orgId } },
      )
      conversations.value = data.agents.conversations.search.results
    } catch {
      // gateway may be down
    } finally {
      loading.value = false
    }
  }

  async function createConversation(title?: string): Promise<string> {
    const orgId = getOrgId()
    const data = await gql<{ agents: { conversations: { create: Conversation } } }>(
      `mutation($input: AgentsConversationCreateInput!) { agents { conversations { create(input: $input) { id organizationId title workflowId createdAt updatedAt } } } }`,
      { input: { organizationId: orgId, ...(title ? { title } : {}) } },
    )
    const convo = data.agents.conversations.create
    conversations.value.unshift(convo)
    return convo.id
  }

  async function loadConversation(id: string) {
    disconnectSockets()
    activeId.value = id

    try {
      const data = await gql<{
        agents: { conversations: { search: { results: Array<Conversation & { messages: ChatMessage[] }> } } }
      }>(
        `query($input: AgentsConversationSearchInput!) {
          agents { conversations { search(input: $input) {
            results { id organizationId title workflowId createdAt updatedAt messages { id conversationId role text createdAt } }
          } } }
        }`,
        { input: { idIn: [id] } },
      )
      const convo = data.agents.conversations.search.results[0]
      if (convo) {
        messages.value = convo.messages
      }
    } catch {
      messages.value = []
    }

    // Subscribe to real-time messages for this conversation
    await subscribeToMessages(id)
  }

  async function deleteConversation(id: string) {
    try {
      await gql(`mutation($id: ID!) { agents { conversations { delete(id: $id) } } }`, { id })
    } catch {
      /* best effort */
    }
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeId.value === id) {
      activeId.value = null
      messages.value = []
    }
  }

  async function addMessage(role: ChatMessage['role'], text: string) {
    if (!activeId.value) {
      activeId.value = await createConversation()
    }

    const data = await gql<{ agents: { conversations: { addMessage: ChatMessage } } }>(
      `mutation($input: AgentsMessageAddInput!) {
        agents { conversations { addMessage(input: $input) { id conversationId role text createdAt } } }
      }`,
      { input: { conversationId: activeId.value, role, text } },
    )
    messages.value.push(data.agents.conversations.addMessage)

    // Auto-title from first user message
    if (role === 'user') {
      const convo = conversations.value.find((c) => c.id === activeId.value)
      if (convo && convo.title === 'New conversation') {
        const title = text.length > 40 ? text.slice(0, 40) + '...' : text
        convo.title = title
        gql(
          `mutation($id: ID!, $input: AgentsConversationUpdateInput!) { agents { conversations { update(id: $id, input: $input) { id } } } }`,
          { id: activeId.value, input: { title } },
        ).catch(() => {})
      }
    }
  }

  /** graphql-ws protocol init + subscribe */
  function wsSubscribe(ws: WebSocket, id: string, query: string, variables?: Record<string, unknown>) {
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init' }))
    })
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'connection_ack') {
        ws.send(
          JSON.stringify({
            id,
            type: 'subscribe',
            payload: { query, variables },
          }),
        )
      }
    })
  }

  /** Subscribe to real-time messages for a conversation. Returns a promise that resolves once the subscription is active. */
  function subscribeToMessages(conversationId: string): Promise<void> {
    // Close previous agent subscription if any
    agentSocket?.close()
    agentSocket = null

    return new Promise((resolve) => {
      const { agentsWsUrl } = getWsUrls()
      const ws = new WebSocket(agentsWsUrl, 'graphql-transport-ws')
      agentSocket = ws

      const query = `subscription($conversationId: ID!) {
        agentsMessageAdded(conversationId: $conversationId) { id conversationId role text createdAt }
      }`

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'connection_init' }))
      })

      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'connection_ack') {
          ws.send(
            JSON.stringify({
              id: 'agent-msg',
              type: 'subscribe',
              payload: { query, variables: { conversationId } },
            }),
          )
          // Subscription is now active
          resolve()
        }
        if (msg.type === 'next' && msg.id === 'agent-msg') {
          const incoming = msg.payload.data.agentsMessageAdded as ChatMessage
          const isStreamChunk = incoming.id.startsWith('stream-')

          // Find an existing placeholder to replace: thinking-* or previous stream-*
          const placeholderIdx = messages.value.findIndex(
            (m) => m.id.startsWith('thinking-') || m.id.startsWith('stream-'),
          )

          if (placeholderIdx !== -1) {
            const updated = [...messages.value]
            updated[placeholderIdx] = incoming
            messages.value = updated
          } else if (!isStreamChunk) {
            // Final message — avoid duplicates
            if (!messages.value.some((m) => m.id === incoming.id)) {
              messages.value = [...messages.value, incoming]
            }
          } else {
            // First stream chunk, no placeholder yet — append
            messages.value = [...messages.value, incoming]
          }
        }
      })

      ws.addEventListener('error', () => {
        agentSocket = null
        resolve() // Don't block sendMessage on error
      })
      ws.addEventListener('close', () => {
        agentSocket = null
      })
    })
  }

  async function sendMessage(message: string, projectId?: string) {
    if (!activeId.value) {
      activeId.value = await createConversation()
    }

    const conversationId = activeId.value!

    // Ensure we're subscribed before sending — wait for WebSocket to be ready
    if (!agentSocket || agentSocket.readyState !== WebSocket.OPEN) {
      await subscribeToMessages(conversationId)
    }

    // Optimistic user message
    const tempUserId = `temp-user-${Date.now()}`
    messages.value = [
      ...messages.value,
      {
        id: tempUserId,
        conversationId,
        role: 'user',
        text: message,
        createdAt: new Date().toISOString(),
      },
    ]

    // Auto-title from first user message
    const convo = conversations.value.find((c) => c.id === conversationId)
    if (convo && convo.title === 'New conversation') {
      convo.title = message.length > 40 ? message.slice(0, 40) + '...' : message
    }

    // Thinking placeholder
    messages.value = [
      ...messages.value,
      {
        id: `thinking-${Date.now()}`,
        conversationId,
        role: 'assistant',
        text: '...',
        createdAt: new Date().toISOString(),
      },
    ]

    try {
      // Send via GraphQL mutation — saves user msg, triggers Conductor workflow
      const data = await gql<{
        agents: { conversations: { sendMessage: { userMessage: ChatMessage; workflowId: string } } }
      }>(
        `mutation($input: AgentsSendMessageInput!) {
          agents { conversations { sendMessage(input: $input) {
            userMessage { id conversationId role text createdAt }
            workflowId
          } } }
        }`,
        { input: { conversationId, text: message, ...(projectId ? { projectId } : {}) } },
      )

      // Replace temp user message with the real persisted one
      const { userMessage } = data.agents.conversations.sendMessage
      const idx = messages.value.findIndex((m) => m.id === tempUserId)
      if (idx !== -1) {
        const updated = [...messages.value]
        updated[idx] = userMessage
        messages.value = updated
      }

      // Assistant response will arrive via the subscription — no polling needed
    } catch (err: any) {
      // Remove optimistic messages and show error
      messages.value = messages.value.filter((m) => !m.id.startsWith('temp-') && !m.id.startsWith('thinking-'))
      messages.value = [
        ...messages.value,
        {
          id: `err-${Date.now()}`,
          conversationId,
          role: 'system',
          text: `Error: ${err?.message || 'Failed to send message'}`,
          createdAt: new Date().toISOString(),
        },
      ]
    }
  }

  async function connectNotifications(topic?: string) {
    if (notifSocket) return
    if (!activeId.value) {
      activeId.value = await createConversation()
    }
    connecting.value = true

    const { iamWsUrl } = getWsUrls()
    const ws = new WebSocket(iamWsUrl, 'graphql-transport-ws')
    notifSocket = ws

    const variables: Record<string, unknown> = {}
    if (topic) variables.topic = topic

    const query = `subscription($topic: String) { iamNotifications(topic: $topic) { id topic message sentAt } }`
    wsSubscribe(ws, 'notif', query, variables)

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'connection_ack') {
        connected.value = true
        connecting.value = false
      }
      if (msg.type === 'next' && msg.id === 'notif') {
        const n = msg.payload.data.iamNotifications
        addMessage('assistant', `[${n.topic}] ${n.message}`)
      }
    })

    ws.addEventListener('close', () => {
      connected.value = false
      connecting.value = false
      notifSocket = null
    })

    ws.addEventListener('error', () => {
      connected.value = false
      connecting.value = false
      notifSocket = null
    })
  }

  function disconnectSockets() {
    notifSocket?.close()
    notifSocket = null
    agentSocket?.close()
    agentSocket = null
    connected.value = false
  }

  async function clearConversation() {
    if (activeId.value) {
      await deleteConversation(activeId.value)
    }
    activeId.value = null
    messages.value = []
  }

  function newConversation() {
    disconnectSockets()
    activeId.value = null
    messages.value = []
  }

  /** Reset state and refetch for the new org (called on org switch) */
  function handleOrgSwitch() {
    disconnectSockets()
    activeId.value = null
    messages.value = []
    conversations.value = []
    fetchConversations()
  }

  return {
    conversations: readonly(conversations),
    activeId: readonly(activeId),
    messages: readonly(messages),
    connected: readonly(connected),
    connecting: readonly(connecting),
    loading: readonly(loading),
    fetchConversations,
    newConversation,
    loadConversation,
    deleteConversation,
    sendMessage,
    connectNotifications,
    disconnect: disconnectSockets,
    clearConversation,
    handleOrgSwitch,
  }
}
