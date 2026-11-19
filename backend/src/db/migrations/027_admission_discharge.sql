-- Admission / discharge / beds module.
-- SAF-12/Bucket C: AMA and deceased are structured, gated discharge workflows, not a free-text
-- disposition dropdown label.

ALTER TABLE encounters ADD COLUMN allergies_reviewed_at TIMESTAMPTZ;
ALTER TABLE encounters ADD COLUMN allergies_reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE patients ADD COLUMN deceased BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN deceased_at TIMESTAMPTZ;

CREATE TABLE ama_discharges (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id    TEXT NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    risks_explained BOOLEAN NOT NULL DEFAULT FALSE,
    witness_name    TEXT NOT NULL,
    patient_signature TEXT NOT NULL,  -- text attestation (typed name), same pattern as e-signatures elsewhere
    recorded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE death_records (
    id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id          TEXT NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE CASCADE,
    patient_id            TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    died_at               TIMESTAMPTZ NOT NULL,
    pronouncing_physician_id TEXT NOT NULL REFERENCES users(id),
    cause_of_death        TEXT,
    recorded_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
