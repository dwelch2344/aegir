-- Best Current Practices: categories and entries

CREATE TABLE bcp_category (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER      NOT NULL,
    category_id     VARCHAR(100) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    color           VARCHAR(50)  NOT NULL DEFAULT 'gray',
    description     TEXT         NOT NULL DEFAULT '',
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, category_id)
);

CREATE INDEX idx_bcp_category_org ON bcp_category (organization_id);

CREATE TABLE bcp_entry (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID         NOT NULL REFERENCES bcp_category(id) ON DELETE CASCADE,
    organization_id INTEGER      NOT NULL,
    entry_id        VARCHAR(100) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT         NOT NULL DEFAULT '',
    content         TEXT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, entry_id)
);

CREATE INDEX idx_bcp_entry_category ON bcp_entry (category_id);
CREATE INDEX idx_bcp_entry_org ON bcp_entry (organization_id);
