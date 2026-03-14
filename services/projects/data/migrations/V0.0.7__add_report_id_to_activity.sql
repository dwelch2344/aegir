ALTER TABLE project_activity
  ADD COLUMN report_id INTEGER REFERENCES project_diagnostics_report(id) ON DELETE SET NULL;
