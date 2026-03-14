import type { TaskDef, WorkflowDef } from './conductor.js'

const shTaskOwner = 'contracting@aegir.local'

export const selectHealthTaskDefs: TaskDef[] = [
  {
    name: 'sh_validate_agent_info',
    description: 'Validates agent information and checks residency eligibility for Select Health',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 30,
    responseTimeoutSeconds: 15,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_create_sircon_affiliation',
    description: 'Creates Sircon DOI affiliation with Health First for the agent',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_request_contract',
    description: 'Sends contracting request email to Select Health and updates Agent Intel',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_agent_signs_docusign',
    description: 'Handles DocuSign delivery to agent and agent signature',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_hf_countersign_and_training',
    description: 'HF countersigns DocuSign, agent training, and Andrew Freeze signs',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_carrier_processing',
    description: 'Waits for Select Health carrier processing and document distribution',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
  {
    name: 'sh_finalize_contract',
    description: 'Files documents, completes Agent Intel record, sends RTS confirmation',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: shTaskOwner,
  },
]

export const selectHealthAcaWorkflow: WorkflowDef = {
  name: 'select_health_aca_new_contract',
  description:
    'Select Health ACA new contract process: validate agent, create affiliations, process DocuSign, finalize',
  version: 2,
  schemaVersion: 2,
  ownerEmail: shTaskOwner,
  tasks: [
    {
      name: 'sh_validate_agent_info',
      taskReferenceName: 'sh_validate_agent_info_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentFirstName: '${workflow.input.agentFirstName}',
        agentLastName: '${workflow.input.agentLastName}',
        agentEmail: '${workflow.input.agentEmail}',
        agentPhone: '${workflow.input.agentPhone}',
        agentNpn: '${workflow.input.agentNpn}',
        residentState: '${workflow.input.residentState}',
        requestedStates: '${workflow.input.requestedStates}',
        hasC4CoCertification: '${workflow.input.hasC4CoCertification}',
        hasCoLicense: '${workflow.input.hasCoLicense}',
        ignoreValidationErrors: '${workflow.input.ignoreValidationErrors}',
      },
    },
    {
      name: 'sh_create_sircon_affiliation',
      taskReferenceName: 'sh_create_sircon_affiliation_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentNpn: '${workflow.input.agentNpn}',
        agentLastName: '${workflow.input.agentLastName}',
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
      },
    },
    {
      name: 'sh_request_contract',
      taskReferenceName: 'sh_request_contract_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentFirstName: '${workflow.input.agentFirstName}',
        agentLastName: '${workflow.input.agentLastName}',
        agentEmail: '${workflow.input.agentEmail}',
        agentPhone: '${workflow.input.agentPhone}',
        approvedStates: '${sh_validate_agent_info_ref.output.approvedStates}',
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
      },
    },
    {
      name: 'sh_agent_signs_docusign',
      taskReferenceName: 'sh_agent_signs_docusign_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentEmail: '${workflow.input.agentEmail}',
        agentFullName: '${sh_validate_agent_info_ref.output.agentFullName}',
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
      },
    },
    {
      name: 'sh_await_agent_signature',
      taskReferenceName: 'sh_await_agent_signature_ref',
      type: 'WAIT',
      inputParameters: {},
    },
    {
      name: 'sh_hf_countersign_and_training',
      taskReferenceName: 'sh_hf_countersign_and_training_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentEmail: '${workflow.input.agentEmail}',
        agentFullName: '${sh_validate_agent_info_ref.output.agentFullName}',
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
      },
    },
    {
      name: 'sh_carrier_processing',
      taskReferenceName: 'sh_carrier_processing_ref',
      type: 'SIMPLE',
      inputParameters: {
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
        agentFullName: '${sh_validate_agent_info_ref.output.agentFullName}',
      },
    },
    {
      name: 'sh_finalize_contract',
      taskReferenceName: 'sh_finalize_contract_ref',
      type: 'SIMPLE',
      inputParameters: {
        agentEmail: '${workflow.input.agentEmail}',
        agentFullName: '${sh_validate_agent_info_ref.output.agentFullName}',
        contractId: '${sh_validate_agent_info_ref.output.contractId}',
        approvedStates: '${sh_validate_agent_info_ref.output.approvedStates}',
      },
    },
  ],
  outputParameters: {
    contractId: '${sh_validate_agent_info_ref.output.contractId}',
    approvedStates: '${sh_validate_agent_info_ref.output.approvedStates}',
    status: '${sh_finalize_contract_ref.output.status}',
    completedAt: '${sh_finalize_contract_ref.output.completedAt}',
    writingNumber: '${sh_finalize_contract_ref.output.writingNumber}',
  },
}

