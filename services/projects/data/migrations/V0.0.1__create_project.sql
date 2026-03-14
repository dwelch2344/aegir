CREATE TABLE project (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER      NOT NULL,
    name            VARCHAR(255) NOT NULL,
    repo_url        VARCHAR(500) NOT NULL,
    branch          VARCHAR(100) NOT NULL DEFAULT 'main',
    local_path      VARCHAR(500),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CLONING', 'READY', 'ERROR', 'STALE')),
    last_synced_at  TIMESTAMPTZ,
    manifest_raw    TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_organization_id ON project (organization_id);
CREATE INDEX idx_project_status ON project (status);
