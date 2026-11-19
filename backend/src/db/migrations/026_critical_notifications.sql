-- Results / critical notifications (SAF-06): read-back audit trail and escalation tracking for
-- critical lab results. `read_back_value` is what the acknowledging clinician typed back to confirm
-- (kept even on success, as the audit record that a read-back actually happened — not just a flag).
ALTER TABLE lab_results ADD COLUMN read_back_value TEXT;
ALTER TABLE lab_results ADD COLUMN escalated_at TIMESTAMPTZ;
CREATE INDEX lab_results_escalation_idx ON lab_results (tenant_id, resulted_at)
    WHERE is_critical AND acknowledged_at IS NULL AND escalated_at IS NULL;
