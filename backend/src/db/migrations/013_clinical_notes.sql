-- Physician documentation (H&P, progress, discharge summary note, consult).
-- Shape mirrors the reference implementation (EMR-Backend `physician_notes`): the note body is a
-- `content` JSON object keyed by section (hpi / ros / assessment / plan), with an append-only
-- version history and addenda list, so the existing Clinical Workspace UI needs no remapping.
CREATE TABLE clinical_notes (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id      TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    note_type         TEXT NOT NULL CHECK (note_type IN ('hp','progress','discharge_summary','consult')),
    title             TEXT,
    content           JSONB NOT NULL DEFAULT '{}'::jsonb,
    rich_text         TEXT,
    status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed')),
    version_history   JSONB NOT NULL DEFAULT '[]'::jsonb,
    addenda           JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_order_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
    signed_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
    signed_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clinical_notes_patient_idx ON clinical_notes (tenant_id, patient_id, created_at DESC);
CREATE INDEX clinical_notes_encounter_idx ON clinical_notes (encounter_id, created_at DESC);
