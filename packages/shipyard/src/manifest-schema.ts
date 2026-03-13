import { z } from 'zod'

/**
 * Ship Manifest Schema
 *
 * The manifest is the agent's primary source of truth about a ship.
 * It describes what the ship is, what patterns have been applied,
 * what capabilities it has, and what constraints must be respected.
 *
 * Security: The manifest itself is not sensitive, but `constraints.protected_paths`
 * must be enforced by all tooling — agents must never modify protected paths
 * without explicit approval.
 */

const serviceSchema = z.object({
  /** Service name (must be a valid identifier: lowercase, alphanumeric, hyphens) */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'Service name must be lowercase alphanumeric with hyphens'),
  /** Service type */
  type: z.enum(['graphql-subgraph', 'graphql-gateway', 'worker', 'frontend']),
  /** Port the service listens on */
  port: z.number().int().min(1024).max(65535),
  /** Database schema name (if applicable) */
  schema: z.string().optional(),
})

const catalogRefSchema = z.object({
  /** Catalog pattern ID (e.g., "auth.oidc-keycloak") */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/, 'Pattern ID must be category.name format (e.g., auth.oidc-keycloak)'),
  /** Semver version of the pattern that was applied */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 0.1.0)'),
  /** ISO date when the pattern was applied */
  applied_at: z.string().datetime().optional(),
})

const conventionsSchema = z.object({
  /** GraphQL naming convention used */
  graphql_naming: z.enum(['moribashi']).optional(),
  /** Migration file naming format */
  migration_format: z.enum(['flyway']).optional(),
  /** Glob pattern for DI-scanned service classes */
  service_scan_pattern: z.string().optional(),
})

const constraintsSchema = z.object({
  /** Paths that agents must never modify without explicit approval */
  protected_paths: z.array(z.string()).default([]),
})

export const manifestSchema = z.object({
  /** Manifest schema version (for forward compatibility) */
  shipyard_version: z.string().regex(/^\d+\.\d+$/),

  /** Project identifier (used in package names, DB schemas, etc.) */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'Name must be lowercase alphanumeric with hyphens'),

  /** Project type */
  type: z.enum(['web-app', 'api', 'cli', 'library']),

  /** Technology stack */
  stack: z.object({
    languages: z.array(z.string().min(1)).min(1),
    frameworks: z.array(z.string().min(1)).default([]),
    runtime: z.string().min(1),
  }),

  /** Services in this ship */
  services: z.array(serviceSchema).default([]),

  /** Catalog patterns that have been applied */
  catalog_refs: z.array(catalogRefSchema).default([]),

  /** Capabilities this ship has (derived from applied patterns) */
  capabilities: z.array(z.string().min(1)).default([]),

  /** Constraints that agents must respect */
  constraints: constraintsSchema.default({}),

  /** Naming and structure conventions */
  conventions: conventionsSchema.default({}),
})

export type ShipManifest = z.infer<typeof manifestSchema>
export type ShipService = z.infer<typeof serviceSchema>
export type CatalogRef = z.infer<typeof catalogRefSchema>
