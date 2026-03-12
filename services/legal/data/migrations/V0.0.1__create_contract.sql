CREATE TABLE contract (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    status       VARCHAR(50)  NOT NULL DEFAULT 'DRAFT',
    carrier_id   VARCHAR(255) NOT NULL DEFAULT '',
    carrier_name VARCHAR(255) NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_status ON contract (status);
CREATE INDEX idx_contract_carrier_id ON contract (carrier_id);
