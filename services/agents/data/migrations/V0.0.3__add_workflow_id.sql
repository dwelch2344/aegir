DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation' AND column_name = 'workflow_id') THEN
    ALTER TABLE conversation ADD COLUMN workflow_id VARCHAR(255);
  END IF;
END $$;
