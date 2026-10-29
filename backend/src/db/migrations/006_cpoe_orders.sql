ALTER TABLE medications ADD COLUMN encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL;
ALTER TABLE prn_stat_orders ADD COLUMN encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL;

CREATE TABLE orders (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id  TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    order_type    TEXT NOT NULL CHECK (order_type IN ('medication','prn_stat','lab','radiology')),
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','discontinued','cancelled')),
    ref_table     TEXT NOT NULL,
    ref_id        TEXT NOT NULL,
    ordered_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    ordered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_encounter_idx ON orders (encounter_id, ordered_at DESC);
