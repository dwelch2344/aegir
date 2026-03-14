#!/usr/bin/env node

import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { parse } from 'yaml'
import { scaffold } from './scaffolder.js'
import { apply } from './applicator.js'
import { loadCatalog } from './catalog-reader.js'
import { manifestSchema } from './manifest-schema.js'
import { status } from './status.js'

const HELP = `
shipyard - The software factory CLI

Usage:
  shipyard init <name> [options]       Scaffold a new ship from a profile
  shipyard apply <pattern> [options]   Apply a catalog pattern to the current ship
  shipyard info <pattern-id>           Show details for a catalog pattern
  shipyard list                        List all available catalog patterns
  shipyard status                       Show ship health and drift report
  shipyard validate                    Validate the catalog and current ship's manifest
  shipyard --help                      Show this help

Options for init:
  --profile <id>      Profile to use (default: "saas")
  --catalog <path>    Path to catalog directory (default: auto-detect)
  --profiles <path>   Path to profiles directory (default: auto-detect)
  --output <path>     Output directory (default: ./<name>)
  --org-scope <scope> npm org scope (default: @<name>)

Options for apply:
  --catalog <path>    Path to catalog directory (default: auto-detect)
  --ship <path>       Path to the ship root (default: auto-detect)
  --name <value>      service_name parameter
  --port <value>      port parameter
  --entity <value>    entity_name parameter
  --fields <value>    entity_fields parameter (e.g., "key:string,name:string")
`

function findProjectRoot(): string {
  let dir = process.cwd()
  while (dir !== '/') {
    if (existsSync(resolve(dir, 'catalog')) && existsSync(resolve(dir, 'profiles'))) {
      return dir
    }
    if (existsSync(resolve(dir, 'shipyard.manifest'))) {
      return dir
    }
    dir = resolve(dir, '..')
  }
  return process.cwd()
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      profile: { type: 'string', default: 'saas' },
      catalog: { type: 'string' },
      profiles: { type: 'string' },
      output: { type: 'string' },
      'org-scope': { type: 'string' },
      ship: { type: 'string' },
      json: { type: 'boolean', default: false },
      name: { type: 'string' },
      port: { type: 'string' },
      entity: { type: 'string' },
      fields: { type: 'string' },
    },
  })

  if (values.help || positionals.length === 0) {
    console.log(HELP)
    process.exit(0)
  }

  const command = positionals[0]
  const root = findProjectRoot()
  const catalogDir = values.catalog ?? resolve(root, 'catalog')

  if (command === 'init') {
    handleInit(values, positionals, root, catalogDir)
  } else if (command === 'apply') {
    handleApply(values, positionals, root, catalogDir)
  } else if (command === 'list') {
    handleList(catalogDir)
  } else if (command === 'info') {
    handleInfo(catalogDir, positionals[1])
  } else if (command === 'status') {
    handleStatus(values, root, catalogDir)
  } else if (command === 'validate') {
    handleValidate(root, catalogDir)
  } else {
    console.error(`Unknown command: ${command}`)
    console.log(HELP)
    process.exit(1)
  }
}

