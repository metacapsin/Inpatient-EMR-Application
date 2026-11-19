-- Audit logging (#SEC-02 remediation): append-only record of who touched what. Deliberately stores
-- no free-text PHI — only resource/patient/encounter ids, the request shape, and a details jsonb
-- that callers must keep to ids/codes/counts (see lib/audit.js). tenant_id is nullable because a
-- failed login or an FHIR 401 can happen before a tenant is ever resolved.
CREATE TABLE IF NOT EXISTS audit_events (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    actor_type    TEXT NOT NULL CHECK (actor_type IN ('staff', 'platform_admin', 'patient', 'anonymous')),
    actor_id      TEXT,
    actor_role    TEXT,
    action        TEXT NOT NULL CHECK (action IN (
                      'read', 'create', 'update', 'delete', 'login', 'login_failed', 'logout',
                      'refresh', 'password_reset', 'export', 'platform'
                  )),
    resource      TEXT,
    resource_id   TEXT,
    patient_id    TEXT,
    encounter_id  TEXT,
    method        TEXT,
    path          TEXT,
    query_keys    JSONB NOT NULL DEFAULT '[]'::jsonb,
    status        INTEGER,
    latency_ms    INTEGER,
    ip            TEXT,
    user_agent    TEXT,
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_tenant_at_idx ON audit_events (tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_patient_at_idx ON audit_events (tenant_id, patient_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_actor_at_idx ON audit_events (tenant_id, actor_id, at DESC);

-- Append-only: nothing (not even a Super Admin) may edit or remove an audit row directly. The one
-- exception is a DELETE arriving via ON DELETE CASCADE from a dropped tenant (platformAdmin.js's
-- tenant delete) — that cascade runs inside Postgres's own referential-integrity trigger, so
-- pg_trigger_depth() is >1 there, versus 1 for a direct `DELETE FROM audit_events`.
CREATE OR REPLACE FUNCTION audit_events_no_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_events is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_no_mutation();

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_no_mutation();

-- A 401 on the FHIR patient-access API can happen before any client/tenant is resolved; let it log too.
ALTER TABLE fhir_access_log ALTER COLUMN tenant_id DROP NOT NULL;
