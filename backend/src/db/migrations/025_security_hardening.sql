-- Security hardening (SEC-18): soft delete for patient_documents instead of a hard DELETE, so a
-- deleted document is recoverable and the row (and any audit trail referencing it) survives.
ALTER TABLE patient_documents ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE patient_documents ADD COLUMN deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX patient_documents_active_idx ON patient_documents (patient_id) WHERE deleted_at IS NULL;
