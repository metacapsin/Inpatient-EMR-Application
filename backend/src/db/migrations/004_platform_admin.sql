-- Platform Admin foundation: a Super Admin credential space that is NOT a tenant-scoped user,
-- plus the tenant lifecycle columns Tenant Onboarding needs (status/plan/Stripe/modules/onboarding).

CREATE TABLE platform_admins (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email           TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_uq ON platform_admins (lower(email));

ALTER TABLE tenants
    ADD COLUMN status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended')),
    ADD COLUMN plan TEXT,
    ADD COLUMN stripe_subscription_id TEXT,
    ADD COLUMN enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'provisioned' CHECK (onboarding_status IN ('provisioned', 'in_progress', 'complete'));
