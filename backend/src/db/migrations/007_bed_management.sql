-- Bed management: timed reservations ('hold' finally means something), the EVS turnaround queue the
-- frontend was designed against, room-level isolation flags, and a manual-priority transfer-request queue.
-- See .cursor/plans/bed_booking_build_plan.md.

-- Reservations are their own table (not columns on beds) so cancelled/expired holds keep their history.
CREATE TABLE bed_reservations (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bed_id        TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
    encounter_id  TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    reserved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','expired','cancelled')),
    resolved_at   TIMESTAMPTZ,
    notes         TEXT
);
CREATE INDEX bed_reservations_bed_idx ON bed_reservations (bed_id, status);
CREATE INDEX bed_reservations_tenant_idx ON bed_reservations (tenant_id, status, expires_at);
-- At most one live hold per bed.
CREATE UNIQUE INDEX bed_reservations_one_active_uq ON bed_reservations (bed_id) WHERE status = 'active';

-- EVS (housekeeping) turnaround queue: dirty -> in_cleaning -> pending_inspection -> clean.
CREATE TABLE evs_queue (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bed_id         TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    encounter_id   TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    status         TEXT NOT NULL DEFAULT 'dirty' CHECK (status IN ('dirty','in_cleaning','pending_inspection','clean')),
    cleaning_type  TEXT NOT NULL DEFAULT 'Discharge' CHECK (cleaning_type IN ('Terminal','Routine','Isolation','Discharge')),
    assigned_to    TEXT REFERENCES users(id) ON DELETE SET NULL,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    inspected_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    inspected_at   TIMESTAMPTZ,
    clean_at       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX evs_queue_tenant_status_idx ON evs_queue (tenant_id, status, created_at);
CREATE INDEX evs_queue_bed_idx ON evs_queue (bed_id, created_at);
-- At most one open cleaning job per bed.
CREATE UNIQUE INDEX evs_queue_one_open_uq ON evs_queue (bed_id) WHERE status <> 'clean';

-- Isolation is a room property (negative pressure, private room), not a bed property.
ALTER TABLE rooms ADD COLUMN isolation_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN isolation_type TEXT;

-- Transfer / bed-request queue. Priority is manual — not an acuity score.
CREATE TABLE transfer_requests (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id       TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    requested_ward_id  TEXT REFERENCES wards(id) ON DELETE SET NULL,
    requested_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    priority           TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    reason             TEXT,
    status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','cancelled')),
    fulfilled_bed_id   TEXT REFERENCES beds(id) ON DELETE SET NULL,
    resolved_at        TIMESTAMPTZ,
    resolved_by        TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX transfer_requests_tenant_idx ON transfer_requests (tenant_id, status, requested_at);
CREATE INDEX transfer_requests_encounter_idx ON transfer_requests (encounter_id, status);
