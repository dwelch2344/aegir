-- Catalog pattern entries

CREATE TABLE catalog_entry (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          INTEGER      NOT NULL,
    pattern_id               VARCHAR(100) NOT NULL,
    name                     VARCHAR(255) NOT NULL,
    version                  VARCHAR(20)  NOT NULL DEFAULT '0.0.0',
    description              TEXT         NOT NULL DEFAULT '',
    preconditions            TEXT[]       NOT NULL DEFAULT '{}',
    provides                 TEXT[]       NOT NULL DEFAULT '{}',
    parameters               JSONB        NOT NULL DEFAULT '{}',
    application_instructions TEXT         NOT NULL DEFAULT '',
    test_criteria            TEXT         NOT NULL DEFAULT '',
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, pattern_id)
);

CREATE INDEX idx_catalog_entry_org ON catalog_entry (organization_id);
