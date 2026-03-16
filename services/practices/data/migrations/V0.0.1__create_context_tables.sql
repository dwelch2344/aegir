-- Context registry: tiers, files, and topic entries
-- Models the three-tier context system (global, project, topics)

CREATE TABLE context_file (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER      NOT NULL,
    tier            VARCHAR(20)  NOT NULL CHECK (tier IN ('global', 'project')),
    path            VARCHAR(500) NOT NULL,
    description     TEXT         NOT NULL DEFAULT '',
    content         TEXT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, tier, path)
);

CREATE INDEX idx_context_file_org_tier ON context_file (organization_id, tier);

CREATE TABLE context_topic (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER      NOT NULL,
    topic_id        VARCHAR(100) NOT NULL,
    system_path     VARCHAR(500) NOT NULL DEFAULT '',
    project_path    VARCHAR(500) NOT NULL DEFAULT '',
    system_content  TEXT,
    project_content TEXT,
    trigger_files       TEXT[]   NOT NULL DEFAULT '{}',
    trigger_keywords    TEXT[]   NOT NULL DEFAULT '{}',
    trigger_catalog_refs TEXT[]  NOT NULL DEFAULT '{}',
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, topic_id)
);

CREATE INDEX idx_context_topic_org ON context_topic (organization_id);
