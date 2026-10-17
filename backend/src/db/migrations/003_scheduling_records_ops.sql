-- Appointments/calendar, patient record lists, lab orders, staffing & scheduling, radiology, code events.

-- ============================================================ appointments / calendar
CREATE TABLE service_locations (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    address     TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE visit_types (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visit_reason_name  TEXT NOT NULL,
    duration           INTEGER NOT NULL DEFAULT 30 CHECK (duration BETWEEN 5 AND 480),
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, visit_reason_name)
);

-- One row per tenant; weekly hours of a provider at a location live in provider_calendar_settings.
CREATE TABLE calendar_general_settings (
    tenant_id   TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provider_calendar_settings (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_location_id  TEXT NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
    -- { monday: { start: "09:00", end: "17:00" }, ... }; a missing day means not working.
    weekly_hours         JSONB NOT NULL DEFAULT '{}'::jsonb,
    slot_minutes         INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
    UNIQUE (provider_id, service_location_id)
);

CREATE TABLE appointments (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id            TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id           TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id          TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_location_id  TEXT REFERENCES service_locations(id) ON DELETE SET NULL,
    visit_type_id        TEXT REFERENCES visit_types(id) ON DELETE SET NULL,
    start_date           DATE NOT NULL,
    start_time           TIME NOT NULL,
    duration             INTEGER NOT NULL DEFAULT 30 CHECK (duration BETWEEN 5 AND 480),
    status               TEXT NOT NULL DEFAULT 'Scheduled'
                         CHECK (status IN ('Scheduled','Confirmed','Checked In','In Progress','Completed','Cancelled','No Show')),
    visit_mode           TEXT NOT NULL DEFAULT 'Office Visit',
    visit_reason_msg     TEXT,
    room_number          TEXT,
    note                 TEXT,
    created_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appointments_tenant_date_idx ON appointments (tenant_id, start_date);
CREATE INDEX appointments_provider_date_idx ON appointments (provider_id, start_date);
CREATE INDEX appointments_patient_idx ON appointments (patient_id);

-- ============================================================ patient record lists
CREATE TABLE patient_documents (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    document_type  TEXT,
    notes          TEXT,
    mime_type      TEXT NOT NULL DEFAULT 'application/octet-stream',
    content        BYTEA,
    document_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_documents_patient_idx ON patient_documents (patient_id);

CREATE TABLE patient_allergies (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen      TEXT NOT NULL,
    allergy_type  TEXT NOT NULL DEFAULT 'Drug',
    reaction      TEXT,
    severity      TEXT,
    onset_date    DATE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_allergies_patient_idx ON patient_allergies (patient_id);

CREATE TABLE patient_immunizations (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    vaccine_name      TEXT NOT NULL,
    vaccine_type      TEXT,
    dose              TEXT,
    unit              TEXT,
    route             TEXT,
    number_in_series  INTEGER,
    consent_obtained  JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments          TEXT,
    ordered_date      DATE,
    ordered_time      TEXT,
    provider          TEXT,
    service_location  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_immunizations_patient_idx ON patient_immunizations (patient_id);

CREATE TABLE history_categories (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    UNIQUE (tenant_id, name)
);

CREATE TABLE patient_history (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    category_id      TEXT REFERENCES history_categories(id) ON DELETE SET NULL,
    conditions       TEXT NOT NULL,
    diagnosis_date   DATE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_history_patient_idx ON patient_history (patient_id);

CREATE TABLE lab_orders (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id            TEXT REFERENCES encounters(id) ON DELETE SET NULL,
    lab_tests               JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    order_status            TEXT NOT NULL DEFAULT 'Ordered'
                            CHECK (order_status IN ('Ordered','Collected','In Progress','Resulted','Cancelled')),
    priority                TEXT NOT NULL DEFAULT 'Routine' CHECK (priority IN ('Routine','Urgent','STAT')),
    ordering_provider_name  TEXT,
    office_notes            TEXT,
    patient_contact_notes   TEXT,
    created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lab_orders_patient_idx ON lab_orders (patient_id, order_date DESC);

CREATE TABLE lab_documents (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    lab_name    TEXT,
    value       TEXT,
    unit        TEXT,
    reference_range TEXT,
    notes       TEXT,
    lab_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lab_documents_patient_idx ON lab_documents (patient_id, lab_date DESC);

-- ============================================================ staffing & staff scheduling
ALTER TABLE wards ADD COLUMN care_model TEXT NOT NULL DEFAULT 'Med-Surg'
    CHECK (care_model IN ('ICU','Step-Down','Med-Surg','L&D'));

-- Extra clinical attributes for a user (certifications, float pool, home unit).
CREATE TABLE staff_profiles (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    clinical_role   TEXT NOT NULL DEFAULT 'RN' CHECK (clinical_role IN ('RN','LVN','CNA')),
    credentials     TEXT,
    certifications  JSONB NOT NULL DEFAULT '[]'::jsonb,
    badges          JSONB NOT NULL DEFAULT '[]'::jsonb,
    home_ward_id    TEXT REFERENCES wards(id) ON DELETE SET NULL,
    is_float_pool   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE staff_shifts (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
    ward_id        TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    shift_type_id  TEXT NOT NULL CHECK (shift_type_id IN ('st-day','st-evening','st-night')),
    start_at       TIMESTAMPTZ NOT NULL,
    end_at         TIMESTAMPTZ NOT NULL,
    status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','open','cancelled')),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at)
);
CREATE INDEX staff_shifts_tenant_start_idx ON staff_shifts (tenant_id, start_at);
CREATE INDEX staff_shifts_staff_idx ON staff_shifts (staff_id);

CREATE TABLE staff_coverage_rules (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ward_id        TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    shift_type_id  TEXT NOT NULL CHECK (shift_type_id IN ('st-day','st-evening','st-night')),
    min_staff      INTEGER NOT NULL CHECK (min_staff >= 0),
    role           TEXT NOT NULL DEFAULT 'clinical-staff',
    UNIQUE (ward_id, shift_type_id, role)
);

CREATE TABLE staffing_assignments (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ward_id          TEXT NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    assignment_date  DATE NOT NULL,
    shift            TEXT NOT NULL CHECK (shift IN ('day','evening','night')),
    charge_nurse_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ward_id, assignment_date, shift)
);

CREATE TABLE staffing_nurse_assignments (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id   TEXT NOT NULL REFERENCES staffing_assignments(id) ON DELETE CASCADE,
    nurse_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_bed_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    hours_worked    NUMERIC NOT NULL DEFAULT 0,
    UNIQUE (assignment_id, nurse_id)
);

-- ============================================================ radiology
CREATE TABLE radiology_orders (
    id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id                  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id                 TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id               TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    modality                   TEXT NOT NULL,
    body_region                TEXT NOT NULL,
    laterality                 TEXT,
    contrast                   TEXT,
    clinical_indication        TEXT NOT NULL,
    icd10_codes                JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority                   TEXT NOT NULL DEFAULT 'Routine' CHECK (priority IN ('Routine','Urgent','STAT')),
    special_instructions       TEXT,
    transport_required         BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_for              TIMESTAMPTZ,
    ordered_by                 TEXT,
    ordered_by_name            TEXT,
    ordered_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    status                     TEXT NOT NULL DEFAULT 'Ordered'
                               CHECK (status IN ('Ordered','Scheduled','Patient Arrived','In Progress','Preliminary','Final','Amended','Cancelled')),
    acknowledged_by            TEXT,
    acknowledged_at            TIMESTAMPTZ,
    performed_at               TIMESTAMPTZ,
    radiologist_name           TEXT,
    radiologist_id             TEXT,
    impression                 TEXT,
    findings                   TEXT,
    critical_value             BOOLEAN NOT NULL DEFAULT FALSE,
    critical_value_notified_at TIMESTAMPTZ,
    critical_value_notified_to TEXT,
    dicom_study_uid            TEXT,
    dicom_viewer_url           TEXT,
    resulted_at                TIMESTAMPTZ,
    amendment_reason           TEXT
);
CREATE INDEX radiology_orders_encounter_idx ON radiology_orders (encounter_id, ordered_at DESC);
CREATE INDEX radiology_orders_tenant_idx ON radiology_orders (tenant_id);

-- ============================================================ code events
CREATE TABLE code_events (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id            TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    unit_id                 TEXT,
    event_type              TEXT NOT NULL
                            CHECK (event_type IN ('Code Blue','Rapid Response','Code Stroke','Code STEMI','Code Sepsis','Code OB')),
    location                TEXT NOT NULL,
    called_by               TEXT NOT NULL,
    called_by_name          TEXT NOT NULL DEFAULT '',
    called_at               TIMESTAMPTZ NOT NULL,
    team_lead_id            TEXT NOT NULL DEFAULT '',
    team_lead_name          TEXT NOT NULL DEFAULT '',
    team_members            JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline                JSONB NOT NULL DEFAULT '[]'::jsonb,
    announce_to_unit        BOOLEAN NOT NULL DEFAULT FALSE,
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
    end_time                TIMESTAMPTZ,
    outcome                 TEXT,
    post_event_disposition  TEXT,
    debrief_notes           TEXT,
    total_duration_minutes  INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX code_events_tenant_status_idx ON code_events (tenant_id, status);
CREATE INDEX code_events_patient_idx ON code_events (patient_id, called_at DESC);
-- At most one active code per patient.
CREATE UNIQUE INDEX code_events_active_patient_uq ON code_events (patient_id) WHERE status = 'active';
