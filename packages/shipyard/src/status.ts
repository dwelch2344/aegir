import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { manifestSchema, type ShipManifest } from './manifest-schema.js'
import { loadCatalog } from './catalog-reader.js'
import type { CatalogEntry } from './catalog-schema.js'

export interface StatusResult {
  manifest: ShipManifest
  services: ServiceStatus[]
  patterns: PatternStatus[]
  issues: string[]
}

export interface ServiceStatus {
  name: string
  type: string
  port: number
  exists: boolean
  hasSource: boolean
  hasTests: boolean
  hasPackageJson: boolean
}

export interface PatternStatus {
  id: string
  version: string
  appliedAt?: string
  catalogVersion?: string
  outdated: boolean
  touchpointsMissing: string[]
}

/**
 * Compares a ship's manifest claims against what's actually on disk.
 * This is the M3 drift detection — structural comparison.
 */
export function status(shipDir: string, catalogDir?: string): StatusResult {
  const manifestPath = join(shipDir, 'shipyard.manifest')
  if (!existsSync(manifestPath)) {
    throw new Error(`No shipyard.manifest found in ${shipDir}`)
  }

  const manifestRaw = readFileSync(manifestPath, 'utf-8')
  const manifestData = parse(manifestRaw)
  const result = manifestSchema.safeParse(manifestData)
  if (!result.success) {
    throw new Error(`Invalid manifest: ${result.error.issues.map((i) => i.message).join(', ')}`)
  }
  const manifest = result.data

  // Load catalog if available (for version comparison + touchpoints)
  let catalog: Map<string, CatalogEntry> | undefined
  if (catalogDir && existsSync(catalogDir)) {
    try {
      catalog = loadCatalog(catalogDir)
    } catch {
      // Catalog load failure is non-fatal for status
    }
  }

  const issues: string[] = []

  // ── Check services ──────────────────────────────────────────────────────
  const services: ServiceStatus[] = manifest.services.map((svc) => {
    const svcDir = svc.type === 'graphql-gateway' ? 'services/gateway' : `services/${svc.name}`
    const svcPath = join(shipDir, svcDir)
    const hasDir = existsSync(svcPath)
    const hasSource = existsSync(join(svcPath, 'src/app.ts'))
    const hasTests = existsSync(join(svcPath, 'src/app.test.ts'))
    const hasPackageJson = existsSync(join(svcPath, 'package.json'))

    if (!hasDir) issues.push(`Service "${svc.name}" declared in manifest but directory missing: ${svcDir}/`)
    if (hasDir && !hasSource) issues.push(`Service "${svc.name}" directory exists but src/app.ts missing`)
    if (hasDir && !hasTests) issues.push(`Service "${svc.name}" has no tests (src/app.test.ts missing)`)

    return {
      name: svc.name,
      type: svc.type,
      port: svc.port,
      exists: hasDir,
      hasSource,
      hasTests,
      hasPackageJson,
    }
  })

  // ── Check patterns ──────────────────────────────────────────────────────
  const patterns: PatternStatus[] = manifest.catalog_refs.map((ref) => {
    const catalogEntry = catalog?.get(ref.id)
    const outdated = catalogEntry ? catalogEntry.version !== ref.version : false
    const touchpointsMissing: string[] = []

    if (catalogEntry) {
      for (const tp of catalogEntry.touchpoints) {
        // Resolve template variables in touchpoint paths
        let resolvedPath = tp
        // Skip paths with unresolved template variables
        if (resolvedPath.includes('<') || resolvedPath.includes('${')) continue

        if (!existsSync(join(shipDir, resolvedPath))) {
          touchpointsMissing.push(resolvedPath)
        }
      }
    }

    if (outdated) {
      issues.push(`Pattern "${ref.id}" is v${ref.version} but catalog has v${catalogEntry!.version}`)
    }

    return {
      id: ref.id,
      version: ref.version,
      appliedAt: ref.applied_at,
      catalogVersion: catalogEntry?.version,
      outdated,
      touchpointsMissing,
    }
  })

  // ── Check structural health ─────────────────────────────────────────────
  if (!existsSync(join(shipDir, 'package.json'))) issues.push('Root package.json missing')
  if (!existsSync(join(shipDir, 'tsconfig.base.json'))) issues.push('tsconfig.base.json missing')
  if (!existsSync(join(shipDir, 'turbo.json'))) issues.push('turbo.json missing')
  if (!existsSync(join(shipDir, 'pnpm-workspace.yaml'))) issues.push('pnpm-workspace.yaml missing')

  return { manifest, services, patterns, issues }
}
