-- Default roles
INSERT INTO role (id, key, name) VALUES (1, 'admin', 'Admin') ON CONFLICT (key) DO NOTHING;
INSERT INTO role (id, key, name) VALUES (2, 'member', 'Member') ON CONFLICT (key) DO NOTHING;
SELECT setval('role_id_seq', (SELECT MAX(id) FROM role));

-- SELF org relationships (every org relates to itself)
INSERT INTO org_relationship (owner_org_id, related_org_id, relationship_type)
VALUES (1, 1, 'SELF'), (2, 2, 'SELF')
ON CONFLICT (owner_org_id, related_org_id, relationship_type) DO NOTHING;

-- System identity (id=1) is Admin of System org (id=1)
INSERT INTO membership (id, identity_id, organization_id) VALUES (1, 1, 1)
ON CONFLICT (identity_id, organization_id) DO NOTHING;
INSERT INTO membership_role (membership_id, role_id)
VALUES (1, 1)
ON CONFLICT (membership_id, role_id) DO NOTHING;

-- Alice (id=2) is Admin of aegir org (id=2)
INSERT INTO membership (id, identity_id, organization_id) VALUES (2, 2, 2)
ON CONFLICT (identity_id, organization_id) DO NOTHING;
INSERT INTO membership_role (membership_id, role_id)
VALUES (2, 1)
ON CONFLICT (membership_id, role_id) DO NOTHING;

-- Bob (id=3) is Member of aegir org (id=2)
INSERT INTO membership (id, identity_id, organization_id) VALUES (3, 3, 2)
ON CONFLICT (identity_id, organization_id) DO NOTHING;
INSERT INTO membership_role (membership_id, role_id)
VALUES (3, 2)
ON CONFLICT (membership_id, role_id) DO NOTHING;

SELECT setval('membership_id_seq', (SELECT MAX(id) FROM membership));

-- Default Admin permissions (scoped to SELF relationship)
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (1, 'ORG_UPDATE', 'SELF'),
    (1, 'ORG_READ', 'SELF'),
    (1, 'MEMBERSHIP_CREATE', 'SELF'),
    (1, 'MEMBERSHIP_READ', 'SELF'),
    (1, 'MEMBERSHIP_UPDATE', 'SELF'),
    (1, 'MEMBERSHIP_DELETE', 'SELF'),
    (1, 'ROLE_ASSIGN', 'SELF')
ON CONFLICT (role_id, permission, relationship_type) DO NOTHING;

-- Default Member permissions (scoped to SELF relationship)
INSERT INTO role_permission (role_id, permission, relationship_type) VALUES
    (2, 'ORG_READ', 'SELF'),
    (2, 'MEMBERSHIP_READ', 'SELF')
ON CONFLICT (role_id, permission, relationship_type) DO NOTHING;
