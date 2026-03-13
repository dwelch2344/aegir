export const typeDefs = `
  enum IdentityType {
    USER
    SUPER_USER
    SERVICE_ACCOUNT
  }

  type Identity @key(fields: "id") {
    id: Int!
    type: IdentityType!
    label: String!
    email: String!
    organizationId: Int
  }

  type Organization @key(fields: "id") {
    id: Int!
    key: String!
    name: String!
    keycloakId: String
    protected: Boolean!
  }

  type IamIdentitySearch {
    results: [Identity!]!
  }

  input IamIdentitySearchInput {
    idIn: [Int!]
    labelLike: String
  }

  type IamIdentities {
    search(input: IamIdentitySearchInput!): IamIdentitySearch!
  }

  type IamOrganizationSearch {
    results: [Organization!]!
  }

  input IamOrganizationSearchInput {
    idIn: [Int!]
    keycloakIdIn: [String!]
    keyLike: String
    nameLike: String
  }

  type IamOrganizations {
    search(input: IamOrganizationSearchInput!): IamOrganizationSearch!
  }

  type Iam {
    identities: IamIdentities!
    orgs: IamOrganizations!
  }

  type IamIdentitiesOps {
    _placeholder: String
  }

  input IamOrganizationSyncInput {
    keycloakId: String!
    key: String!
    name: String!
  }

  type IamOrganizationsOps {
    sync(input: [IamOrganizationSyncInput!]!): [Organization!]!
  }

  type IamOps {
    identities: IamIdentitiesOps!
    orgs: IamOrganizationsOps!
  }

  extend type Query {
    iam: Iam!
  }

  extend type Mutation {
    iam: IamOps!
  }

  type IamEchoMessage {
    message: String!
    echoedAt: String!
  }

  type IamNotification {
    id: ID!
    topic: String!
    message: String!
    sentAt: String!
  }

  type Subscription {
    iamEcho(message: String!): IamEchoMessage!
    iamNotifications(topic: String): IamNotification!
  }
`
