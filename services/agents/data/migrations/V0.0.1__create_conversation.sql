CREATE TABLE conversation (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(255) NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
