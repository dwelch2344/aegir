INSERT INTO organization (id, key, name) VALUES
    (1, 'aegir', 'aegir Inc.'),
    (2, 'acme',    'Acme Corp');

INSERT INTO identity (id, type, label, email, organization_id) VALUES
    (1, 'USER', 'Alice Chen',    'alice@aegir.dev', 1),
    (2, 'USER', 'Bob Martinez',  'bob@aegir.dev',   1),
    (3, 'USER', 'Carol Park',    'carol@aegir.dev',  2);

SELECT setval('organization_id_seq', (SELECT max(id) FROM organization));
SELECT setval('identity_id_seq',     (SELECT max(id) FROM identity));
