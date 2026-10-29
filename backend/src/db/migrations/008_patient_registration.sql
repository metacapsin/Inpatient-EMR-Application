-- Patient registration redesign: full demographics on `patients`, plus fixed primary/secondary
-- insurance and emergency-contact rows (UNIQUE (patient_id, rank) mirrors the two-block UI).

ALTER TABLE patients
    ADD COLUMN prefix TEXT,
    ADD COLUMN suffix TEXT,
    ADD COLUMN marital_status TEXT,
    ADD COLUMN preferred_language TEXT,
    ADD COLUMN ethnicity TEXT,
    ADD COLUMN race TEXT,
    ADD COLUMN country_of_birth TEXT,
    ADD COLUMN work_phone TEXT,
    ADD COLUMN work_email TEXT,
    ADD COLUMN other_phone TEXT,
    ADD COLUMN advance_directive_status TEXT,
    ADD COLUMN notice_of_privacy_practices_date DATE,
    ADD COLUMN pregnant BOOLEAN,
    ADD COLUMN breastfeeding BOOLEAN,
    ADD COLUMN mailing_address1 TEXT,
    ADD COLUMN mailing_address2 TEXT,
    ADD COLUMN mailing_city TEXT,
    ADD COLUMN mailing_state TEXT,
    ADD COLUMN mailing_zip_code TEXT;

CREATE TABLE patient_insurance (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    rank                    TEXT NOT NULL CHECK (rank IN ('primary','secondary')),
    insurance_type          TEXT,
    company_name            TEXT,
    member_id               TEXT,
    plan_type               TEXT,
    group_number            TEXT,
    company_phone           TEXT,
    effective_date          DATE,
    termination_date        DATE,
    status                  TEXT CHECK (status IN ('active','inactive')),
    copay_amount            NUMERIC(8,2),
    medical_group           TEXT,
    pcp_name                TEXT,
    guarantor_relationship  TEXT,
    guarantor_name          TEXT,
    guarantor_address       TEXT,
    guarantor_dob           DATE,
    guarantor_member_id     TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, rank)
);
CREATE INDEX patient_insurance_tenant_idx ON patient_insurance (tenant_id);

CREATE TABLE patient_emergency_contacts (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    rank         TEXT NOT NULL CHECK (rank IN ('primary','secondary')),
    relationship TEXT,
    name         TEXT,
    phone        TEXT,
    address1     TEXT,
    city         TEXT,
    state        TEXT,
    zip_code     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, rank)
);
CREATE INDEX patient_emergency_contacts_tenant_idx ON patient_emergency_contacts (tenant_id);
