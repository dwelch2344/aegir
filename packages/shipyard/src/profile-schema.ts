import { z } from 'zod'

/**
 * Profile Schema
 *
 * A profile is a curated bundle of catalog patterns that compose a coherent
 * starting point for a new ship. Profiles are opinionated — they prescribe
 * which patterns to apply and in what order.
 *
 * M1: All-or-nothing profiles (no skip-lists). Skip-lists planned for M2.
 */

const profilePatternSchema = z.object({
  /** Catalog pattern ID */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/, 'Pattern ID must be category.name format'),
  /** Override default parameter values for this pattern in this profile */
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
})

export const profileSchema = z.object({
  /** Profile identifier (e.g., "saas", "api-only", "cli") */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'Profile ID must be lowercase alphanumeric with hyphens'),

  /** Human-readable name */
  name: z.string().min(1),

  /** What kind of ship this profile produces */
  ship_type: z.enum(['web-app', 'api', 'cli', 'library']),

  /** What this profile sets up */
  description: z.string().min(1),

  /** Ordered list of patterns to apply (order matters for preconditions) */
  patterns: z.array(profilePatternSchema).min(1),

  /** Default stack for ships created with this profile */
  stack: z.object({
    languages: z.array(z.string().min(1)).min(1),
    frameworks: z.array(z.string().min(1)).default([]),
    runtime: z.string().min(1),
  }),
})

export type Profile = z.infer<typeof profileSchema>
export type ProfilePattern = z.infer<typeof profilePatternSchema>
