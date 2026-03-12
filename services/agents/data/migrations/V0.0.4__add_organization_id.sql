-- Add organization_id to conversation, defaulting existing rows to org 2 (acme)
ALTER TABLE conversation ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 2;

-- Remove the default after backfill so future inserts must specify org
ALTER TABLE conversation ALTER COLUMN organization_id DROP DEFAULT;

CREATE INDEX idx_conversation_organization_id ON conversation (organization_id);
