CREATE TABLE IF NOT EXISTS project_activity (
    id           SERIAL       PRIMARY KEY,
    project_id   UUID         NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    workflow_id  VARCHAR(255) NOT NULL,
    type         VARCHAR(50)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'RUNNING',
    started_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity (project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_workflow ON project_activity (workflow_id);

CREATE TABLE IF NOT EXISTS project_activity_log (
    id          SERIAL       PRIMARY KEY,
    activity_id INTEGER      NOT NULL REFERENCES project_activity(id) ON DELETE CASCADE,
    task_name   VARCHAR(100) NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    message     TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_log_activity ON project_activity_log (activity_id);