function handleInit(
  values: Record<string, string | boolean | undefined>,
  positionals: string[],
  root: string,
  catalogDir: string,
) {
  const name = positionals[1]
  if (!name) {
    console.error('Error: ship name is required\n  Usage: shipyard init <name>')
    process.exit(1)
  }

  const profilesDir = (values.profiles as string) ?? resolve(root, 'profiles')
  const profileId = (values.profile as string) ?? 'saas'
  const profilePath = resolve(profilesDir, `${profileId}.yaml`)

  if (!existsSync(catalogDir)) {
    console.error(`Error: catalog directory not found at ${catalogDir}`)
    process.exit(1)
  }

  if (!existsSync(profilePath)) {
    console.error(`Error: profile "${profileId}" not found at ${profilePath}`)
    process.exit(1)
  }

  console.log(`\nShipyard: Scaffolding "${name}" with profile "${profileId}"...\n`)

  try {
    const result = scaffold({
      name,
      profilePath,
      catalogDir,
      outputDir: values.output as string | undefined,
      orgScope: values['org-scope'] as string | undefined,
    })

    console.log(`Ship scaffolded at: ${result.outputDir}\n`)
    console.log(`Patterns applied (${result.appliedPatterns.length}):`)
    for (const p of result.appliedPatterns) {
      console.log(`  + ${p.id} v${p.version} — ${p.name}`)
    }
    console.log(`\nFiles created: ${result.files.length}`)
    console.log(`Capabilities: ${result.manifest.capabilities.join(', ')}`)
    console.log(`\nNext steps:`)
    console.log(`  cd ${name}`)
    console.log(`  pnpm install`)
    console.log(`  pnpm build`)
    console.log(`  pnpm dev`)
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`)
    process.exit(1)
  }
}

function handleApply(
  values: Record<string, string | boolean | undefined>,
  positionals: string[],
  _root: string,
  catalogDir: string,
) {
  const patternId = positionals[1]
  if (!patternId) {
    console.error('Error: pattern ID is required\n  Usage: shipyard apply <pattern> [options]')
    process.exit(1)
  }

  // Determine ship root — either explicit --ship, or walk up looking for shipyard.manifest
  let shipDir = values.ship as string | undefined
  if (!shipDir) {
    let dir = process.cwd()
    while (dir !== '/') {
      if (existsSync(resolve(dir, 'shipyard.manifest'))) {
        shipDir = dir
        break
      }
      dir = resolve(dir, '..')
    }
  }
  if (!shipDir) {
    console.error(
      'Error: could not find a ship (no shipyard.manifest found).\n  Use --ship <path> or run from inside a ship directory.',
    )
    process.exit(1)
  }

  if (!existsSync(catalogDir)) {
    console.error(`Error: catalog directory not found at ${catalogDir}`)
    process.exit(1)
  }

  // Build params from CLI flags
  const params: Record<string, string | number | boolean> = {}
  if (values.name) params.service_name = values.name as string
  if (values.port) params.port = Number(values.port)
  if (values.entity) params.entity_name = values.entity as string
  if (values.fields) params.entity_fields = values.fields as string

  console.log(`\nShipyard: Applying "${patternId}" to ${shipDir}...\n`)

  try {
    const result = apply({
      shipDir: resolve(shipDir),
      catalogDir,
      patternId,
      params,
    })

    console.log(`Pattern applied: ${result.pattern.id} v${result.pattern.version}`)
    console.log(`  ${result.pattern.name}\n`)
    console.log(`Files created/modified (${result.files.length}):`)
    for (const f of result.files) {
      console.log(`  + ${f}`)
    }
    if (result.newCapabilities.length > 0) {
      console.log(`\nNew capabilities: ${result.newCapabilities.join(', ')}`)
    }
    console.log(`\nNext steps:`)
    console.log(`  pnpm install`)
    console.log(`  pnpm build`)
    console.log(`  pnpm test`)
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`)
    process.exit(1)
  }
}

