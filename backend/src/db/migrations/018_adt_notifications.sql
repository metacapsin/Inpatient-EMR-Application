-- CMS CoP 42 CFR 482.24(d): admission / transfer / discharge notifications to PCP & post-acute providers.
CREATE TABLE notification_recipients (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    kind                TEXT NOT NULL CHECK (kind IN ('pcp','post_acute','hie','other')),
    transport           TEXT NOT NULL CHECK (transport IN ('stub','https_webhook','mllp','email','direct')),
    endpoint            TEXT,
    auth_header_secret  TEXT,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_recipients_tenant_idx ON notification_recipients (tenant_id, enabled);

CREATE TABLE adt_notification_log (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id   TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    patient_id     TEXT REFERENCES patients(id) ON DELETE CASCADE,
    event_type     TEXT NOT NULL CHECK (event_type IN ('A01','A02','A03','A08')),
    recipient_id   TEXT REFERENCES notification_recipients(id) ON DELETE SET NULL,
    recipient_name TEXT,
    transport      TEXT NOT NULL DEFAULT 'stub',
    message        TEXT NOT NULL,          -- the HL7 payload actually sent
    status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
    attempts       INT NOT NULL DEFAULT 0,
    last_error     TEXT,
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX adt_notification_log_encounter_idx ON adt_notification_log (encounter_id, created_at DESC);
CREATE INDEX adt_notification_log_status_idx ON adt_notification_log (tenant_id, status, created_at DESC);

ALTER TABLE patients ADD COLUMN pcp_name TEXT;
ALTER TABLE patients ADD COLUMN pcp_npi TEXT;
ALTER TABLE patients ADD COLUMN pcp_recipient_id TEXT REFERENCES notification_recipients(id) ON DELETE SET NULL;
