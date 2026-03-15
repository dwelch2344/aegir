-- Add optional project_id to scope conversations to a specific project (ship).
-- Conversations without a project_id are "general" org-level conversations.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation' AND column_name = 'project_id') THEN
    ALTER TABLE conversation ADD COLUMN project_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_project_id ON conversation (project_id);
