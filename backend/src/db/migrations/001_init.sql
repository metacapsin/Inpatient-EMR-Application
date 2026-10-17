-- Inpatient EMR schema. IDs are TEXT (uuid strings) so they round-trip through the frontend as plain strings.

CREATE TABLE tenants (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    username            TEXT,
    password_hash       TEXT NOT NULL,
    first_name          TEXT NOT NULL DEFAULT '',
    last_name           TEXT NOT NULL DEFAULT '',
    role                TEXT NOT NULL DEFAULT 'nurse'
                        CHECK (role IN ('admin','physician','nurse','pharmacist','billing','staff')),
    preferences         JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    reset_token_hash    TEXT,
    reset_expires_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE UNIQUE INDEX users_username_uq ON users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX users_tenant_idx ON users (tenant_id);

CREATE TABLE refresh_tokens (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Facility ---------------------------------------------------------------
CREATE TABLE wards (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    code        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE rooms (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ward_id      TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    room_number  TEXT NOT NULL,
    room_type    TEXT NOT NULL DEFAULT 'General',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ward_id, room_number)
);
CREATE INDEX rooms_ward_idx ON rooms (ward_id);

CREATE TABLE beds (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','occupied','hold','maintenance','blocked','dirty')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, label)
);
CREATE INDEX beds_room_idx ON beds (room_id);
CREATE INDEX beds_status_idx ON beds (status);

-- Patients and encounters ----------------------------------------------
CREATE TABLE patients (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mrn             TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    middle_name     TEXT,
    last_name       TEXT NOT NULL,
    dob             DATE,
    sex             TEXT CHECK (sex IN ('M','F','O','U')),
    email           TEXT,
    mobile_phone    TEXT,
    home_phone      TEXT,
    address1        TEXT,
    address2        TEXT,
    city            TEXT,
    state           TEXT,
    zip_code        TEXT,
    profile_picture TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    extra           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, mrn)
);
CREATE INDEX patients_tenant_idx ON patients (tenant_id);
CREATE INDEX patients_name_idx ON patients (lower(last_name), lower(first_name));

CREATE TABLE encounters (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    bed_id                  TEXT REFERENCES beds(id) ON DELETE SET NULL,
    status                  TEXT NOT NULL DEFAULT 'admitted'
                            CHECK (status IN ('admitted','discharge_initiated','discharged')),
    admission_type          TEXT NOT NULL DEFAULT 'elective' CHECK (admission_type IN ('emergency','elective','urgent')),
    source_of_admission     TEXT,
    attending_physician_id  TEXT,
    diagnosis               TEXT,
    admitted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    discharge_initiated_at  TIMESTAMPTZ,
    discharged_at           TIMESTAMPTZ,
    disposition             TEXT,
    discharge_summary       TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX encounters_patient_idx ON encounters (patient_id);
CREATE INDEX encounters_tenant_status_idx ON encounters (tenant_id, status);
-- One active encounter per patient and per bed.
CREATE UNIQUE INDEX encounters_active_patient_uq ON encounters (patient_id) WHERE status <> 'discharged';
CREATE UNIQUE INDEX encounters_active_bed_uq ON encounters (bed_id) WHERE status <> 'discharged' AND bed_id IS NOT NULL;

CREATE TABLE bed_transfers (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    from_bed_id     TEXT REFERENCES beds(id) ON DELETE SET NULL,
    to_bed_id       TEXT REFERENCES beds(id) ON DELETE SET NULL,
    transfer_type   TEXT,
    reason          TEXT,
    transferred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    transferred_by  TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX bed_transfers_encounter_idx ON bed_transfers (encounter_id);

-- Visitors / family -------------------------------------------------------
CREATE TABLE visitors (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    first_name    TEXT NOT NULL,
    check_in_at   TIMESTAMPTZ,
    check_out_at  TIMESTAMPTZ,
    restrictions  TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX visitors_patient_idx ON visitors (patient_id);

CREATE TABLE family_contacts (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL DEFAULT '',
    mobile_phone   TEXT,
    email_address  TEXT,
    relationship   TEXT,
    is_emergency_contact   BOOLEAN NOT NULL DEFAULT FALSE,
    is_authorized_for_info BOOLEAN NOT NULL DEFAULT TRUE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX family_contacts_patient_idx ON family_contacts (patient_id);

-- Clinical ---------------------------------------------------------------
CREATE TABLE health_metrics (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    metric_type      TEXT NOT NULL
                     CHECK (metric_type IN ('blood_pressure','heart_rate','temperature','oxygen_saturation','weight','height','respiratory_rate','glucose')),
    value_primary    NUMERIC NOT NULL,
    value_secondary  NUMERIC,
    unit             TEXT NOT NULL DEFAULT '',
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX health_metrics_patient_idx ON health_metrics (patient_id, metric_type, recorded_at DESC);

CREATE TABLE nanda_diagnoses (
    code        TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    definition  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE care_plans (
    id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id                TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id               TEXT NOT NULL,
    encounter_id             TEXT NOT NULL,
    diagnoses                JSONB NOT NULL DEFAULT '[]'::jsonb,
    interdisciplinary_notes  TEXT NOT NULL DEFAULT '',
    last_reviewed_by         TEXT NOT NULL DEFAULT '',
    last_reviewed_by_name    TEXT NOT NULL DEFAULT '',
    last_reviewed_at         TIMESTAMPTZ,
    version                  INTEGER NOT NULL DEFAULT 1,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, encounter_id)
);

CREATE TABLE io_records (
    id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id            TEXT NOT NULL,
    encounter_id          TEXT NOT NULL,
    record_type           TEXT NOT NULL CHECK (record_type IN ('Intake','Output')),
    intake_category       TEXT,
    fluid_type            TEXT,
    rate_per_hour         NUMERIC,
    bag_volume_remaining  NUMERIC,
    output_category       TEXT,
    color_consistency     TEXT,
    device                TEXT,
    volume_ml             NUMERIC NOT NULL CHECK (volume_ml >= 0),
    recorded_at           TIMESTAMPTZ NOT NULL,
    shift                 TEXT,
    notes                 TEXT,
    recorded_by           TEXT NOT NULL DEFAULT '',
    recorded_by_name      TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX io_records_encounter_idx ON io_records (tenant_id, encounter_id, recorded_at);

CREATE TABLE consents (
    consent_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT NOT NULL,
    encounter_id    TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Signed','Pending','Revoked','Expired')),
    signed_at       TIMESTAMPTZ,
    expiry_date     DATE,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,   -- remaining ConsentRecord fields
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX consents_encounter_idx ON consents (tenant_id, encounter_id);

CREATE TABLE patient_rights_requests (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL,
    request_type  TEXT NOT NULL,
    data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_rights_patient_idx ON patient_rights_requests (tenant_id, patient_id);

CREATE TABLE nursing_flowsheets (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL,
    encounter_id  TEXT NOT NULL,
    shift_date    DATE NOT NULL,
    shift_type    TEXT NOT NULL,
    chart_status  TEXT NOT NULL DEFAULT 'draft',
    version       INTEGER NOT NULL DEFAULT 1,
    data          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- clinical sections + signature fields
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, encounter_id, shift_date, shift_type)
);

CREATE TABLE nursing_flowsheet_versions (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flowsheet_id   TEXT NOT NULL REFERENCES nursing_flowsheets(id) ON DELETE CASCADE,
    version        INTEGER NOT NULL,
    status         TEXT NOT NULL,
    saved_by_name  TEXT NOT NULL DEFAULT '',
    summary        TEXT NOT NULL DEFAULT '',
    saved_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX flowsheet_versions_idx ON nursing_flowsheet_versions (flowsheet_id, saved_at DESC);

-- Medication management ---------------------------------------------------
CREATE TABLE medications (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id           TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    dose                 TEXT,
    route                TEXT,
    frequency            TEXT,
    next_scheduled_time  TIMESTAMPTZ,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX medications_patient_idx ON medications (patient_id);

CREATE TABLE mar_entries (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_id    TEXT NOT NULL,
    medication_name  TEXT NOT NULL,
    scheduled_time   TIMESTAMPTZ NOT NULL,
    given_time       TIMESTAMPTZ,
    given_by         TEXT,
    status           TEXT NOT NULL DEFAULT 'due',
    remarks          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mar_patient_idx ON mar_entries (patient_id, scheduled_time);

CREATE TABLE prn_stat_orders (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name  TEXT NOT NULL,
    order_type       TEXT NOT NULL CHECK (order_type IN ('PRN','STAT')),
    indication       TEXT NOT NULL,
    last_given_time  TIMESTAMPTZ,
    dose_interval    TEXT,
    max_dose         TEXT,
    ordered_time     TIMESTAMPTZ NOT NULL,
    urgency_level    TEXT,
    given_by         TEXT NOT NULL,
    doctor_approval  TEXT,
    remarks          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prn_stat_patient_idx ON prn_stat_orders (patient_id, created_at DESC);

CREATE TABLE prescriptions (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medicines        JSONB NOT NULL DEFAULT '[]'::jsonb,
    prescriber_name  TEXT,
    ordered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispensed_at     TIMESTAMPTZ
);
CREATE INDEX prescriptions_patient_idx ON prescriptions (patient_id);

CREATE TABLE dispenses (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prescription_id  TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicines        JSONB NOT NULL,
    dispensed_by     TEXT NOT NULL,
    total_cost       NUMERIC NOT NULL CHECK (total_cost >= 0),
    dispensed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discharge_medications (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        TEXT NOT NULL,
    encounter_id      TEXT,
    medications       JSONB NOT NULL DEFAULT '[]'::jsonb,
    prepared_by       TEXT,
    reviewed_by       TEXT,
    counselling_done  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX discharge_meds_encounter_uq ON discharge_medications (tenant_id, encounter_id) WHERE encounter_id IS NOT NULL;
CREATE UNIQUE INDEX discharge_meds_patient_uq ON discharge_medications (tenant_id, patient_id) WHERE encounter_id IS NULL;

-- Revenue cycle ------------------------------------------------------------
CREATE TABLE cdi_queries (
    query_id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id             TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id          TEXT NOT NULL,
    patient_id            TEXT NOT NULL,
    query_status          TEXT NOT NULL DEFAULT 'Open',
    sent_to_physician_id  TEXT,
    data                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cdi_tenant_idx ON cdi_queries (tenant_id, query_status);

CREATE TABLE claim_denials (
    denial_id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'New',
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX denials_tenant_idx ON claim_denials (tenant_id, status);

-- Infection control ---------------------------------------------------------
CREATE TABLE hai_events (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    encounter_id  TEXT NOT NULL,
    unit_id       TEXT,
    event_type    TEXT NOT NULL
                  CHECK (event_type IN ('infection_detected','isolation_started','severity_updated','status_changed','infection_resolved')),
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    data          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX hai_encounter_idx ON hai_events (tenant_id, encounter_id, occurred_at);
CREATE INDEX hai_unit_idx ON hai_events (tenant_id, unit_id);
