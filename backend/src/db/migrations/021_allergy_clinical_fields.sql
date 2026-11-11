-- Clinical allergy fields for inpatient documentation (beyond CDS rxnorm/class).
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS record_type TEXT NOT NULL DEFAULT 'allergy';
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS criticality TEXT;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS clinical_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unconfirmed';
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS last_occurrence_date DATE;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS exposure_route TEXT;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS reported_by TEXT;
ALTER TABLE patient_allergies ADD COLUMN IF NOT EXISTS clinical_notes TEXT;

-- Align clinical_status with legacy is_active for existing inactive rows.
UPDATE patient_allergies SET clinical_status = 'inactive' WHERE is_active = FALSE;
