import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from 'node:path'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { parse } from 'yaml'
import { scaffold } from './scaffolder.js'
import { manifestSchema } from './manifest-schema.js'

const catalogDir = resolve(import.meta.dirname, '../../../catalog')
const profilePath = resolve(import.meta.dirname, '../../../profiles/saas.yaml')
const testOutputDir = resolve(import.meta.dirname, '../../../.test-ship')

describe('Scaffolder', () => {
  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
  })

  it('scaffolds a ship from the saas profile', () => {
    const result = scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(result.outputDir).toBe(testOutputDir)
    expect(result.appliedPatterns.length).toBeGreaterThanOrEqual(13)
    expect(result.files.length).toBeGreaterThan(20)
  })

  it('generates a valid shipyard.manifest with services', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    const manifestPath = resolve(testOutputDir, 'shipyard.manifest')
    expect(existsSync(manifestPath)).toBe(true)

    const raw = readFileSync(manifestPath, 'utf-8')
    const data = parse(raw)
    const result = manifestSchema.safeParse(data)

    if (!result.success) {
      console.error(result.error.issues)
    }

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test-ship')
      expect(result.data.type).toBe('web-app')
      expect(result.data.catalog_refs.length).toBeGreaterThanOrEqual(13)
      expect(result.data.services).toHaveLength(2)
      expect(result.data.services[0].name).toBe('gateway')
      expect(result.data.services[1].name).toBe('iam')
    }
  })

  it('generates root project files', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(existsSync(resolve(testOutputDir, 'package.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'pnpm-workspace.yaml'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'tsconfig.base.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'turbo.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'biome.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, '.gitignore'))).toBe(true)

    const pkg = JSON.parse(readFileSync(resolve(testOutputDir, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('test-ship')
    expect(pkg.scripts.build).toBe('turbo build')
    expect(pkg.devDependencies['@biomejs/biome']).toBeDefined()
    expect(pkg.devDependencies.turbo).toBeDefined()
  })

  it('generates common package with env utilities', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(existsSync(resolve(testOutputDir, 'packages/common/package.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'packages/common/src/index.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'packages/common/src/env.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'packages/common/tsup.config.ts'))).toBe(true)

    const envTs = readFileSync(resolve(testOutputDir, 'packages/common/src/env.ts'), 'utf-8')
    expect(envTs).toContain('getEnv')
    expect(envTs).toContain('requireEnv')
  })

  it('generates gateway service with full source', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(existsSync(resolve(testOutputDir, 'services/gateway/package.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/gateway/src/app.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/gateway/src/index.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/gateway/src/app.test.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/gateway/tsup.config.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/gateway/vitest.config.ts'))).toBe(true)

    const appTs = readFileSync(resolve(testOutputDir, 'services/gateway/src/app.ts'), 'utf-8')
    expect(appTs).toContain('@mercuriusjs/gateway')
    expect(appTs).toContain('/health')
    expect(appTs).toContain('iam')

    const pkg = JSON.parse(readFileSync(resolve(testOutputDir, 'services/gateway/package.json'), 'utf-8'))
    expect(pkg.dependencies['@mercuriusjs/gateway']).toBeDefined()
    expect(pkg.dependencies.fastify).toBeDefined()
  })

  it('generates subgraph service with schema and resolvers', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(existsSync(resolve(testOutputDir, 'services/iam/package.json'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/iam/src/app.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/iam/src/index.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/iam/src/schema.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/iam/src/resolvers.ts'))).toBe(true)
    expect(existsSync(resolve(testOutputDir, 'services/iam/src/app.test.ts'))).toBe(true)

    const schemaTs = readFileSync(resolve(testOutputDir, 'services/iam/src/schema.ts'), 'utf-8')
    expect(schemaTs).toContain('@key(fields: "id")')
    expect(schemaTs).toContain('IamInfo')

    const resolversTs = readFileSync(resolve(testOutputDir, 'services/iam/src/resolvers.ts'), 'utf-8')
    expect(resolversTs).toContain('__resolveReference')
    expect(resolversTs).toContain('iamInfo')

    const pkg = JSON.parse(readFileSync(resolve(testOutputDir, 'services/iam/package.json'), 'utf-8'))
    expect(pkg.dependencies['@mercuriusjs/federation']).toBeDefined()
  })

  it('applies org scope to all package names', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
      orgScope: '@myorg',
    })

    const commonPkg = JSON.parse(readFileSync(resolve(testOutputDir, 'packages/common/package.json'), 'utf-8'))
    expect(commonPkg.name).toBe('@myorg/common')

    const gatewayPkg = JSON.parse(readFileSync(resolve(testOutputDir, 'services/gateway/package.json'), 'utf-8'))
    expect(gatewayPkg.name).toBe('@myorg/gateway')
    expect(gatewayPkg.dependencies['@myorg/common']).toBe('workspace:*')

    const iamPkg = JSON.parse(readFileSync(resolve(testOutputDir, 'services/iam/package.json'), 'utf-8'))
    expect(iamPkg.name).toBe('@myorg/iam')
  })

  it('rejects invalid ship name', () => {
    expect(() =>
      scaffold({
        name: 'Bad-Name',
        profilePath,
        catalogDir,
        outputDir: testOutputDir,
      }),
    ).toThrow(/lowercase/)
  })

  it('rejects existing output directory', () => {
    scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(() =>
      scaffold({
        name: 'test-ship',
        profilePath,
        catalogDir,
        outputDir: testOutputDir,
      }),
    ).toThrow(/already exists/)
  })

  it('lists capabilities from all applied patterns', () => {
    const result = scaffold({
      name: 'test-ship',
      profilePath,
      catalogDir,
      outputDir: testOutputDir,
    })

    expect(result.manifest.capabilities).toContain('monorepo.workspace')
    expect(result.manifest.capabilities).toContain('auth.oidc')
    expect(result.manifest.capabilities).toContain('api.graphql-federation')
  })
})