// --- Agent Chat workflow ---

const agentChatOwner = 'agents@aegir.local'

export const agentChatTaskDefs: TaskDef[] = [
  {
    name: 'agent_gather_context',
    description: 'Fetches conversation history from the agents service',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 3,
    timeoutSeconds: 15,
    responseTimeoutSeconds: 10,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: agentChatOwner,
  },
  {
    name: 'agent_invoke_claude',
    description: 'Invokes the Claude CLI with conversation context and user message',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 120,
    responseTimeoutSeconds: 120,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: agentChatOwner,
  },
  {
    name: 'agent_deliver_response',
    description: 'Delivers the Claude response back to the agents service as an assistant message',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 3,
    timeoutSeconds: 15,
    responseTimeoutSeconds: 10,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: agentChatOwner,
  },
]

export const agentChatWorkflow: WorkflowDef = {
  name: 'agent_chat_conversation',
  description: 'Long-lived agent chat — loops waiting for human messages until closed',
  version: 1,
  schemaVersion: 2,
  ownerEmail: agentChatOwner,
  tasks: [
    {
      name: 'chat_loop',
      taskReferenceName: 'chat_loop_ref',
      type: 'DO_WHILE',
      loopCondition: "$.agent_wait_for_message_ref['action'] != 'close'",
      loopOver: [
        {
          name: 'agent_wait_for_message',
          taskReferenceName: 'agent_wait_for_message_ref',
          type: 'WAIT',
          inputParameters: {},
        },
        {
          name: 'agent_gather_context',
          taskReferenceName: 'agent_gather_context_ref',
          type: 'SIMPLE',
          inputParameters: {
            conversationId: '${workflow.input.conversationId}',
          },
        },
        {
          name: 'agent_invoke_claude',
          taskReferenceName: 'agent_invoke_claude_ref',
          type: 'SIMPLE',
          inputParameters: {
            text: '${agent_wait_for_message_ref.output.text}',
            messages: '${agent_gather_context_ref.output.messages}',
          },
        },
        {
          name: 'agent_deliver_response',
          taskReferenceName: 'agent_deliver_response_ref',
          type: 'SIMPLE',
          inputParameters: {
            conversationId: '${workflow.input.conversationId}',
            response: '${agent_invoke_claude_ref.output.response}',
          },
        },
      ],
    },
  ],
}

// --- Project sync workflow ---

const projectsOwner = 'projects@aegir.local'

export const projectSyncTaskDefs: TaskDef[] = [
  {
    name: 'project_clone',
    description: 'Clones or pulls the project repository to a local workspace',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 5,
    timeoutSeconds: 120,
    responseTimeoutSeconds: 120,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: projectsOwner,
  },
  {
    name: 'project_parse_manifest',
    description: 'Reads and parses the shipyard.manifest from the cloned project',
    retryCount: 1,
    retryLogic: 'FIXED',
    retryDelaySeconds: 3,
    timeoutSeconds: 15,
    responseTimeoutSeconds: 10,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: projectsOwner,
  },
  {
    name: 'project_store_metadata',
    description: 'Stores parsed manifest data (services, patterns) in the projects service',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 3,
    timeoutSeconds: 30,
    responseTimeoutSeconds: 15,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: projectsOwner,
  },
]

