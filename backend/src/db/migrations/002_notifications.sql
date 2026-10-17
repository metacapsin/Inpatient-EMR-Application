CREATE TABLE notifications (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    action       TEXT NOT NULL DEFAULT '',
    message      TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, is_active, is_read, created_at DESC);
