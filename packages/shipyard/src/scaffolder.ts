import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stringify } from 'yaml'
import { parse } from 'yaml'
import { profileSchema, type Profile } from './profile-schema.js'
import { loadCatalog, resolvePatternOrder, collectCapabilities } from './catalog-reader.js'
import type { CatalogEntry } from './catalog-schema.js'
import type { ShipManifest, ShipService } from './manifest-schema.js'
import * as tpl from './templates.js'

export interface ScaffoldOptions {
  /** Ship name (lowercase alphanumeric with hyphens) */
  name: string
  /** Path to the profile YAML file */
  profilePath: string
  /** Path to the catalog directory */
  catalogDir: string
  /** Output directory (defaults to ./<name>) */
  outputDir?: string
  /** npm org scope (e.g., "@myorg") */
  orgScope?: string
}

export interface ScaffoldResult {
  /** Absolute path to the generated ship */
  outputDir: string
  /** The generated manifest */
  manifest: ShipManifest
  /** Patterns applied in order */
  appliedPatterns: CatalogEntry[]
  /** Files created */
  files: string[]
}

/**
 * Default services generated for the saas profile.
 * Gateway + IAM subgraph as the baseline.
 */
const DEFAULT_SERVICES: { name: string; type: ShipService['type']; port: number; schema?: string }[] = [
  { name: 'gateway', type: 'graphql-gateway', port: 4000 },
  { name: 'iam', type: 'graphql-subgraph', port: 4001, schema: 'iam' },
]

/**
 * Scaffolds a new ship from a profile.
 */
export function scaffold(options: ScaffoldOptions): ScaffoldResult {
  const { name, profilePath, catalogDir, orgScope } = options
  const outputDir = resolve(options.outputDir ?? `./${name}`)

  // Validate name
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error('Ship name must be lowercase alphanumeric with hyphens')
  }

  if (existsSync(outputDir)) {
    throw new Error(`Output directory already exists: ${outputDir}`)
  }

  // Load profile
  const profileRaw = readFileSync(profilePath, 'utf-8')
  const profileData = parse(profileRaw)
  const profileResult = profileSchema.safeParse(profileData)
  if (!profileResult.success) {
    throw new Error(`Invalid profile: ${profileResult.error.issues.map((i) => i.message).join(', ')}`)
  }
  const profile = profileResult.data

  // Load catalog and resolve pattern order
  const catalog = loadCatalog(catalogDir)
  const patternIds = profile.patterns.map((p) => p.id)
  const sortedPatterns = resolvePatternOrder(patternIds, catalog)

  // Collect capabilities from all patterns
  const capabilities = collectCapabilities(sortedPatterns)

  // Determine services based on profile capabilities
  const hasGraphql = patternIds.includes('api.graphql-federation')
  const services = hasGraphql ? DEFAULT_SERVICES : []

  // Build the manifest
  const manifest: ShipManifest = {
    shipyard_version: '0.1',
    name,
    type: profile.ship_type,
    stack: {
      languages: profile.stack.languages,
      frameworks: profile.stack.frameworks,
      runtime: profile.stack.runtime,
    },
    services: services.map((s) => ({
      name: s.name,
      type: s.type,
      port: s.port,
      ...(s.schema ? { schema: s.schema } : {}),
    })),
    catalog_refs: sortedPatterns.map((p) => ({
      id: p.id,
      version: p.version,
      applied_at: new Date().toISOString(),
    })),
    capabilities,
    constraints: {
      protected_paths: ['shipyard.manifest'],
    },
    conventions: {
      graphql_naming: 'moribashi' as const,
      migration_format: 'flyway' as const,
      service_scan_pattern: '**/*.svc.ts',
    },
  }

  // Generate the project
  const files: string[] = []
  const scope = orgScope ?? `@${name}`

  const write = (relativePath: string, content: string) => {
    const fullPath = join(outputDir, relativePath)
    const dir = join(fullPath, '..')
    mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, content)
    files.push(relativePath)
  }

  // ── Root files ──────────────────────────────────────────────────────────
  write('shipyard.manifest', generateManifestYaml(manifest))
  write('package.json', generateRootPackageJson(name))
  write('pnpm-workspace.yaml', generatePnpmWorkspace())
  write('tsconfig.base.json', generateTsConfigBase())
  write('turbo.json', generateTurboJson())
  write('biome.json', generateBiomeJson())
  write('.gitignore', generateGitignore())
  write('.npmrc', 'shamefully-hoist=false\nstrict-peer-dependencies=false\n')

  // ── Common package ────────────────────────────────────────────────────
  write(
    'packages/common/package.json',
    generateLibPackageJson(`${scope}/common`, {
      devDependencies: {
        '@types/node': '^22.0.0',
        tsup: '^8.0.0',
        typescript: '^5.7.0',
      },
    }),
  )
  write('packages/common/tsconfig.json', tpl.serviceTsConfig())
  write('packages/common/tsup.config.ts', tpl.packageTsupConfig())
  write('packages/common/src/index.ts', tpl.commonIndexTs())
  write('packages/common/src/env.ts', tpl.commonEnvTs())

  // ── Domain package ────────────────────────────────────────────────────
  write(
    'packages/domain/package.json',
    generateLibPackageJson(`${scope}/domain`, {
      devDependencies: {
        '@types/node': '^22.0.0',
        tsup: '^8.0.0',
        typescript: '^5.7.0',
      },
    }),
  )
  write('packages/domain/tsconfig.json', tpl.serviceTsConfig())
  write('packages/domain/tsup.config.ts', tpl.packageTsupConfig())
  write('packages/domain/src/index.ts', '// Domain model entities — add your types here\nexport {}\n')

  // ── Services ──────────────────────────────────────────────────────────
  if (hasGraphql) {
    const subgraphs = services.filter((s) => s.type === 'graphql-subgraph')

    // Gateway
    write('services/gateway/package.json', tpl.gatewayPackageJson(scope))
    write('services/gateway/tsconfig.json', tpl.serviceTsConfig())
    write('services/gateway/tsup.config.ts', tpl.serviceTsupConfig())
    write('services/gateway/vitest.config.ts', tpl.serviceVitestConfig())
    write('services/gateway/src/app.ts', tpl.gatewayAppTs(name, subgraphs))
    write('services/gateway/src/index.ts', tpl.gatewayIndexTs(4000))
    write('services/gateway/src/app.test.ts', tpl.gatewayTestTs(name))

    // Subgraphs
    for (const svc of subgraphs) {
      const dir = `services/${svc.name}`
      write(`${dir}/package.json`, tpl.subgraphPackageJson(scope, svc.name))
      write(`${dir}/tsconfig.json`, tpl.serviceTsConfig())
      write(`${dir}/tsup.config.ts`, tpl.serviceTsupConfig())
      write(`${dir}/vitest.config.ts`, tpl.serviceVitestConfig())
      write(`${dir}/src/app.ts`, tpl.subgraphAppTs(name, svc.name))
      write(`${dir}/src/index.ts`, tpl.subgraphIndexTs(svc.name, svc.port))
      write(`${dir}/src/schema.ts`, tpl.subgraphSchemaTs(svc.name))
      write(`${dir}/src/resolvers.ts`, tpl.subgraphResolversTs(svc.name))
      write(`${dir}/src/app.test.ts`, tpl.subgraphTestTs(name, svc.name))
    }
  }

  // ── README ────────────────────────────────────────────────────────────
  write('README.md', generateReadme(name, profile, services))

  return {
    outputDir,
    manifest,
    appliedPatterns: sortedPatterns,
    files,
  }
}

