CREATE TABLE org_relationship (
    id                SERIAL       PRIMARY KEY,
    owner_org_id      INTEGER      NOT NULL REFERENCES organization(id),
    related_org_id    INTEGER      NOT NULL REFERENCES organization(id),
    relationship_type VARCHAR(100) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (owner_org_id, related_org_id, relationship_type)
);

CREATE INDEX idx_org_relationship_owner ON org_relationship (owner_org_id);
CREATE INDEX idx_org_relationship_related ON org_relationship (related_org_id);
CREATE INDEX idx_org_relationship_type ON org_relationship (relationship_type);
