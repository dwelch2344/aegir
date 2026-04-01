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
    keycloakId: String
    organizationId: Int
    memberships: [Membership!]!
  }

  type Organization @key(fields: "id") {
    id: Int!
    key: String!
    name: String!
    keycloakId: String
    protected: Boolean!
    memberships: [Membership!]!
    relationships: [OrgRelationship!]!
  }

  type Role @key(fields: "id") {
    id: Int!
    key: String!
    name: String!
    permissions: [RolePermission!]!
  }

  type RolePermission {
    id: Int!
    roleId: Int!
    permission: String!
    relationshipType: String!
  }

  type Membership @key(fields: "id") {
    id: Int!
    identityId: Int!
    organizationId: Int!
    identity: Identity!
    organization: Organization!
    roles: [Role!]!
  }

  type OrgRelationship {
    id: Int!
    ownerOrgId: Int!
    relatedOrgId: Int!
    relationshipType: String!
    ownerOrg: Organization!
    relatedOrg: Organization!
  }

  # --- Queries ---

  type IamIdentitySearch {
    results: [Identity!]!
  }

  input IamIdentitySearchInput {
    idIn: [Int!]
    labelLike: String
    emailLike: String
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

  type IamRoleSearch {
    results: [Role!]!
  }

  input IamRoleSearchInput {
    idIn: [Int!]
    keyIn: [String!]
  }

  type IamRoles {
    search(input: IamRoleSearchInput!): IamRoleSearch!
  }

  type IamMembershipSearch {
    results: [Membership!]!
  }

  input IamMembershipSearchInput {
    idIn: [Int!]
    identityIdIn: [Int!]
    organizationIdIn: [Int!]
  }

  type IamMemberships {
    search(input: IamMembershipSearchInput!): IamMembershipSearch!
  }

  type IamOrgRelationshipSearch {
    results: [OrgRelationship!]!
  }

  input IamOrgRelationshipSearchInput {
    ownerOrgIdIn: [Int!]
    relatedOrgIdIn: [Int!]
    relationshipTypeIn: [String!]
  }

  type IamOrgRelationships {
    search(input: IamOrgRelationshipSearchInput!): IamOrgRelationshipSearch!
  }

  type Iam {
    identities: IamIdentities!
    orgs: IamOrganizations!
    roles: IamRoles!
    memberships: IamMemberships!
    orgRelationships: IamOrgRelationships!
  }

  # --- Mutations ---

  input IamIdentitySyncInput {
    keycloakId: String!
    label: String!
    email: String!
  }

  type BootstrapResult {
    identity: Identity!
    isFirstUser: Boolean!
    systemMembership: Membership
  }

  type IamIdentitiesOps {
    sync(input: [IamIdentitySyncInput!]!): [Identity!]!
    """ Sync a single identity and auto-bootstrap as system org Owner if first user """
    bootstrap(input: IamIdentitySyncInput!): BootstrapResult!
  }

  input IamOrganizationSyncInput {
    keycloakId: String!
    key: String!
    name: String!
  }

  type IamOrganizationsOps {
    sync(input: [IamOrganizationSyncInput!]!): [Organization!]!
  }

  input IamRoleCreateInput {
    key: String!
    name: String!
  }

  input IamRolePermissionInput {
    roleId: Int!
    permission: String!
    relationshipType: String!
  }

  type IamRolesOps {
    create(input: IamRoleCreateInput!): Role!
    addPermission(input: IamRolePermissionInput!): RolePermission
    removePermission(input: IamRolePermissionInput!): Boolean!
  }

  input IamMembershipCreateInput {
    identityId: Int!
    organizationId: Int!
    roleIds: [Int!]
  }

  input IamMembershipRoleInput {
    membershipId: Int!
    roleId: Int!
  }

  type IamMembershipsOps {
    create(input: IamMembershipCreateInput!): Membership!
    delete(membershipId: Int!): Boolean!
    assignRole(input: IamMembershipRoleInput!): Boolean!
    removeRole(input: IamMembershipRoleInput!): Boolean!
  }

  input IamOrgRelationshipCreateInput {
    ownerOrgId: Int!
    relatedOrgId: Int!
    relationshipType: String!
  }

  type IamOrgRelationshipsOps {
    create(input: IamOrgRelationshipCreateInput!): OrgRelationship
    delete(id: Int!): Boolean!
  }

  type IamOps {
    identities: IamIdentitiesOps!
    orgs: IamOrganizationsOps!
    roles: IamRolesOps!
    memberships: IamMembershipsOps!
    orgRelationships: IamOrgRelationshipsOps!
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
