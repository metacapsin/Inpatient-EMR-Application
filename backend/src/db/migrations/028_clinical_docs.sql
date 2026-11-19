-- Problem list / clinical docs module: POA/principal diagnosis, co-sign for clinical notes.

-- POA (Present On Admission) uses the real UB-04/CMS indicator set, not a bare boolean.
ALTER TABLE problems ADD COLUMN poa TEXT CHECK (poa IS NULL OR poa IN ('Y','N','U','W','1'));
ALTER TABLE problems ADD COLUMN is_principal BOOLEAN NOT NULL DEFAULT FALSE;
-- At most one principal diagnosis per encounter.
CREATE UNIQUE INDEX problems_one_principal_per_encounter
    ON problems (encounter_id) WHERE is_principal AND encounter_id IS NOT NULL;

ALTER TABLE clinical_notes ADD COLUMN requires_cosign BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clinical_notes ADD COLUMN cosigned_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinical_notes ADD COLUMN cosigned_at TIMESTAMPTZ;
