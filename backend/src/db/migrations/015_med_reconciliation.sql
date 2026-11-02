-- Medication reconciliation (admission / transfer / discharge). Home medications reuse the
-- medications table with source='home'.
ALTER TABLE medications ADD COLUMN source TEXT NOT NULL DEFAULT 'inpatient' CHECK (source IN ('home','inpatient'));
ALTER TABLE medications ADD COLUMN rxnorm_code TEXT;
ALTER TABLE medications ADD COLUMN last_taken_at TIMESTAMPTZ;
ALTER TABLE medications ADD COLUMN reported_by TEXT;   -- patient / family / pharmacy / PDMP
ALTER TABLE medications ADD COLUMN instructions TEXT;
CREATE INDEX medications_patient_source_idx ON medications (patient_id, source) WHERE is_active;

CREATE TABLE medication_reconciliations (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id   TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    type           TEXT NOT NULL CHECK (type IN ('admission','transfer','discharge')),
    status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
    lines          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- MedLine & { action: continue|modify|stop|new, reason?, originalMedicationId? }
    completed_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One admission and one discharge reconciliation per encounter; transfers may repeat.
CREATE UNIQUE INDEX med_rec_encounter_type_uq ON medication_reconciliations (encounter_id, type) WHERE type <> 'transfer';
CREATE INDEX med_rec_encounter_idx ON medication_reconciliations (encounter_id, created_at DESC);
