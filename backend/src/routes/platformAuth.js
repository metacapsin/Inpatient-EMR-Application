import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, isProd } from '../config.js';
import { query } from '../db/pool.js';
import { ApiError, h, ok, parse } from '../lib/http.js';

export const publicPlatformAuthRouter = Router();

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many attempts, try again later' },
});

function signPlatformAccess(admin) {
    return jwt.sign({ typ: 'platform', email: admin.email }, config.platformJwtSecret, {
        subject: admin.id,
        expiresIn: config.platformAccessTokenTtl,
    });
}

// POST /api/platform/login
publicPlatformAuthRouter.post(
    '/api/platform/login',
    loginLimiter,
    h(async (req, res) => {
        const { email, password } = parse(z.object({ email: z.string().trim().email(), password: z.string().min(1) }), req.body);
        const admin = (await query('SELECT * FROM platform_admins WHERE lower(email) = lower($1)', [email])).rows[0];
        const valid = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH);
        if (!admin || !valid || !admin.is_active) throw new ApiError(401, 'Invalid email or password');
        ok(res, { token: signPlatformAccess(admin), admin: { id: admin.id, email: admin.email } });
    }),
);
