-- Structured lab results, specimen collection, critical-value acknowledgement.
ALTER TABLE lab_orders ADD COLUMN accession_number TEXT;
ALTER TABLE lab_orders ADD COLUMN specimen_type TEXT;
ALTER TABLE lab_orders ADD COLUMN collected_at TIMESTAMPTZ;
ALTER TABLE lab_orders ADD COLUMN collected_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lab_orders ADD COLUMN clinical_indication TEXT;
ALTER TABLE lab_orders ADD COLUMN resulted_at TIMESTAMPTZ;
ALTER TABLE lab_orders ADD COLUMN cancelled_at TIMESTAMPTZ;

CREATE TABLE lab_accession_counters (
    tenant_id   TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    last_value  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE lab_results (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lab_order_id     TEXT NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    test_code        TEXT,
    test_name        TEXT NOT NULL,
    loinc_code       TEXT,
    value_num        NUMERIC,
    value_text       TEXT,
    unit             TEXT,
    ref_low          NUMERIC,
    ref_high         NUMERIC,
    abnormal_flag    TEXT CHECK (abnormal_flag IN ('N','L','H','LL','HH','A')),
    is_critical      BOOLEAN NOT NULL DEFAULT FALSE,
    status           TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('preliminary','final','corrected')),
    resulted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resulted_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at  TIMESTAMPTZ,
    comment          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lab_results_order_idx ON lab_results (lab_order_id);
CREATE INDEX lab_results_patient_idx ON lab_results (patient_id, resulted_at DESC);
CREATE INDEX lab_results_critical_idx ON lab_results (tenant_id, is_critical) WHERE acknowledged_at IS NULL;
