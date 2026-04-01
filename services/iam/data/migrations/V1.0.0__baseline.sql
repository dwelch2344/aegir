-- =============================================================================
-- IAM Baseline Schema v1.0.0
-- Consolidated from V0.0.1–V0.0.12. Drop & recreate for fresh installs.
-- =============================================================================

-- ── Organization ─────────────────────────────────────────────────────────────
CREATE TABLE organization (
    id          SERIAL       PRIMARY KEY,
    key         VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    keycloak_id VARCHAR(255) UNIQUE,
    protected   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Identity ─────────────────────────────────────────────────────────────────
CREATE TABLE identity (
    id              SERIAL       PRIMARY KEY,
    type            VARCHAR(50)  NOT NULL DEFAULT 'USER'
                    CHECK (type IN ('USER', 'SUPER_USER', 'SERVICE_ACCOUNT')),
    label           VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    keycloak_id     VARCHAR(255) UNIQUE,
    organization_id INTEGER      REFERENCES organization(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_identity_organization_id ON identity (organization_id);

-- ── Role ─────────────────────────────────────────────────────────────────────
CREATE TABLE role (
    id         SERIAL       PRIMARY KEY,
    key        VARCHAR(100) NOT NULL UNIQUE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Role Permission (ReBAC: permission scoped to relationship type) ─────────
CREATE TABLE role_permission (
    id                SERIAL       PRIMARY KEY,
    role_id           INTEGER      NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permission        VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(100) NOT NULL,
    UNIQUE(role_id, permission, relationship_type)
);

-- ── Membership (Identity ↔ Organization, with roles) ────────────────────────
CREATE TABLE membership (
    id              SERIAL    PRIMARY KEY,
    identity_id     INTEGER   NOT NULL REFERENCES identity(id),
    organization_id INTEGER   NOT NULL REFERENCES organization(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(identity_id, organization_id)
);
CREATE INDEX idx_membership_identity     ON membership (identity_id);
CREATE INDEX idx_membership_organization ON membership (organization_id);

CREATE TABLE membership_role (
    membership_id INTEGER NOT NULL REFERENCES membership(id) ON DELETE CASCADE,
    role_id       INTEGER NOT NULL REFERENCES role(id),
    PRIMARY KEY (membership_id, role_id)
);
CREATE INDEX idx_membership_role_role ON membership_role (role_id);

-- ── Org Relationship (directed edge between orgs with type) ──────────────────
CREATE TABLE org_relationship (
    id                SERIAL       PRIMARY KEY,
    owner_org_id      INTEGER      NOT NULL REFERENCES organization(id),
    related_org_id    INTEGER      NOT NULL REFERENCES organization(id),
    relationship_type VARCHAR(100) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(owner_org_id, related_org_id, relationship_type)
);
CREATE INDEX idx_org_rel_owner   ON org_relationship (owner_org_id);
CREATE INDEX idx_org_rel_related ON org_relationship (related_org_id);
CREATE INDEX idx_org_rel_type    ON org_relationship (relationship_type);


-- =============================================================================
-- Seed Data
-- =============================================================================

-- ── System organization (immutable, always id=1) ─────────────────────────────
INSERT INTO organization (id, key, name, protected) VALUES
    (1, 'system', 'System', true);

-- ── SELF relationship for system org ─────────────────────────────────────────
INSERT INTO org_relationship (owner_org_id, related_org_id, relationship_type) VALUES
    (1, 1, 'SELF');

-- ── Default roles ────────────────────────────────────────────────────────────
INSERT INTO role (id, key, name) VALUES
    (1, 'owner',  'Owner'),
    (2, 'admin',  'Admin'),
    (3, 'member', 'Member');

-- ── Owner permissions (SELF-scoped) ──────────────────────────────────────────
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (1, 'ORG_CREATE',        'SELF'),
    (1, 'ORG_READ',          'SELF'),
    (1, 'ORG_UPDATE',        'SELF'),
    (1, 'ORG_DELETE',        'SELF'),
    (1, 'MEMBERSHIP_CREATE', 'SELF'),
    (1, 'MEMBERSHIP_READ',   'SELF'),
    (1, 'MEMBERSHIP_UPDATE', 'SELF'),
    (1, 'MEMBERSHIP_DELETE', 'SELF'),
    (1, 'ROLE_ASSIGN',       'SELF'),
    (1, 'ROLE_MANAGE',       'SELF'),
    (1, 'IAM_CONFIGURE',     'SELF');

-- ── Owner permissions (SYS_CHILD-scoped — system owner can manage child orgs)
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (1, 'ORG_CREATE',        'SYS_CHILD'),
    (1, 'ORG_READ',          'SYS_CHILD'),
    (1, 'ORG_UPDATE',        'SYS_CHILD'),
    (1, 'ORG_DELETE',        'SYS_CHILD'),
    (1, 'MEMBERSHIP_CREATE', 'SYS_CHILD'),
    (1, 'MEMBERSHIP_READ',   'SYS_CHILD'),
    (1, 'MEMBERSHIP_UPDATE', 'SYS_CHILD'),
    (1, 'MEMBERSHIP_DELETE', 'SYS_CHILD'),
    (1, 'ROLE_ASSIGN',       'SYS_CHILD');

-- ── Admin permissions (SELF-scoped) ──────────────────────────────────────────
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (2, 'ORG_READ',          'SELF'),
    (2, 'ORG_UPDATE',        'SELF'),
    (2, 'MEMBERSHIP_CREATE', 'SELF'),
    (2, 'MEMBERSHIP_READ',   'SELF'),
    (2, 'MEMBERSHIP_UPDATE', 'SELF'),
    (2, 'MEMBERSHIP_DELETE', 'SELF'),
    (2, 'ROLE_ASSIGN',       'SELF');

-- ── Member permissions (SELF-scoped) ─────────────────────────────────────────
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (3, 'ORG_READ',        'SELF'),
    (3, 'MEMBERSHIP_READ', 'SELF');

-- ── Reset sequences ──────────────────────────────────────────────────────────
SELECT setval('organization_id_seq', (SELECT max(id) FROM organization));
SELECT setval('role_id_seq',         (SELECT max(id) FROM role));
