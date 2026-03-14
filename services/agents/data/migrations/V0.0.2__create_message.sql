CREATE TABLE IF NOT EXISTS message (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID         NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    text            TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_conversation_id ON message (conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON message (conversation_id, created_at);
