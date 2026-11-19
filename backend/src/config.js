import 'dotenv/config';
import crypto from 'node:crypto';

/** @param {string} name */
function required(name) {
    const v = process.env[name];
    if (!v || !v.trim()) {
        throw new Error(`Missing required environment variable ${name}. Copy backend/.env.example to backend/.env.`);
    }
    return v.trim();
}

const jwtSecret = required('JWT_SECRET');
const envIsProd = (process.env.NODE_ENV || 'development') === 'production';

/**
 * @param {string} name
 * @param {string} fallback
 */
function requiredInProd(name, fallback) {
    if (envIsProd) return required(name);
    return (process.env[name] || '').trim() || fallback;
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4000),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    databaseUrl: required('DATABASE_URL'),
    // SEC-12: TLS to Postgres. Required in production (DATABASE_SSL=disable is the explicit, logged
    // opt-out for a provider that truly doesn't support it); off by default outside production since
    // local/CI Postgres isn't TLS-configured. DATABASE_SSL_REJECT_UNAUTHORIZED=false is the escape
    // hatch some managed providers need for a cert chain Node doesn't trust by default.
    databaseSsl: (() => {
        const mode = (process.env.DATABASE_SSL || (envIsProd ? 'require' : 'disable')).toLowerCase();
        if (mode === 'disable') return false;
        return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
    })(),
    jwtSecret,
    jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
    // Public self-service tenant signup (POST /auth/register). Off by default: tenants are provisioned
    // by a platform admin. Forced on under NODE_ENV=test because the suite creates throwaway tenants.
    allowSelfServiceRegistration:
        process.env.ALLOW_SELF_SERVICE_REGISTRATION === 'true' || (process.env.NODE_ENV || 'development') === 'test',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Server-side AI (Gemini). No key = every /api/ai route answers 503 AI_DISABLED. See lib/gemini.js.
    ai: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 20000),
    },
    // Used to build links inside outbound emails (invites, password resets).
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
    // This server's own public base URL — used to build absolute SMART discovery endpoints and as the
    // expected `aud` for /oauth/authorize (SEC-15). Required in production since an auto-detected value
    // would be guessable/spoofable from request headers; a localhost default is fine in dev.
    backendUrl: requiredInProd('BACKEND_URL', `http://localhost:${Number(process.env.PORT || 4000)}`).replace(/\/$/, ''),
    // Optional: no SMTP_HOST means no mail transport, and sendEmail() falls back to logging (see lib/email.js).
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'no-reply@example.com',
    },
    // Separate from `jwtSecret` so a leaked tenant-scoped token can never be replayed as a platform
    // token (and vice versa). Outside production this falls back to a value derived from JWT_SECRET
    // so existing .env files don't break; in production it must be set explicitly (SEC-13) — a
    // derived secret is only as strong as JWT_SECRET's own exposure surface, so two tokens that are
    // meant to be unforgeable from each other shouldn't share a derivation.
    platformJwtSecret: requiredInProd('PLATFORM_JWT_SECRET', `${jwtSecret}:platform`),
    platformAccessTokenTtl: process.env.PLATFORM_ACCESS_TOKEN_TTL || '30m',
    // SMART App Launch / patient-portal tokens — separate from staff `jwtSecret`. Same rule as above.
    smartJwtSecret: requiredInProd('SMART_JWT_SECRET', `${jwtSecret}:smart`),
    smartAccessTokenTtl: process.env.SMART_ACCESS_TOKEN_TTL || '15m',
    // Static default for allowDevTokens — see devTokensAllowed() below, which callers should use
    // instead so an env override set after the process starts (e.g. by a test) still takes effect.
    allowDevTokens: process.env.ALLOW_DEV_TOKENS === 'true' || (process.env.NODE_ENV || 'development') === 'test',
    // SEC-12: AES-256-GCM key for secret fields this app stores and later needs back in plaintext
    // (lib/crypto.js) — currently just notification_recipients.auth_header_secret. Required in
    // production; outside it, derives deterministically from JWT_SECRET (same rationale/pattern as
    // platformJwtSecret/smartJwtSecret) so dev doesn't need a new env var and the derived key stays
    // stable across restarts.
    encryptionKey: requiredInProd('ENCRYPTION_KEY', crypto.createHash('sha256').update(`${jwtSecret}:encryption`).digest('hex')),
    // SEC-12: MLLP is a raw, unencrypted TCP socket (`mllp://`) carrying HL7 PHI; `mllps://` (TLS) is
    // the encrypted alternative. Plaintext stays available — real hospital interface engines mostly
    // run it over a dedicated VPN/private link this app can't verify — but is opt-in, not default.
    allowPlaintextMllp: process.env.ALLOW_PLAINTEXT_MLLP === 'true',
    // SAF-06: minutes an unacknowledged critical result can sit before the escalation job notifies
    // the ward's charge nurse. Clinical-policy default — adjust per the hospital's actual policy.
    criticalResultEscalationMinutes: Number(process.env.CRITICAL_RESULT_ESCALATION_MINUTES || 30),
    // Stedi healthcare APIs (payer directory + 270/271 eligibility). No key = integration disabled and
    // every check reports status 'skipped'. Tests never talk to Stedi unless STEDI_TEST_LIVE=1.
    stedi: {
        apiKey: process.env.STEDI_API_KEY || '',
        enabled:
            Boolean(process.env.STEDI_API_KEY) &&
            process.env.STEDI_ENABLED !== 'false' &&
            (process.env.NODE_ENV !== 'test' || process.env.STEDI_TEST_LIVE === '1'),
        healthcareBaseUrl: (process.env.STEDI_BASE_URL || 'https://healthcare.us.stedi.com/2024-04-01').replace(/\/$/, ''),
        payersBaseUrl: (process.env.STEDI_PAYERS_BASE_URL || 'https://payers.us.stedi.com/2024-04-01').replace(/\/$/, ''),
        timeoutMs: Number(process.env.STEDI_TIMEOUT_MS || 30000),
    },
};

export const isProd = config.env === 'production';

/**
 * Dev-convenience tokens (invite links, reset tokens) returned in API responses or printed to the
 * console instead of only emailed. Off unless explicitly turned on — SEC-20: inferring this from
 * NODE_ENV meant any non-production deployment that forgot to set it leaked these. A function
 * (like registrationEnabled() in routes/auth.js) rather than a static config value so an explicit
 * `ALLOW_DEV_TOKENS=false`/`=true` set at runtime (e.g. by a test) is honored immediately.
 */
export function devTokensAllowed() {
    if (process.env.ALLOW_DEV_TOKENS === 'true') return true;
    if (process.env.ALLOW_DEV_TOKENS === 'false') return false;
    return config.allowDevTokens;
}

/** Same re-check-every-call rationale as devTokensAllowed() — see config.allowPlaintextMllp. */
export function plaintextMllpAllowed() {
    if (process.env.ALLOW_PLAINTEXT_MLLP === 'true') return true;
    if (process.env.ALLOW_PLAINTEXT_MLLP === 'false') return false;
    return config.allowPlaintextMllp;
}
