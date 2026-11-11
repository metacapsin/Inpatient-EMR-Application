-- Module #64 — Patient Access API (FHIR R4 + SMART App Launch 2.0).
-- Patient portal credentials are a separate space from staff `users`.

CREATE TABLE patient_accounts (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    password_hash       TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    invite_token_hash   TEXT,
    invite_expires_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id),
    UNIQUE (tenant_id, email)
);
CREATE INDEX patient_accounts_tenant_idx ON patient_accounts (tenant_id);
CREATE INDEX patient_accounts_email_idx ON patient_accounts (tenant_id, lower(email));

CREATE TABLE smart_clients (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id           TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    redirect_uris       JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_scopes      JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_confidential     BOOLEAN NOT NULL DEFAULT FALSE,
    client_secret_hash  TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX smart_clients_tenant_idx ON smart_clients (tenant_id);

CREATE TABLE smart_authorizations (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id               TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id               TEXT NOT NULL REFERENCES smart_clients(client_id) ON DELETE CASCADE,
    patient_account_id      TEXT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
    scopes                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    code_hash               TEXT,
    code_challenge          TEXT,
    code_challenge_method   TEXT CHECK (code_challenge_method IS NULL OR code_challenge_method = 'S256'),
    code_expires_at         TIMESTAMPTZ,
    code_used_at            TIMESTAMPTZ,
    refresh_token_hash      TEXT,
    refresh_expires_at      TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX smart_authorizations_code_idx ON smart_authorizations (code_hash) WHERE code_hash IS NOT NULL;
CREATE INDEX smart_authorizations_refresh_idx ON smart_authorizations (refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX smart_authorizations_account_idx ON smart_authorizations (patient_account_id);

CREATE TABLE fhir_access_log (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      TEXT,
    client_id       TEXT,
    resource_type   TEXT,
    resource_id     TEXT,
    query           TEXT,
    status          INTEGER NOT NULL,
    at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fhir_access_log_tenant_idx ON fhir_access_log (tenant_id, at DESC);
CREATE INDEX fhir_access_log_patient_idx ON fhir_access_log (patient_id, at DESC);
