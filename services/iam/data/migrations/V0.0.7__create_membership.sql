CREATE TABLE membership (
    id              SERIAL      PRIMARY KEY,
    identity_id     INTEGER     NOT NULL REFERENCES identity(id),
    organization_id INTEGER     NOT NULL REFERENCES organization(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (identity_id, organization_id)
);

CREATE INDEX idx_membership_identity ON membership (identity_id);
CREATE INDEX idx_membership_organization ON membership (organization_id);
