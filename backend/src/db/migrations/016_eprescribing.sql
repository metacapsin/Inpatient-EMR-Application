-- e-Prescribing Phase A: structured prescriptions, prescriber identity, pharmacy directory, status lifecycle.
ALTER TABLE prescriptions ADD COLUMN encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN prescriber_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN prescriber_npi TEXT;
ALTER TABLE prescriptions ADD COLUMN prescriber_dea TEXT;
ALTER TABLE prescriptions ADD COLUMN pharmacy_id TEXT;
ALTER TABLE prescriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','signed','transmitted','printed','dispensed','cancelled','error'));
ALTER TABLE prescriptions ADD COLUMN signed_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN transmitted_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN transmission_ref TEXT;
ALTER TABLE prescriptions ADD COLUMN error_message TEXT;
ALTER TABLE prescriptions ADD COLUMN controlled_schedule TEXT;  -- NULL, 'II'..'V'; EPCS gating hook
ALTER TABLE prescriptions ADD COLUMN notes TEXT;
ALTER TABLE prescriptions ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE prescriptions ADD COLUMN status_history JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Rows dispensed before this migration keep a consistent status.
UPDATE prescriptions SET status = 'dispensed' WHERE dispensed_at IS NOT NULL;

CREATE TABLE pharmacies (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    ncpdp_id    TEXT,
    npi         TEXT,
    phone       TEXT,
    fax         TEXT,
    address     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pharmacies_tenant_idx ON pharmacies (tenant_id, active);

ALTER TABLE users ADD COLUMN npi TEXT;
ALTER TABLE users ADD COLUMN dea_number TEXT;
