-- Stedi payer directory + real-time eligibility (270/271), ported from EMR-Backend.
-- The picked payer's trading-partner id is persisted on the insurance row so eligibility calls
-- address the payer directly instead of guessing from the company name.
ALTER TABLE patient_insurance ADD COLUMN trading_partner_service_id TEXT;

-- One row per eligibility check (audit/history). Inline pre-save checks for an unsaved patient
-- carry no patient_id and are not persisted (same rule as the reference runner).
CREATE TABLE eligibility_checks (
    id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id                   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id                  TEXT REFERENCES patients(id) ON DELETE CASCADE,
    insurance_slot              TEXT NOT NULL CHECK (insurance_slot IN ('primary','secondary')),
    payer_name                  TEXT,
    trading_partner_service_id  TEXT,
    subscriber_id               TEXT,
    service_type_codes          TEXT[],
    status                      TEXT NOT NULL CHECK (status IN ('active','inactive','unknown','error','skipped')),
    summary                     JSONB,
    raw_request                 JSONB,
    raw_response                JSONB,
    error                       TEXT,
    checked_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                  TEXT
);
CREATE INDEX eligibility_checks_patient_idx ON eligibility_checks (tenant_id, patient_id, checked_at DESC);
