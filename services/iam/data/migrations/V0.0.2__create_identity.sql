CREATE TABLE identity (
    id              SERIAL       PRIMARY KEY,
    type            VARCHAR(50)  NOT NULL DEFAULT 'USER',
    label           VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    organization_id INTEGER      REFERENCES organization(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_email ON identity (email);
CREATE INDEX idx_identity_organization_id ON identity (organization_id);
