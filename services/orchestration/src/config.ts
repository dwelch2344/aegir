import { getEnv } from '@aegir/common'

export const config = {
  conductor: {
    url: getEnv('CONDUCTOR_URL', 'http://conductor:8080/api')!,
  },

  smtp: {
    host: getEnv('SMTP_HOST', 'mailhog')!,
    port: Number(getEnv('SMTP_PORT', '1025')),
    secure: getEnv('SMTP_SECURE', 'false') === 'true',
    user: getEnv('SMTP_USER', ''),
    pass: getEnv('SMTP_PASS', ''),
    from: getEnv('SMTP_FROM', 'contracting@healthfirst.local')!,
    fromName: getEnv('SMTP_FROM_NAME', 'Health First Contracting')!,
  },

  agentIntel: {
    baseUrl: getEnv('AGENT_INTEL_URL', 'http://localhost:9090')!,
    apiKey: getEnv('AGENT_INTEL_API_KEY', '')!,
  },

  docusign: {
    baseUrl: getEnv('DOCUSIGN_BASE_URL', 'https://demo.docusign.net/restapi')!,
    accountId: getEnv('DOCUSIGN_ACCOUNT_ID', '')!,
    integrationKey: getEnv('DOCUSIGN_INTEGRATION_KEY', '')!,
    secretKey: getEnv('DOCUSIGN_SECRET_KEY', '')!,
  },

  googleDrive: {
    credentialsPath: getEnv('GOOGLE_DRIVE_CREDENTIALS_PATH', '')!,
    contractingFolderId: getEnv('GOOGLE_DRIVE_CONTRACTING_FOLDER_ID', '')!,
    templateFolderId: getEnv('GOOGLE_DRIVE_TEMPLATE_FOLDER_ID', '')!,
  },

  sircon: {
    baseUrl: getEnv('SIRCON_URL', 'https://www.sircon.com')!,
    healthFirstEin: getEnv('SIRCON_HF_EIN', '464344936')!,
  },

  agents: {
    graphqlUrl: getEnv('AGENTS_GRAPHQL_URL', 'http://localhost:4003/graphql')!,
  },

  projects: {
    graphqlUrl: getEnv('PROJECTS_GRAPHQL_URL', 'http://localhost:4004/graphql')!,
    workspaceDir: getEnv('PROJECTS_WORKSPACE_DIR', '/tmp/shipyard-projects')!,
    catalogDir: getEnv('SHIPYARD_CATALOG_DIR', '/workspace/catalog')!,
  },

  selectHealth: {
    carrierContact: getEnv('SH_CARRIER_CONTACT_EMAIL', 'amy.koncar@selecthealth.org')!,
    trainingContact: getEnv('SH_TRAINING_CONTACT_EMAIL', 'andrew.freeze@selecthealth.org')!,
    writingNumber: getEnv('SH_WRITING_NUMBER', '16672C01')!,
  },
}
