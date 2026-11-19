-- Patient registration module: USCDI demographics, coded multi-select race/ethnicity, NOK/guardian
-- role, unknown-patient path, and registration-time consent (consents no longer require an encounter).

-- USCDI v3 demographics. Coded (see lib/uscdiCodes.js), not free text.
ALTER TABLE patients ADD COLUMN gender_identity TEXT;
ALTER TABLE patients ADD COLUMN sex_at_birth TEXT CHECK (sex_at_birth IS NULL OR sex_at_birth IN ('M', 'F', 'UNK'));
ALTER TABLE patients ADD COLUMN sexual_orientation TEXT;
ALTER TABLE patients ADD COLUMN interpreter_needed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN communication_preference TEXT[];

-- Race is multi-select per the OMB/US Core standard (a person may select more than one category);
-- ethnicity stays single-select (OMB ethnicity is a binary Hispanic/not-Hispanic categorization).
-- Existing single-value text is carried forward as a one-element array rather than dropped.
ALTER TABLE patients ALTER COLUMN race TYPE TEXT[] USING (CASE WHEN race IS NULL OR race = '' THEN NULL ELSE ARRAY[race] END);

-- Unknown/unidentified-patient registration path (trauma, unresponsive arrival, etc.) — a placeholder
-- identity is allowed through; this flag lets the UI keep surfacing "identity not confirmed" until a
-- real registration update clears it.
ALTER TABLE patients ADD COLUMN is_unknown_patient BOOLEAN NOT NULL DEFAULT FALSE;

-- Next-of-kin / legal-guardian designation on an emergency-contact record (distinct from the existing
-- free-text "relationship" label, which only describes the relationship, not a legal role).
ALTER TABLE patient_emergency_contacts ADD COLUMN is_guardian BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patient_emergency_contacts ADD COLUMN legal_role TEXT
    CHECK (legal_role IS NULL OR legal_role IN ('next_of_kin', 'legal_guardian', 'power_of_attorney', 'healthcare_proxy'));

-- Registration-time consent: a consent (e.g. HIPAA NPP, General Treatment) can now be recorded before
-- any encounter exists, not just during an admission.
ALTER TABLE consents ALTER COLUMN encounter_id DROP NOT NULL;
