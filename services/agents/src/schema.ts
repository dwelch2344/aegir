export const typeDefs = `
  type AgentsConversation @key(fields: "id") {
    id: ID!
    organizationId: Int!
    projectId: ID
    title: String!
    workflowId: String
    createdAt: String!
    updatedAt: String!
    messages: [AgentsMessage!]!
  }

  type AgentsMessage @key(fields: "id") {
    id: ID!
    conversationId: ID!
    role: String!
    text: String!
    createdAt: String!
  }

  type AgentsConversationSearch {
    results: [AgentsConversation!]!
  }

  input AgentsConversationSearchInput {
    idIn: [ID!]
    organizationId: Int
    projectId: ID
  }

  type AgentsConversations {
    search(input: AgentsConversationSearchInput!): AgentsConversationSearch!
  }

  type Agents {
    conversations: AgentsConversations!
  }

  input AgentsConversationCreateInput {
    organizationId: Int!
    projectId: ID
    title: String
  }

  input AgentsConversationUpdateInput {
    title: String
    workflowId: String
  }

  input AgentsMessageAddInput {
    conversationId: ID!
    role: String!
    text: String!
  }

  input AgentsSendMessageInput {
    conversationId: ID!
    text: String!
    projectId: ID
  }

  type AgentsSendMessageResult {
    userMessage: AgentsMessage!
    workflowId: String
  }

  input AgentsStreamChunkInput {
    conversationId: ID!
    text: String!
  }

  type AgentsConversationsOps {
    create(input: AgentsConversationCreateInput): AgentsConversation!
    update(id: ID!, input: AgentsConversationUpdateInput!): AgentsConversation
    delete(id: ID!): Boolean!
    addMessage(input: AgentsMessageAddInput!): AgentsMessage!
    sendMessage(input: AgentsSendMessageInput!): AgentsSendMessageResult!
    streamChunk(input: AgentsStreamChunkInput!): Boolean!
  }

  type AgentsOps {
    conversations: AgentsConversationsOps!
  }

  extend type Query {
    agents: Agents!
  }

  extend type Mutation {
    agents: AgentsOps!
  }

  extend type Subscription {
    agentsMessageAdded(conversationId: ID!): AgentsMessage!
  }
`