export const projectSyncWorkflow: WorkflowDef = {
  name: 'project_sync',
  description: 'Clone a project repo, parse its manifest, and store metadata',
  version: 1,
  schemaVersion: 2,
  ownerEmail: projectsOwner,
  tasks: [
    {
      name: 'project_clone',
      taskReferenceName: 'project_clone_ref',
      type: 'SIMPLE',
      inputParameters: {
        projectId: '${workflow.input.projectId}',
        repoUrl: '${workflow.input.repoUrl}',
        branch: '${workflow.input.branch}',
      },
    },
    {
      name: 'project_parse_manifest',
      taskReferenceName: 'project_parse_manifest_ref',
      type: 'SIMPLE',
      inputParameters: {
        localPath: '${project_clone_ref.output.localPath}',
      },
    },
    {
      name: 'project_store_metadata',
      taskReferenceName: 'project_store_metadata_ref',
      type: 'SIMPLE',
      inputParameters: {
        projectId: '${workflow.input.projectId}',
        localPath: '${project_clone_ref.output.localPath}',
        manifestRaw: '${project_parse_manifest_ref.output.manifestRaw}',
        services: '${project_parse_manifest_ref.output.services}',
        patterns: '${project_parse_manifest_ref.output.patterns}',
      },
    },
  ],
  outputParameters: {
    localPath: '${project_clone_ref.output.localPath}',
    hasManifest: '${project_parse_manifest_ref.output.hasManifest}',
    servicesStored: '${project_store_metadata_ref.output.servicesStored}',
    patternsStored: '${project_store_metadata_ref.output.patternsStored}',
  },
}

// --- Onboarding workflow ---

export const taskDefs: TaskDef[] = [
  {
    name: 'validate_identity',
    description: 'Validates the identity payload for a new user onboarding request',
    retryCount: 2,
    retryLogic: 'FIXED',
    retryDelaySeconds: 10,
    timeoutSeconds: 30,
    responseTimeoutSeconds: 15,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: 'platform@aegir.local',
  },
  {
    name: 'provision_account',
    description: 'Creates the user account and initial resources',
    retryCount: 3,
    retryLogic: 'EXPONENTIAL_BACKOFF',
    retryDelaySeconds: 5,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
    timeoutPolicy: 'TIME_OUT_WF',
    ownerEmail: 'platform@aegir.local',
  },
  {
    name: 'send_welcome_email',
    description: 'Sends a welcome email to the newly onboarded user',
    retryCount: 3,
    retryLogic: 'FIXED',
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
    responseTimeoutSeconds: 60,
    timeoutPolicy: 'RETRY',
    ownerEmail: 'platform@aegir.local',
  },
]

export const onboardingWorkflow: WorkflowDef = {
  name: 'user_onboarding',
  description: 'End-to-end user onboarding: validate identity, provision account, send welcome email',
  version: 1,
  schemaVersion: 2,
  ownerEmail: 'platform@aegir.local',
  tasks: [
    {
      name: 'validate_identity',
      taskReferenceName: 'validate_identity_ref',
      type: 'SIMPLE',
      inputParameters: {
        email: '${workflow.input.email}',
        name: '${workflow.input.name}',
      },
    },
    {
      name: 'provision_account',
      taskReferenceName: 'provision_account_ref',
      type: 'SIMPLE',
      inputParameters: {
        email: '${workflow.input.email}',
        name: '${workflow.input.name}',
        identityId: '${validate_identity_ref.output.identityId}',
      },
    },
    {
      name: 'send_welcome_email',
      taskReferenceName: 'send_welcome_email_ref',
      type: 'SIMPLE',
      inputParameters: {
        email: '${workflow.input.email}',
        name: '${workflow.input.name}',
        accountId: '${provision_account_ref.output.accountId}',
      },
    },
  ],
  outputParameters: {
    identityId: '${validate_identity_ref.output.identityId}',
    accountId: '${provision_account_ref.output.accountId}',
    welcomeEmailSent: '${send_welcome_email_ref.output.sent}',
  },
}
