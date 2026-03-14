CREATE TABLE IF NOT EXISTS project_diagnostics_report (
    id          SERIAL       PRIMARY KEY,
    project_id  UUID         NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    report      TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_diagnostics_report_project ON project_diagnostics_report (project_id);
