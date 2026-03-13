-- Bootstrap organizations: System (protected) + project org
INSERT INTO organization (id, key, name, protected) VALUES
    (1, 'system', 'System',     true),
    (2, 'aegir',  'aegir Inc.', false);

-- Bootstrap identities: platform super-user + sample users
INSERT INTO identity (id, type, label, email, organization_id) VALUES
    (1, 'SUPER_USER', 'System',        'system@aegir.dev',  1),
    (2, 'USER',       'Alice Chen',    'alice@aegir.dev',   2),
    (3, 'USER',       'Bob Martinez',  'bob@aegir.dev',     2);

SELECT setval('organization_id_seq', (SELECT max(id) FROM organization));
SELECT setval('identity_id_seq',     (SELECT max(id) FROM identity));