function handleStatus(values: Record<string, string | boolean | undefined>, _root: string, catalogDir: string) {
  // Find ship root
  let shipDir = values.ship as string | undefined
  if (!shipDir) {
    let dir = process.cwd()
    while (dir !== '/') {
      if (existsSync(resolve(dir, 'shipyard.manifest'))) {
        shipDir = dir
        break
      }
      dir = resolve(dir, '..')
    }
  }
  if (!shipDir) {
    console.error('Error: could not find a ship (no shipyard.manifest found).')
    process.exit(1)
  }

  try {
    const result = status(resolve(shipDir), existsSync(catalogDir) ? catalogDir : undefined)

    // JSON output for programmatic use
    if (values.json) {
      const output = {
        name: result.manifest.name,
        type: result.manifest.type,
        services: result.services.map((s) => ({
          name: s.name,
          port: s.port,
          type: s.type,
          status: s.exists && s.hasSource ? 'ok' : 'MISSING',
          hasTests: s.hasTests,
        })),
        patterns: result.patterns.map((p) => ({
          id: p.id,
          version: p.version,
          catalogVersion: p.catalogVersion,
          status: p.outdated ? 'outdated' : 'current',
        })),
        issues: result.issues,
      }
      console.log(JSON.stringify(output))
      return
    }

    const m = result.manifest

    console.log(`\n${m.name} (${m.type})`)
    console.log(`${'─'.repeat(60)}`)
    console.log(`Stack: ${m.stack.languages.join(', ')} / ${m.stack.runtime}`)
    console.log(`Patterns: ${m.catalog_refs.length} applied`)
    console.log(`Capabilities: ${m.capabilities.length} total`)

    // Services
    console.log(`\nServices (${result.services.length}):`)
    for (const svc of result.services) {
      const icon = svc.exists && svc.hasSource ? 'ok' : 'MISSING'
      const tests = svc.hasTests ? 'tests' : 'no tests'
      console.log(`  [${icon}] ${svc.name} :${svc.port} (${svc.type}) — ${tests}`)
    }

    // Patterns
    const outdated = result.patterns.filter((p) => p.outdated)
    if (outdated.length > 0) {
      console.log(`\nOutdated patterns:`)
      for (const p of outdated) {
        console.log(`  ${p.id}: v${p.version} → v${p.catalogVersion}`)
      }
    }

    // Issues
    if (result.issues.length > 0) {
      console.log(`\nIssues (${result.issues.length}):`)
      for (const issue of result.issues) {
        console.log(`  ! ${issue}`)
      }
    } else {
      console.log(`\nNo issues found.`)
    }
    console.log()
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`)
    process.exit(1)
  }
}

function handleList(catalogDir: string) {
  if (!existsSync(catalogDir)) {
    console.error(`Error: catalog directory not found at ${catalogDir}`)
    process.exit(1)
  }

  const catalog = loadCatalog(catalogDir)
  console.log(`\nCatalog (${catalog.size} patterns):\n`)

  const sorted = [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id))
  for (const entry of sorted) {
    const caps = entry.provides.slice(0, 3).join(', ')
    const more = entry.provides.length > 3 ? ` +${entry.provides.length - 3} more` : ''
    console.log(`  ${entry.id} v${entry.version}`)
    console.log(`    ${entry.name}`)
    console.log(`    provides: ${caps}${more}`)
    if (entry.preconditions.length > 0) {
      console.log(`    requires: ${entry.preconditions.join(', ')}`)
    }
    console.log()
  }
}

function handleInfo(catalogDir: string, patternId: string | undefined) {
  if (!patternId) {
    console.error('Error: pattern ID is required\n  Usage: shipyard info <pattern-id>')
    process.exit(1)
  }

  if (!existsSync(catalogDir)) {
    console.error(`Error: catalog directory not found at ${catalogDir}`)
    process.exit(1)
  }

  const catalog = loadCatalog(catalogDir)
  const entry = catalog.get(patternId)

  if (!entry) {
    console.error(`Error: pattern "${patternId}" not found in catalog`)
    const similar = [...catalog.keys()].filter((k) => k.includes(patternId.split('.').pop() ?? ''))
    if (similar.length > 0) {
      console.error(`Did you mean: ${similar.join(', ')}?`)
    }
    process.exit(1)
  }

  console.log(`\n${entry.id} v${entry.version}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`${entry.name}\n`)
  console.log(entry.description)
  console.log(`\nProvides: ${entry.provides.join(', ')}`)
  if (entry.preconditions.length > 0) {
    console.log(`Requires: ${entry.preconditions.join(', ')}`)
  }
  if (Object.keys(entry.parameters).length > 0) {
    console.log(`\nParameters:`)
    for (const [name, param] of Object.entries(entry.parameters)) {
      const req = param.required ? ' (required)' : ''
      const def = param.default !== undefined ? ` [default: ${param.default}]` : ''
      console.log(`  ${name}: ${param.type}${req}${def}`)
      if (param.description) {
        console.log(`    ${param.description.trim().split('\n')[0]}`)
      }
    }
  }
  console.log(`\nTest criteria: ${entry.test_criteria.length} checks`)
  console.log(`Touchpoints: ${entry.touchpoints.length} files`)
  if (entry.security_notes) {
    console.log(`Security notes: yes`)
  }
  console.log()
}

function handleValidate(root: string, catalogDir: string) {
  let errors = 0

  // Validate catalog
  if (existsSync(catalogDir)) {
    try {
      const catalog = loadCatalog(catalogDir)
      console.log(`Catalog: ${catalog.size} patterns loaded OK`)
    } catch (err) {
      console.error(`Catalog: FAIL — ${(err as Error).message}`)
      errors++
    }
  } else {
    console.log('Catalog: not found (skipping)')
  }

  // Validate manifest
  const manifestPath = resolve(root, 'shipyard.manifest')
  if (existsSync(manifestPath)) {
    try {
      const raw = readFileSync(manifestPath, 'utf-8')
      const data = parse(raw)
      const result = manifestSchema.safeParse(data)
      if (result.success) {
        console.log(
          `Manifest: "${result.data.name}" (${result.data.type}) — ${result.data.catalog_refs.length} patterns, ${result.data.services.length} services`,
        )
      } else {
        console.error(`Manifest: FAIL — ${result.error.issues.map((i) => i.message).join(', ')}`)
        errors++
      }
    } catch (err) {
      console.error(`Manifest: FAIL — ${(err as Error).message}`)
      errors++
    }
  } else {
    console.log('Manifest: not found (skipping)')
  }

  if (errors > 0) {
    process.exit(1)
  }
  console.log('\nAll validations passed.')
}

main()
