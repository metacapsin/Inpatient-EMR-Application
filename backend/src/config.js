import 'dotenv/config';

function required(name) {
    const v = process.env[name];
    if (!v || !v.trim()) {
        throw new Error(`Missing required environment variable ${name}. Copy backend/.env.example to backend/.env.`);
    }
    return v.trim();
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 4000),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Used to build links inside outbound emails (invites, password resets).
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
    // Optional: no SMTP_HOST means no mail transport, and sendEmail() falls back to logging (see lib/email.js).
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'no-reply@example.com',
    },
};

// Separate from `jwtSecret` so a leaked tenant-scoped token can never be replayed as a platform
// token (and vice versa). Falls back to a value derived from JWT_SECRET so existing .env files
// don't break; set PLATFORM_JWT_SECRET explicitly in production.
config.platformJwtSecret = process.env.PLATFORM_JWT_SECRET || `${config.jwtSecret}:platform`;
config.platformAccessTokenTtl = process.env.PLATFORM_ACCESS_TOKEN_TTL || '30m';

// Stedi healthcare APIs (payer directory + 270/271 eligibility). No key = integration disabled and
// every check reports status 'skipped'. Tests never talk to Stedi unless STEDI_TEST_LIVE=1.
config.stedi = {
    apiKey: process.env.STEDI_API_KEY || '',
    enabled:
        Boolean(process.env.STEDI_API_KEY) &&
        process.env.STEDI_ENABLED !== 'false' &&
        (process.env.NODE_ENV !== 'test' || process.env.STEDI_TEST_LIVE === '1'),
    healthcareBaseUrl: (process.env.STEDI_BASE_URL || 'https://healthcare.us.stedi.com/2024-04-01').replace(/\/$/, ''),
    payersBaseUrl: (process.env.STEDI_PAYERS_BASE_URL || 'https://payers.us.stedi.com/2024-04-01').replace(/\/$/, ''),
    timeoutMs: Number(process.env.STEDI_TIMEOUT_MS || 30000),
};

export const isProd = config.env === 'production';
