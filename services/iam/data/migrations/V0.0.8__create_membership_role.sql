CREATE TABLE membership_role (
    membership_id INTEGER NOT NULL REFERENCES membership(id) ON DELETE CASCADE,
    role_id       INTEGER NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (membership_id, role_id)
);

CREATE INDEX idx_membership_role_role ON membership_role (role_id);
