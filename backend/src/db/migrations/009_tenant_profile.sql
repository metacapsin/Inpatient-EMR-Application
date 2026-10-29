-- Practice Information: tenant self-service profile (org contact details + regulatory
-- identifiers). A separate 1:1 table, not new columns on `tenants` — keeps platform-lifecycle
-- data (status/plan/stripe, 004/005) architecturally distinct from self-service tenant data.
-- Row may not exist yet for a tenant that signed up before this feature (GET/PUT upsert accordingly).
CREATE TABLE tenant_profile (
    tenant_id      TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    address1       TEXT,
    address2       TEXT,
    city           TEXT,
    state          TEXT,
    zip            TEXT,
    phone          TEXT,
    fax            TEXT,
    practice_type  TEXT,
    npi            TEXT,
    ein            TEXT,
    logo_url       TEXT,
    timezone       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
