-- Problem List / ICD-10-CM reference (longitudinal medical problems; distinct from NANDA nursing diagnoses).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE icd10_codes (
    code           TEXT PRIMARY KEY,
    description    TEXT NOT NULL,
    billable       BOOLEAN NOT NULL DEFAULT true,
    effective_year INTEGER NOT NULL
);
CREATE INDEX icd10_codes_description_trgm ON icd10_codes USING gin (description gin_trgm_ops);
CREATE INDEX icd10_codes_code_prefix_idx ON icd10_codes (code text_pattern_ops);

CREATE TABLE problems (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id      TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    icd10_code        TEXT NOT NULL REFERENCES icd10_codes(code),
    icd10_description TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'resolved', 'entered_in_error')),
    chronicity        TEXT CHECK (chronicity IS NULL OR chronicity IN ('acute', 'chronic')),
    onset_date        DATE,
    resolved_date     DATE,
    noted_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX problems_patient_idx ON problems (patient_id, status);
CREATE INDEX problems_tenant_patient_idx ON problems (tenant_id, patient_id);

-- One active coded problem per patient (re-adding after resolve/inactive is allowed).
CREATE UNIQUE INDEX problems_active_unique
    ON problems (tenant_id, patient_id, icd10_code)
    WHERE status = 'active';
