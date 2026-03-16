-- Track registry versions for context, bcp, and catalog

CREATE TABLE registry_version (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id INTEGER      NOT NULL,
    registry_type   VARCHAR(20)  NOT NULL CHECK (registry_type IN ('context', 'bcp', 'catalog')),
    version         VARCHAR(20)  NOT NULL DEFAULT '0.1.0',
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (organization_id, registry_type)
);
