-- AI assistant (#SEC-01 remediation): every server-side model call is logged here for audit.
-- Deliberately stores NO prompt or response text and no patient identifiers beyond the id, only a
-- hash of the prompt so duplicate/replay analysis is possible without retaining PHI.
CREATE TABLE IF NOT EXISTS ai_requests (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
    patient_id    TEXT,
    endpoint      TEXT NOT NULL,
    model         TEXT NOT NULL,
    prompt_sha256 TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('ok', 'error')),
    error_code    TEXT,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_requests_tenant_created_idx ON ai_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_requests_patient_idx ON ai_requests (tenant_id, patient_id);

-- The AI module is tenant-toggleable like the other five. Turn it on for existing tenants so the
-- gate shipping with this migration does not switch the feature off underneath anyone.
ALTER TABLE tenants
    ALTER COLUMN enabled_modules SET DEFAULT '["adt","patients","medication","billing","staffing","ai"]'::jsonb;
UPDATE tenants
SET enabled_modules = enabled_modules || '["ai"]'::jsonb
WHERE NOT (enabled_modules ? 'ai');
