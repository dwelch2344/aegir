DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation' AND column_name = 'organization_id') THEN
    ALTER TABLE conversation ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 2;
    ALTER TABLE conversation ALTER COLUMN organization_id DROP DEFAULT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_organization_id ON conversation (organization_id);
