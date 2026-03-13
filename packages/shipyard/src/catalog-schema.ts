import { z } from 'zod'

/**
 * Catalog Entry Schema
 *
 * Each catalog entry is a versioned, self-describing pattern that can be
 * applied to a ship. Entries encode architectural decisions and their
 * implementation as machine-readable, agent-executable instructions.
 *
 * Security: Catalog entries must never contain secrets, credentials, or
 * API keys. The `security_notes` field documents security considerations
 * that agents and developers must be aware of when applying the pattern.
 */

const parameterSchema = z.object({
  /** Parameter type */
  type: z.enum(['string', 'number', 'boolean']),
  /** Whether this parameter must be provided */
  required: z.boolean().default(false),
  /** Default value (must match type) */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Validation pattern (for string params) */
  pattern: z.string().optional(),
})

const testCriterionSchema = z.object({
  /** What this test verifies */
  description: z.string().min(1),
  /** Shell command to run (exit 0 = pass) */
  command: z.string().optional(),
  /** Manual verification step (when automation isn't possible) */
  manual: z.string().optional(),
})

export const catalogEntrySchema = z.object({
  /** Stable identifier (e.g., "auth.oidc-keycloak") */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/, 'Pattern ID must be category.name format'),

  /** Semver version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 0.1.0)'),

  /** Human-readable name */
  name: z.string().min(1),

  /** What this pattern does */
  description: z.string().min(1),

  /** Catalog pattern IDs that must be applied before this one */
  preconditions: z.array(z.string().min(1)).default([]),

  /** Capabilities this pattern adds to the ship */
  provides: z.array(z.string().min(1)).min(1),

  /** Parameterizable values for this pattern */
  parameters: z.record(z.string(), parameterSchema).default({}),

  /** Agent-readable steps to apply this pattern to a ship */
  application_instructions: z.string().min(1),

  /** How to verify the pattern was applied correctly */
  test_criteria: z.array(testCriterionSchema).min(1),

  /**
   * Security considerations for this pattern.
   * Agents must read and respect these when applying.
   */
  security_notes: z.string().optional(),

  /** Files this pattern creates or modifies (for drift detection) */
  touchpoints: z.array(z.string()).default([]),
})

export type CatalogEntry = z.infer<typeof catalogEntrySchema>
export type CatalogParameter = z.infer<typeof parameterSchema>
export type TestCriterion = z.infer<typeof testCriterionSchema>
