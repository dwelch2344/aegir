ALTER TABLE organization ADD COLUMN keycloak_id VARCHAR(255) UNIQUE;

-- Backfill existing rows — real Keycloak IDs will be synced at runtime
UPDATE organization SET keycloak_id = 'kc-placeholder-' || id WHERE keycloak_id IS NULL;
