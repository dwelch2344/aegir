CREATE TABLE project_pattern (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID         NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    pattern_id VARCHAR(100) NOT NULL,
    version    VARCHAR(20)  NOT NULL,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_pattern_project_id ON project_pattern (project_id);
