-- Facesheet chart notes (ambulatory-style free-text notes), distinct from clinical_notes
-- (Clinical Workspace H&P / progress sections). Free-text types + Office Form / Work / Phone.
CREATE TABLE patient_chart_notes (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id            TEXT NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
    notes_type              TEXT NOT NULL,
    notes_text              TEXT NOT NULL DEFAULT '',
    visit_date              DATE NOT NULL,
    visit_time              TEXT,
    assigned_provider_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    assigned_provider_name  TEXT NOT NULL DEFAULT '',
    note_status             TEXT NOT NULL DEFAULT 'In Draft'
                            CHECK (note_status IN ('In Draft', 'Completed', 'Marked in Error')),
    provider_signed         TEXT NOT NULL DEFAULT '',
    signed_date             TEXT NOT NULL DEFAULT '',
    signed_time             TEXT NOT NULL DEFAULT '',
    in_error_reason         TEXT,
    status                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_chart_notes_patient_idx
    ON patient_chart_notes (tenant_id, patient_id, created_at DESC);
CREATE INDEX patient_chart_notes_encounter_idx
    ON patient_chart_notes (encounter_id, created_at DESC);
CREATE INDEX patient_chart_notes_status_idx
    ON patient_chart_notes (tenant_id, patient_id, note_status);
