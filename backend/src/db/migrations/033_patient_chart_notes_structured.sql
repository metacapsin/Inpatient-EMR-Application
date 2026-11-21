-- Structured note payload for CPT / specialty forms (Follow-Up, H&P High Complexity, TCM, CCM, etc.).
-- Free-text types keep structured_payload NULL; notes_text remains the signed narrative.
ALTER TABLE patient_chart_notes
    ADD COLUMN IF NOT EXISTS structured_payload JSONB;
