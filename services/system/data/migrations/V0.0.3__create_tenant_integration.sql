CREATE TABLE IF NOT EXISTS tenant_integration (
    tenant_id      INTEGER      NOT NULL REFERENCES tenant(id),
    integration_id INTEGER      NOT NULL REFERENCES integration(id),
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    name           VARCHAR(255) NOT NULL,
    metadata       TEXT         NOT NULL DEFAULT '{}',
    ordinal        INTEGER,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integration_tenant ON tenant_integration (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integration_status ON tenant_integration (status);
