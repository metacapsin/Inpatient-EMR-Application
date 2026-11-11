-- Module #9 — CDS drug-drug / drug-allergy alerts (ONC §170.315(a)(4)).
-- Stub interaction rules (source='stub') are teaching cases for development/testing only —
-- NOT a validated clinical knowledge base. Replace with a licensed KB before production use.

ALTER TABLE prn_stat_orders ADD COLUMN IF NOT EXISTS rxnorm_code TEXT;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS rxnorm_code TEXT;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS allergy_class TEXT;

CREATE TABLE IF NOT EXISTS drug_interaction_rules (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rule_type     TEXT NOT NULL CHECK (rule_type IN ('drug_drug', 'drug_allergy_class')),
    rxnorm_code_a TEXT NOT NULL,
    rxnorm_code_b TEXT,
    allergy_class TEXT,
    severity      TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'contraindicated')),
    description   TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'stub',
    CHECK (
        (rule_type = 'drug_drug' AND rxnorm_code_b IS NOT NULL)
        OR (rule_type = 'drug_allergy_class' AND allergy_class IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS dir_a_idx ON drug_interaction_rules (rxnorm_code_a);
CREATE INDEX IF NOT EXISTS dir_b_idx ON drug_interaction_rules (rxnorm_code_b);
CREATE INDEX IF NOT EXISTS dir_class_idx ON drug_interaction_rules (allergy_class) WHERE allergy_class IS NOT NULL;

CREATE TABLE IF NOT EXISTS cds_severity_overrides (
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id   TEXT NOT NULL REFERENCES drug_interaction_rules(id) ON DELETE CASCADE,
    severity  TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'contraindicated', 'suppressed')),
    set_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    set_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, rule_id)
);

CREATE TABLE IF NOT EXISTS cds_alerts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    context_type    TEXT NOT NULL CHECK (context_type IN ('cpoe_order', 'prescription_sign', 'med_rec')),
    context_id      TEXT,
    rule_id         TEXT REFERENCES drug_interaction_rules(id) ON DELETE SET NULL,
    severity        TEXT NOT NULL,
    message         TEXT NOT NULL,
    outcome         TEXT NOT NULL CHECK (outcome IN ('blocked', 'overridden', 'advisory')),
    overridden_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    override_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cds_alerts_patient_idx ON cds_alerts (tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cds_alerts_context_idx ON cds_alerts (tenant_id, context_type, context_id);
