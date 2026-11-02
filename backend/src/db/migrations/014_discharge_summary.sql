-- Structured discharge summary (1:1 with encounter) + nursing discharge checklist.
-- Columns map 1:1 to the frontend's DischargeSummaryState / ChecklistTask types.
CREATE TABLE discharge_summaries (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id            TEXT NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE CASCADE,
    status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed')),
    admission_diagnosis     TEXT,
    hospital_course         TEXT,
    procedures              TEXT,
    final_diagnoses         TEXT,
    disposition             TEXT,
    condition_at_discharge  TEXT,
    follow_up_instructions  TEXT,
    discharge_medications_text TEXT,
    discharge_medications   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- MedLine[] snapshot copied from the discharge reconciliation at sign time
    author_id               TEXT REFERENCES users(id) ON DELETE SET NULL,
    signed_at               TIMESTAMPTZ,
    signed_by               TEXT REFERENCES users(id) ON DELETE SET NULL,
    signed_by_name          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discharge_checklist_tasks (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id      TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    label             TEXT NOT NULL,
    owner_role        TEXT NOT NULL DEFAULT 'nursing',
    blocks_discharge  BOOLEAN NOT NULL DEFAULT FALSE,
    completed         BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by      TEXT,
    completed_at      TIMESTAMPTZ,
    notes             TEXT NOT NULL DEFAULT '',
    sort_order        INT NOT NULL DEFAULT 0
);
CREATE INDEX discharge_checklist_encounter_idx ON discharge_checklist_tasks (encounter_id, sort_order);
