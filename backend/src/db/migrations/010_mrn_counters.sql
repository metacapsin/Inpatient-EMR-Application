-- Per-tenant MRN counter. Replaces the count(*)+1 approach, which could hand two concurrent
-- registrations the same number. Seeded from the current patient count so numbering continues.
CREATE TABLE mrn_counters (
    tenant_id  TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    last_value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO mrn_counters (tenant_id, last_value)
SELECT tenant_id, count(*) FROM patients GROUP BY tenant_id;
