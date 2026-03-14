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
    commits: [ProjectsCommit!]!
    diagnosticsReport: ProjectsDiagnosticsReport
    activities: [ProjectsActivity!]!
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

  type ProjectsCommit {
    sha: String!
    message: String!
    url: String
  }

  type ProjectsDiagnosticsReport {
    id: ID!
    projectId: ID!
    report: String!
    createdAt: String!
  }

  type ProjectsActivity {
    id: ID!
    projectId: ID!
    workflowId: String!
    type: String!
    status: String!
    entries: [ProjectsActivityEntry!]!
    startedAt: String!
    completedAt: String
  }

  type ProjectsActivityEntry {
    id: ID!
    activityId: ID!
    taskName: String!
    status: String!
    message: String!
    createdAt: String!
  }

  type ProjectsActivityEvent {
    activityId: ID!
    projectId: ID!
    type: String!
    taskName: String
    status: String!
    message: String!
    timestamp: String!
  }

  input ProjectsActivityLogInput {
    projectId: ID!
    workflowId: String!
    type: String!
    taskName: String!
    status: String!
    message: String
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

  input ProjectsServiceInput {
    name: String!
    type: String!
    port: Int!
  }

  input ProjectsPatternInput {
    patternId: String!
    version: String!
    appliedAt: String
  }

  input ProjectsStatusReportInput {
    projectId: ID!
    issues: [String!]!
    servicesOk: Int!
    servicesMissing: Int!
    outdatedPatterns: Int!
  }

  input ProjectsDiagnosticsReportInput {
    projectId: ID!
    report: String!
  }

  type ProjectsProjectsOps {
    create(input: ProjectsProjectCreateInput!): ProjectsProject!
    update(id: ID!, input: ProjectsProjectUpdateInput!): ProjectsProject
    delete(id: ID!): Boolean!
    sync(id: ID!): ProjectsSyncResult!
    replaceServices(projectId: ID!, services: [ProjectsServiceInput!]!): Boolean!
    replacePatterns(projectId: ID!, patterns: [ProjectsPatternInput!]!): Boolean!
    saveStatusReport(input: ProjectsStatusReportInput!): ProjectsStatusReport!
    checkStatus(id: ID!): ProjectsSyncResult!
    applyPattern(id: ID!, patternId: String!, params: String): ProjectsSyncResult!
    runDiagnostics(id: ID!): ProjectsSyncResult!
    saveDiagnosticsReport(input: ProjectsDiagnosticsReportInput!): ProjectsDiagnosticsReport!
    logActivity(input: ProjectsActivityLogInput!): ProjectsActivityEvent!
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

  extend type Subscription {
    projectsActivityUpdated(projectId: ID!): ProjectsActivityEvent!
  }
`
