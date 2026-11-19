-- CPOE / order dashboard: nurse acknowledgement, discontinue/cancel reason, hold/renew/modify,
-- verbal orders with read-back + physician co-sign, order sets, and five new order types
-- (dietary, therapy, procedure, consult, nursing).

-- Ledger additions.
ALTER TABLE orders ADD COLUMN acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN acknowledged_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN reason TEXT;
-- Verbal/telephone order: read-back must be confirmed at the moment the order is entered (the nurse
-- reads the order back to the ordering physician right then) — physician co-sign happens later.
ALTER TABLE orders ADD COLUMN is_verbal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN read_back_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN requires_cosign BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN cosigned_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN cosigned_at TIMESTAMPTZ;
-- Renew/modify: the old order is marked completed and a new one created with (for renew) the same
-- detail or (for modify) updated detail; this links the new row back to what it replaced.
ALTER TABLE orders ADD COLUMN replaces_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN order_set_id TEXT;

ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('draft', 'active', 'held', 'completed', 'discontinued', 'cancelled'));

ALTER TABLE orders DROP CONSTRAINT orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('medication', 'prn_stat', 'lab', 'radiology', 'dietary', 'therapy', 'procedure', 'consult', 'nursing'));

-- Medication priority — the dashboard previously had to hardcode 'routine' for every medication
-- order because no such field existed at all.
ALTER TABLE medications ADD COLUMN priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat'));

-- ------------------------------------------------------------------------------ new order types
CREATE TABLE dietary_orders (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id  TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    diet_type     TEXT NOT NULL,
    restrictions  TEXT,
    notes         TEXT,
    priority      TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    ordered_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dietary_orders_tenant_idx ON dietary_orders (tenant_id);

CREATE TABLE therapy_orders (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id   TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    therapy_type   TEXT NOT NULL,
    frequency      TEXT,
    notes          TEXT,
    priority       TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    ordered_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX therapy_orders_tenant_idx ON therapy_orders (tenant_id);

CREATE TABLE procedure_orders (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    procedure_name  TEXT NOT NULL,
    laterality      TEXT,
    scheduled_for   TIMESTAMPTZ,
    notes           TEXT,
    priority        TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    ordered_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX procedure_orders_tenant_idx ON procedure_orders (tenant_id);

CREATE TABLE consult_orders (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id        TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    consulting_service  TEXT NOT NULL,
    reason              TEXT NOT NULL,
    priority            TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    ordered_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX consult_orders_tenant_idx ON consult_orders (tenant_id);

CREATE TABLE nursing_orders (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id       TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    nursing_order_type TEXT NOT NULL,
    details            TEXT,
    priority           TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    ordered_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nursing_orders_tenant_idx ON nursing_orders (tenant_id);

-- ------------------------------------------------------------------------------ order sets
-- A named, reusable bundle of orders a physician can place in one action. `order_set_items.detail`
-- holds the same per-type body `POST /api/orders` already accepts (minus patientId/encounterId,
-- which are supplied at placement time), so placing a set reuses the single existing order-creation
-- path item by item rather than a second parallel write path.
CREATE TABLE order_sets (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX order_sets_tenant_idx ON order_sets (tenant_id);

CREATE TABLE order_set_items (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_set_id  TEXT NOT NULL REFERENCES order_sets(id) ON DELETE CASCADE,
    order_type    TEXT NOT NULL CHECK (order_type IN ('medication', 'prn_stat', 'lab', 'radiology', 'dietary', 'therapy', 'procedure', 'consult', 'nursing')),
    detail        JSONB NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX order_set_items_set_idx ON order_set_items (order_set_id, sort_order);
