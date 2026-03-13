import { describe, it, expect } from 'vitest'
import { catalogEntrySchema } from './catalog-schema.js'

describe('Catalog Entry Schema', () => {
  it('validates a minimal catalog entry', () => {
    const entry = {
      id: 'build.pnpm-turbo',
      version: '0.1.0',
      name: 'pnpm + Turborepo Monorepo',
      description: 'Monorepo tooling with pnpm workspaces and Turborepo',
      provides: ['monorepo-tooling'],
      application_instructions: '1. Initialize pnpm workspace\n2. Add turbo.json',
      test_criteria: [
        {
          description: 'pnpm install succeeds',
          command: 'pnpm install',
        },
      ],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
  })

  it('validates an entry with all fields', () => {
    const entry = {
      id: 'api.graphql-subgraph',
      version: '0.1.0',
      name: 'GraphQL Federated Subgraph',
      description: 'A Moribashi-based federated GraphQL service',
      preconditions: ['build.pnpm-turbo', 'db.postgres-isolated'],
      provides: ['graphql-subgraph'],
      parameters: {
        service_name: {
          type: 'string',
          required: true,
          description: 'Name of the service',
          pattern: '^[a-z][a-z0-9-]*$',
        },
        port: {
          type: 'number',
          required: true,
          description: 'Port to listen on',
        },
      },
      application_instructions: '1. Create service directory\n2. Add schema\n3. Add resolvers',
      test_criteria: [
        {
          description: 'Health check responds',
          command: 'curl http://localhost:${port}/health',
        },
        {
          description: 'SDL is served',
          manual: 'POST /graphql with { _service { sdl } }',
        },
      ],
      security_notes: 'Ensure auth middleware is applied before resolvers. Validate all input parameters.',
      touchpoints: ['services/${service_name}/', 'services/gateway/src/app.ts'],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
  })

  it('rejects invalid pattern ID', () => {
    const entry = {
      id: 'noDot',
      version: '0.1.0',
      name: 'Bad',
      description: 'Missing dot separator',
      provides: ['something'],
      application_instructions: 'Do something',
      test_criteria: [{ description: 'Check' }],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects entry with no provides', () => {
    const entry = {
      id: 'build.empty',
      version: '0.1.0',
      name: 'Empty',
      description: 'Provides nothing',
      provides: [],
      application_instructions: 'Do nothing',
      test_criteria: [{ description: 'Check' }],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects entry with no test criteria', () => {
    const entry = {
      id: 'build.untested',
      version: '0.1.0',
      name: 'Untested',
      description: 'No tests',
      provides: ['something'],
      application_instructions: 'Do something',
      test_criteria: [],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects empty application instructions', () => {
    const entry = {
      id: 'build.empty-instructions',
      version: '0.1.0',
      name: 'Empty instructions',
      description: 'No instructions',
      provides: ['something'],
      application_instructions: '',
      test_criteria: [{ description: 'Check' }],
    }

    const result = catalogEntrySchema.safeParse(entry)
    expect(result.success).toBe(false)
  })
})
