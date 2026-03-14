CREATE TABLE project_status_report (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID         NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    issues           JSONB        NOT NULL DEFAULT '[]',
    services_ok      INTEGER      NOT NULL DEFAULT 0,
    services_missing INTEGER      NOT NULL DEFAULT 0,
    outdated_patterns INTEGER     NOT NULL DEFAULT 0,
    checked_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_status_report_project_id ON project_status_report (project_id);
