-- Add organization_id to contract, defaulting existing rows to org 2 (acme)
ALTER TABLE contract ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 2;

-- Remove the default after backfill so future inserts must specify org
ALTER TABLE contract ALTER COLUMN organization_id DROP DEFAULT;

CREATE INDEX idx_contract_organization_id ON contract (organization_id);
