import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { profileSchema } from './profile-schema.js'

describe('Profile Schema', () => {
  it('validates a minimal profile', () => {
    const profile = {
      id: 'test',
      name: 'Test Profile',
      ship_type: 'api',
      description: 'A test profile',
      patterns: [{ id: 'build.pnpm-turbo' }],
      stack: {
        languages: ['typescript'],
        runtime: 'node-22',
      },
    }

    const result = profileSchema.safeParse(profile)
    expect(result.success).toBe(true)
  })

  it('validates the saas profile', () => {
    const raw = readFileSync(resolve(import.meta.dirname, '../../../profiles/saas.yaml'), 'utf-8')
    const data = parse(raw)
    const result = profileSchema.safeParse(data)

    if (!result.success) {
      console.error(result.error.issues)
    }

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.id).toBe('saas')
      expect(result.data.ship_type).toBe('web-app')
      expect(result.data.patterns.length).toBeGreaterThanOrEqual(10)
    }
  })

  it('rejects profile with no patterns', () => {
    const profile = {
      id: 'empty',
      name: 'Empty',
      ship_type: 'api',
      description: 'No patterns',
      patterns: [],
      stack: { languages: ['typescript'], runtime: 'node-22' },
    }

    const result = profileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })

  it('rejects invalid ship type', () => {
    const profile = {
      id: 'bad',
      name: 'Bad',
      ship_type: 'microservice',
      description: 'Invalid type',
      patterns: [{ id: 'build.pnpm-turbo' }],
      stack: { languages: ['typescript'], runtime: 'node-22' },
    }

    const result = profileSchema.safeParse(profile)
    expect(result.success).toBe(false)
  })
})
