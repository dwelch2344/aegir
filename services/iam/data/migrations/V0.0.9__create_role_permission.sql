CREATE TABLE role_permission (
    id                SERIAL       PRIMARY KEY,
    role_id           INTEGER      NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permission        VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(100) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (role_id, permission, relationship_type)
);

CREATE INDEX idx_role_permission_role ON role_permission (role_id);
