CREATE TABLE IF NOT EXISTS integration (
    id         SERIAL       PRIMARY KEY,
    key        VARCHAR(100) NOT NULL UNIQUE,
    name       VARCHAR(255) NOT NULL,
    metadata   TEXT         NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
