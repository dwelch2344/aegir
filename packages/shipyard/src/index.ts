export {
  manifestSchema,
  type ShipManifest,
  type ShipService,
  type CatalogRef,
} from './manifest-schema.js'

export {
  catalogEntrySchema,
  type CatalogEntry,
  type CatalogParameter,
  type TestCriterion,
} from './catalog-schema.js'

export { profileSchema, type Profile, type ProfilePattern } from './profile-schema.js'

export { loadCatalog, resolvePatternOrder, collectCapabilities } from './catalog-reader.js'

export { scaffold, type ScaffoldOptions, type ScaffoldResult } from './scaffolder.js'

export { apply, type ApplyOptions, type ApplyResult } from './applicator.js'

export { status, type StatusResult, type ServiceStatus, type PatternStatus } from './status.js'
