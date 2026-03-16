export const typeDefs = `
  # ─── Context ────────────────────────────────────────────────

  type PracticesContextFile @key(fields: "id") {
    id: ID!
    organizationId: Int!
    tier: String!
    path: String!
    description: String!
    content: String
    sortOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type PracticesContextTopic @key(fields: "id") {
    id: ID!
    organizationId: Int!
    topicId: String!
    systemPath: String!
    projectPath: String!
    systemContent: String
    projectContent: String
    triggerFiles: [String!]!
    triggerKeywords: [String!]!
    triggerCatalogRefs: [String!]!
    sortOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type PracticesContextFileSearch {
    results: [PracticesContextFile!]!
  }

  type PracticesContextTopicSearch {
    results: [PracticesContextTopic!]!
  }

  input PracticesContextFileSearchInput {
    organizationId: Int
    tier: String
  }

  input PracticesContextTopicSearchInput {
    organizationId: Int
  }

  type PracticesContextFiles {
    search(input: PracticesContextFileSearchInput!): PracticesContextFileSearch!
  }

  type PracticesContextTopics {
    search(input: PracticesContextTopicSearchInput!): PracticesContextTopicSearch!
  }

  type PracticesContext {
    files: PracticesContextFiles!
    topics: PracticesContextTopics!
  }

  input PracticesContextFileUpsertInput {
    organizationId: Int!
    tier: String!
    path: String!
    description: String
    content: String
  }

  input PracticesContextFileUpdateContentInput {
    content: String!
  }

  input PracticesContextTopicUpsertInput {
    organizationId: Int!
    topicId: String!
    systemPath: String
    projectPath: String
    systemContent: String
    projectContent: String
    triggerFiles: [String!]
    triggerKeywords: [String!]
    triggerCatalogRefs: [String!]
  }

  input PracticesContextTopicUpdateContentInput {
    systemContent: String
    projectContent: String
  }

  type PracticesContextFilesOps {
    upsert(input: PracticesContextFileUpsertInput!): PracticesContextFile!
    updateContent(id: ID!, input: PracticesContextFileUpdateContentInput!): PracticesContextFile
    delete(id: ID!): Boolean!
  }

  type PracticesContextTopicsOps {
    upsert(input: PracticesContextTopicUpsertInput!): PracticesContextTopic!
    updateContent(id: ID!, input: PracticesContextTopicUpdateContentInput!): PracticesContextTopic
    delete(id: ID!): Boolean!
  }

  type PracticesContextOps {
    files: PracticesContextFilesOps!
    topics: PracticesContextTopicsOps!
  }

  # ─── BCP ────────────────────────────────────────────────────

  type PracticesBcpCategory @key(fields: "id") {
    id: ID!
    organizationId: Int!
    categoryId: String!
    label: String!
    color: String!
    description: String!
    sortOrder: Int!
    entries: [PracticesBcpEntry!]!
    createdAt: String!
    updatedAt: String!
  }

  type PracticesBcpEntry @key(fields: "id") {
    id: ID!
    categoryId: ID!
    organizationId: Int!
    entryId: String!
    title: String!
    description: String!
    content: String
    sortOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type PracticesBcpCategorySearch {
    results: [PracticesBcpCategory!]!
  }

  input PracticesBcpCategorySearchInput {
    organizationId: Int
  }

  type PracticesBcpCategories {
    search(input: PracticesBcpCategorySearchInput!): PracticesBcpCategorySearch!
  }

  type PracticesBcp {
    categories: PracticesBcpCategories!
  }

  input PracticesBcpCategoryUpsertInput {
    organizationId: Int!
    categoryId: String!
    label: String!
    color: String
    description: String
    sortOrder: Int
  }

  input PracticesBcpEntryUpsertInput {
    organizationId: Int!
    categoryId: ID!
    entryId: String!
    title: String!
    description: String
    content: String
  }

  input PracticesBcpEntryUpdateContentInput {
    content: String!
  }

  type PracticesBcpCategoriesOps {
    upsert(input: PracticesBcpCategoryUpsertInput!): PracticesBcpCategory!
    delete(id: ID!): Boolean!
  }

  type PracticesBcpEntriesOps {
    upsert(input: PracticesBcpEntryUpsertInput!): PracticesBcpEntry!
    updateContent(id: ID!, input: PracticesBcpEntryUpdateContentInput!): PracticesBcpEntry
    delete(id: ID!): Boolean!
  }

  type PracticesBcpOps {
    categories: PracticesBcpCategoriesOps!
    entries: PracticesBcpEntriesOps!
  }

  # ─── Catalog ────────────────────────────────────────────────

  type PracticesCatalogEntry @key(fields: "id") {
    id: ID!
    organizationId: Int!
    patternId: String!
    name: String!
    version: String!
    description: String!
    preconditions: [String!]!
    provides: [String!]!
    parameters: String
    applicationInstructions: String!
    testCriteria: String!
    createdAt: String!
    updatedAt: String!
  }

  type PracticesCatalogEntrySearch {
    results: [PracticesCatalogEntry!]!
  }

  input PracticesCatalogEntrySearchInput {
    organizationId: Int
    idIn: [ID!]
    patternIdIn: [String!]
  }

  type PracticesCatalogEntries {
    search(input: PracticesCatalogEntrySearchInput!): PracticesCatalogEntrySearch!
  }

  type PracticesCatalog {
    entries: PracticesCatalogEntries!
  }

  input PracticesCatalogEntryUpsertInput {
    organizationId: Int!
    patternId: String!
    name: String!
    version: String
    description: String
    preconditions: [String!]
    provides: [String!]
    parameters: String
    applicationInstructions: String
    testCriteria: String
  }

  input PracticesCatalogEntryUpdateInput {
    name: String
    version: String
    description: String
    applicationInstructions: String
    testCriteria: String
  }

  type PracticesCatalogEntriesOps {
    upsert(input: PracticesCatalogEntryUpsertInput!): PracticesCatalogEntry!
    update(id: ID!, input: PracticesCatalogEntryUpdateInput!): PracticesCatalogEntry
    delete(id: ID!): Boolean!
  }

  type PracticesCatalogOps {
    entries: PracticesCatalogEntriesOps!
  }

  # ─── Root ───────────────────────────────────────────────────

  type Practices {
    context: PracticesContext!
    bcp: PracticesBcp!
    catalog: PracticesCatalog!
  }

  type PracticesOps {
    context: PracticesContextOps!
    bcp: PracticesBcpOps!
    catalog: PracticesCatalogOps!
  }

  extend type Query {
    practices: Practices!
  }

  extend type Mutation {
    practices: PracticesOps!
  }
`