// ── File generators ───────────────────────────────────────────────────────────

function generateManifestYaml(manifest: ShipManifest): string {
  const header = `# Ship Manifest — generated by Shipyard\n# This is the agent's primary source of truth about this ship.\n\n`
  return header + stringify(manifest, { lineWidth: 100 })
}

function generateRootPackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      packageManager: 'pnpm@10.16.1',
      scripts: {
        dev: 'turbo dev --ui=stream --log-order=stream',
        build: 'turbo build',
        test: 'turbo test',
        lint: 'biome check .',
        format: 'biome check --write .',
      },
      devDependencies: {
        '@biomejs/biome': '^2.0.0',
        turbo: '^2.0.0',
        typescript: '^5.7.0',
      },
    },
    null,
    2,
  )
}

function generateLibPackageJson(name: string, extra: Record<string, unknown>): string {
  return JSON.stringify(
    {
      name,
      version: '0.0.1',
      private: true,
      type: 'module',
      exports: {
        '.': {
          import: './dist/index.js',
          types: './dist/index.d.ts',
        },
      },
      scripts: {
        build: 'tsup',
        dev: 'tsup --watch',
      },
      ...extra,
    },
    null,
    2,
  )
}

function generatePnpmWorkspace(): string {
  return `packages:\n  - "packages/*"\n  - "services/*"\n  - "apps/*"\n`
}

function generateTsConfigBase(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        isolatedModules: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
    },
    null,
    2,
  )
}

function generateTurboJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://turbo.build/schema.json',
      tasks: {
        build: {
          dependsOn: ['^build'],
          outputs: ['dist/**'],
        },
        dev: {
          dependsOn: ['^build'],
          cache: false,
          persistent: true,
        },
        test: {
          dependsOn: ['build'],
        },
        lint: {},
      },
    },
    null,
    2,
  )
}

function generateBiomeJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://biomejs.dev/schemas/2.0.0/schema.json',
      formatter: {
        indentStyle: 'space',
        indentWidth: 2,
        lineWidth: 100,
      },
      linter: {
        enabled: true,
      },
      javascript: {
        formatter: {
          quoteStyle: 'single',
          semicolons: 'asNeeded',
          trailingCommas: 'all',
        },
      },
    },
    null,
    2,
  )
}

function generateGitignore(): string {
  return `node_modules/\ndist/\n.turbo/\n*.log\n.env\n.env.*\n!.env.example\n.DS_Store\ncoverage/\n`
}

function generateReadme(name: string, profile: Profile, services: { name: string; port: number }[]): string {
  const serviceList = services.map((s) => `- **${s.name}** — port ${s.port}`).join('\n')
  return `# ${name}

Scaffolded by Shipyard with profile \`${profile.id}\`.

## Getting Started

\`\`\`bash
pnpm install
pnpm build
pnpm test
pnpm dev
\`\`\`

## Services

${serviceList || '_No services generated._'}

## Architecture

This project uses a federated GraphQL architecture with:
- **Gateway** — Mercurius federation gateway composing all subgraph schemas
- **Subgraphs** — Independent services exposing federated GraphQL endpoints
- **Shared packages** — \`common\` (utilities) and \`domain\` (type definitions)

## Manifest

See \`shipyard.manifest\` for the full list of applied catalog patterns and capabilities.
`
}
