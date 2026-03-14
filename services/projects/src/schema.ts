export const typeDefs = `
  enum ProjectsStatus {
    PENDING
    CLONING
    READY
    ERROR
    STALE
  }

  type ProjectsProject @key(fields: "id") {
    id: ID!
    organizationId: Int!
    name: String!
    repoUrl: String!
    branch: String!
    localPath: String
    status: ProjectsStatus!
    lastSyncedAt: String
    manifestRaw: String
    createdAt: String!
    updatedAt: String!
    services: [ProjectsService!]!
    patterns: [ProjectsPattern!]!
    statusReport: ProjectsStatusReport
  }

  type ProjectsService {
    id: ID!
    projectId: ID!
    name: String!
    type: String!
    port: Int!
  }

  type ProjectsPattern {
    id: ID!
    projectId: ID!
    patternId: String!
    version: String!
    appliedAt: String
  }

  type ProjectsStatusReport {
    id: ID!
    projectId: ID!
    issues: [String!]!
    servicesOk: Int!
    servicesMissing: Int!
    outdatedPatterns: Int!
    checkedAt: String!
  }

  type ProjectsProjectSearch {
    results: [ProjectsProject!]!
  }

  input ProjectsProjectSearchInput {
    idIn: [ID!]
    organizationId: Int
  }

  type ProjectsProjects {
    search(input: ProjectsProjectSearchInput!): ProjectsProjectSearch!
  }

  type Projects {
    projects: ProjectsProjects!
  }

  input ProjectsProjectCreateInput {
    organizationId: Int!
    name: String!
    repoUrl: String!
    branch: String
  }

  input ProjectsProjectUpdateInput {
    name: String
    branch: String
    status: ProjectsStatus
    localPath: String
    manifestRaw: String
    lastSyncedAt: String
  }

  type ProjectsProjectsOps {
    create(input: ProjectsProjectCreateInput!): ProjectsProject!
    update(id: ID!, input: ProjectsProjectUpdateInput!): ProjectsProject
    delete(id: ID!): Boolean!
    sync(id: ID!): ProjectsSyncResult!
  }

  type ProjectsSyncResult {
    projectId: ID!
    workflowId: String!
  }

  type ProjectsOps {
    projects: ProjectsProjectsOps!
  }

  extend type Query {
    projects: Projects!
  }

  extend type Mutation {
    projects: ProjectsOps!
  }
`
