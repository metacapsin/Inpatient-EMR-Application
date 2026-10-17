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
};

export const isProd = config.env === 'production';
