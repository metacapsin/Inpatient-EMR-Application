-- Authentication / session hardening (#SEC-07): lockout, immediate revocation, opt-in TOTP MFA.
ALTER TABLE users
    ADD COLUMN failed_login_count INT NOT NULL DEFAULT 0,
    ADD COLUMN locked_until       TIMESTAMPTZ,
    -- Bumped whenever a currently-issued access token must stop working before its own expiry
    -- (deactivation, role change, "sign out of all devices"). Embedded in the access token as `tv`
    -- and checked on every request in requireAuth; a mismatch rejects the token immediately instead
    -- of waiting up to ACCESS_TOKEN_TTL. Existing tokens predating this column have no `tv` claim,
    -- which requireAuth treats as 0 (this column's default), so deploying this does not force
    -- today's sessions to re-login.
    ADD COLUMN token_version      INT NOT NULL DEFAULT 0,
    ADD COLUMN mfa_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN mfa_secret         TEXT,
    -- SHA-256 hashes of unused single-use backup codes; consumed by removing the matching entry.
    ADD COLUMN mfa_backup_codes   JSONB NOT NULL DEFAULT '[]'::jsonb;
