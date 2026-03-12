export const typeDefs = `
  extend type Query {
    contracts(organizationId: Int!): [Contract!]!
    contract(id: ID!): Contract
    legal: Legal!
  }

  type Contract @key(fields: "id") {
    id: ID!
    organizationId: Int!
    status: ContractStatus!
    carrierId: String!
    carrierName: String!
    createdAt: String!
    updatedAt: String!
  }

  enum ContractStatus {
    DRAFT
    PENDING
    IN_REVIEW
    APPROVED
    ACTIVE
    EXPIRED
    CANCELLED
  }

  type Legal {
    contracting: LegalContracting!
  }

  type LegalContracting {
    workflowStatus(workflowId: ID!): LegalContractingWorkflowStatus
  }

  type LegalContractingWorkflowStatus {
    workflowId: ID!
    status: String!
    input: LegalContractingWorkflowInput
    output: LegalContractingWorkflowOutput
    tasks: [LegalContractingWorkflowTask!]!
  }

  type LegalContractingWorkflowInput {
    agentFirstName: String
    agentLastName: String
    agentEmail: String
    agentPhone: String
    agentNpn: String
    residentState: String
    requestedStates: [String!]
  }

  type LegalContractingWorkflowOutput {
    contractId: String
    approvedStates: [String!]
    status: String
    completedAt: String
    writingNumber: String
  }

  type LegalContractingWorkflowTaskLog {
    log: String!
    createdTime: String!
  }

  type LegalContractingWorkflowTask {
    name: String!
    taskRefName: String
    type: String
    status: String!
    startTime: String
    endTime: String
    logs: [LegalContractingWorkflowTaskLog!]!
    """ Task output data serialized as JSON string """
    outputData: String
    notes: [LegalNote!]!
  }

  extend type Mutation {
    legal: LegalOps!
  }

  type LegalOps {
    contracting: LegalContractingOps!
  }

  type LegalContractingOps {
    startSelectHealth(input: LegalStartSelectHealthInput!): LegalStartSelectHealthResult!
    approveStep(workflowId: ID!, taskRefName: String!): Boolean!
    addWorkflowTaskNote(workflowId: ID!, taskName: String!, content: String!): LegalNote!
  }

  enum LegalNoteVisibility {
    INTERNAL
  }

  type LegalNote {
    id: ID!
    authorIdentityId: Int!
    content: String!
    visibility: LegalNoteVisibility!
    createdAt: String!
    updatedAt: String!
  }

  input LegalStartSelectHealthInput {
    agentFirstName: String!
    agentLastName: String!
    agentEmail: String!
    agentPhone: String!
    agentNpn: String!
    residentState: String!
    requestedStates: [String!]!
    hasC4CoCertification: Boolean!
    hasCoLicense: Boolean!
  }

  type LegalStartSelectHealthResult {
    workflowId: ID!
  }
`
