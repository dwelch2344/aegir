import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parse } from 'yaml'
import { catalogEntrySchema } from './catalog-schema.js'

const catalogDir = resolve(import.meta.dirname, '../../../catalog')

describe('Catalog validation', () => {
  const entries = readdirSync(catalogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  it('has at least 3 catalog entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(3)
  })

  for (const entry of entries) {
    describe(`catalog/${entry}`, () => {
      const patternPath = join(catalogDir, entry, 'pattern.yaml')

      it('has a pattern.yaml file', () => {
        expect(existsSync(patternPath)).toBe(true)
      })

      it('validates against the catalog entry schema', () => {
        const raw = readFileSync(patternPath, 'utf-8')
        const data = parse(raw)
        const result = catalogEntrySchema.safeParse(data)

        if (!result.success) {
          console.error(`Validation errors for ${entry}:`, result.error.issues)
        }

        expect(result.success).toBe(true)
      })

      it('has an id matching the directory name', () => {
        const raw = readFileSync(patternPath, 'utf-8')
        const data = parse(raw)
        expect(data.id).toBe(entry)
      })

      it('has security_notes (Secure by Design)', () => {
        const raw = readFileSync(patternPath, 'utf-8')
        const data = parse(raw)
        expect(data.security_notes).toBeDefined()
        expect(data.security_notes.length).toBeGreaterThan(0)
      })
    })
  }
})
