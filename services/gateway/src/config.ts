import { getEnv } from '@aegir/common'

export const config = {
  port: Number(getEnv('GATEWAY_PORT', '4000')),
  host: getEnv('GATEWAY_HOST', '0.0.0.0')!,
  services: {
    iam: getEnv('IAM_URL', 'http://localhost:4001/graphql')!,
    system: getEnv('SYSTEM_URL', 'http://localhost:4002/graphql')!,
    agents: getEnv('AGENTS_URL', 'http://localhost:4003/graphql')!,
    projects: getEnv('PROJECTS_URL', 'http://localhost:4004/graphql')!,
    practices: getEnv('PRACTICES_URL', 'http://localhost:4005/graphql')!,
  },
}
