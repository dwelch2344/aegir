export const typeDefs = `
  enum TenantIntegrationStatus {
    ACTIVE
    INACTIVE
    PENDING
    ERROR
    SUSPENDED
  }

  type Tenant @key(fields: "id") {
    id: ID!
    key: String!
    name: String!
    integrations: [TenantIntegration!]!
  }

  type TenantOps @key(fields: "id") {
    id: ID!
    key: String!
    name: String!
    integrations: TenantIntegrationOps!
  }

  type System {
    metadata: String
    integrations: SystemIntegrations!
  }

  type SystemIntegrations {
    search(input: SystemIntegrationSearchInput!): SystemIntegrationSearch!
  }

  type SystemIntegrationSearch {
    results: [SystemIntegration!]!
  }

  input SystemIntegrationSearchInput {
    idIn: [Int!]
    keyIn: [String!]
  }

  type SystemIntegration @key(fields: "id") {
    id: Int!
    key: String!
    name: String!
    metadata: String!
  }

  type TenantIntegration {
    integration: SystemIntegration!
    integrationKey: String!
    status: TenantIntegrationStatus!
    name: String!
    metadata: String!
    ordinal: Int
  }

  input TenantIntegrationUpsertInput {
    integrationKey: String!
    status: TenantIntegrationStatus
    name: String
    metadata: String
    ordinal: Int
  }

  type TenantIntegrationOps {
    upsert(input: TenantIntegrationUpsertInput!): TenantIntegration!
  }

  input SystemTenantCreateInput {
    key: String!
    name: String!
  }

  input SystemTenantUpdateInput {
    name: String
  }

  input SystemIntegrationUpsertInput {
    key: String!
    name: String!
    metadata: String
  }

  type SystemOps {
    createTenant(input: SystemTenantCreateInput!): Tenant!
    updateTenant(key: String!, input: SystemTenantUpdateInput!): Tenant!
    upsertIntegration(input: SystemIntegrationUpsertInput!): SystemIntegration!
  }

  extend type Query {
    tenant(key: String!): Tenant!
    system: System!
  }

  extend type Mutation {
    tenant(key: String!): TenantOps!
    system: SystemOps!
  }
`
