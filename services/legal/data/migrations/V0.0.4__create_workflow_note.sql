-- Generic note entity within the legal service
CREATE TABLE note (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    author_identity_id  INTEGER      NOT NULL,
    content             TEXT         NOT NULL,
    visibility          VARCHAR(50)  NOT NULL DEFAULT 'INTERNAL',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_author_identity_id ON note (author_identity_id);

-- Join table: workflow task <-> note
CREATE TABLE workflow_task_note (
    workflow_id  VARCHAR(255) NOT NULL,
    task_name    VARCHAR(255) NOT NULL,
    note_id      UUID         NOT NULL REFERENCES note(id) ON DELETE CASCADE,
    PRIMARY KEY (workflow_id, task_name, note_id)
);

CREATE INDEX idx_workflow_task_note_note_id ON workflow_task_note (note_id);
CREATE INDEX idx_workflow_task_note_lookup ON workflow_task_note (workflow_id, task_name);
