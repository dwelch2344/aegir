-- Add context_notes field to store project-specific context that agents load
-- when chatting about this project. Replaces generic "project" context tier.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project' AND column_name = 'context_notes') THEN
    ALTER TABLE project ADD COLUMN context_notes TEXT;
  END IF;
END $$;
