-- Bootstrap: one tenant per ship
INSERT INTO tenant (id, key, name) VALUES
    (1, 'aegir', 'aegir Inc.')
ON CONFLICT (id) DO NOTHING;

-- Bootstrap: platform-level integrations
INSERT INTO integration (id, key, name, metadata) VALUES
    (1, 'keycloak', 'Keycloak', '{}'),
    (2, 'slack',    'Slack',    '{}'),
    (3, 'github',   'GitHub',   '{}')
ON CONFLICT (id) DO NOTHING;

-- Bootstrap: tenant integration links
INSERT INTO tenant_integration (tenant_id, integration_id, status, name) VALUES
    (1, 1, 'ACTIVE', 'Keycloak'),
    (1, 2, 'ACTIVE', 'Slack'),
    (1, 3, 'ACTIVE', 'GitHub')
ON CONFLICT (tenant_id, integration_id) DO NOTHING;

SELECT setval('tenant_id_seq', (SELECT max(id) FROM tenant));
SELECT setval('integration_id_seq', (SELECT max(id) FROM integration));
