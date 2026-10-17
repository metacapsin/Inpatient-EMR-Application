import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, isProd } from '../config.js';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, forbidden, h, notFound, ok, parse, created } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const publicAuthRouter = Router();
export const authRouter = Router();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const ROLES = ['admin', 'physician', 'nurse', 'pharmacist', 'billing', 'staff'];
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

function ttlMs(ttl) {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 7 * 864e5;
    return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
}

function publicUser(u, tenant) {
    return {
        id: u.id,
        _id: u.id,
        email: u.email,
        username: u.username || u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        role: u.role,
        preferences: u.preferences || {},
        tenant: { id: u.tenant_id, name: tenant?.name ?? u.tenant_name ?? '' },
        tenantId: u.tenant_id,
    };
}

function signAccess(u) {
    return jwt.sign(
        {
            typ: 'access',
            tid: u.tenant_id,
            role: u.role,
            name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
            email: u.email,
        },
        config.jwtSecret,
        { subject: u.id, expiresIn: config.accessTokenTtl },
    );
}

async function issueTokens(db, u) {
    const refresh = crypto.randomBytes(48).toString('hex');
    await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [
        u.id,
        sha256(refresh),
        new Date(Date.now() + ttlMs(config.refreshTokenTtl)),
    ]);
    return { token: signAccess(u), refreshToken: refresh };
}

const loadUser = async (where, params) =>
    (
        await query(
            `SELECT u.*, t.name AS tenant_name FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE ${where}`,
            params,
        )
    ).rows[0];

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many attempts, try again later' },
});

// ---------------------------------------------------------------- public
publicAuthRouter.post(
    '/login',
    authLimiter,
    h(async (req, res) => {
        const { username, password: pw } = parse(
            z.object({ username: z.string().trim().min(1), password: z.string().min(1) }),
            req.body,
        );
        const u = await loadUser('lower(u.email) = lower($1) OR lower(u.username) = lower($1)', [username]);
        const valid = await bcrypt.compare(pw, u?.password_hash ?? DUMMY_HASH);
        if (!u || !valid || !u.is_active) throw new ApiError(401, 'Invalid username or password');
        const tokens = await issueTokens({ query }, u);
        res.json({ status: 'success', ...tokens, role: u.role, user: publicUser(u) });
    }),
);

publicAuthRouter.post(
    '/auth/refresh',
    authLimiter,
    h(async (req, res) => {
        const { refreshToken } = parse(z.object({ refreshToken: z.string().min(1) }), req.body);
        const result = await withTx(async (db) => {
            const t = (
                await db.query(
                    `SELECT rt.id AS rt_id, u.* FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
                     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() AND u.is_active
                     FOR UPDATE OF rt`,
                    [sha256(refreshToken)],
                )
            ).rows[0];
            if (!t) return null;
            await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [t.rt_id]);
            return issueTokens(db, t);
        });
        if (!result) throw new ApiError(401, 'Invalid or expired refresh token');
        res.json({ status: 'success', ...result });
    }),
);

publicAuthRouter.post(
    '/forgotPassword',
    authLimiter,
    h(async (req, res) => {
        const { email } = parse(z.object({ email: z.string().trim().email() }), req.body);
        const u = await loadUser('lower(u.email) = lower($1) AND u.is_active', [email]);
        if (u) {
            const raw = crypto.randomBytes(32).toString('hex');
            await query(
                `UPDATE users SET reset_token_hash = $1, reset_expires_at = now() + interval '1 hour' WHERE id = $2`,
                [sha256(raw), u.id],
            );
            // No mail transport is configured. In development the reset link is printed to the server log;
            // in production wire this up to an email service instead of logging.
            if (!isProd) console.log(`[forgotPassword] reset token for ${u.email}: ${raw}`);
        }
        // Same response whether or not the account exists (no user enumeration).
        res.json({ status: 'success', message: 'If that email is registered, a reset link has been sent.' });
    }),
);

publicAuthRouter.post(
    '/auth/reset-password',
    authLimiter,
    h(async (req, res) => {
        const body = parse(
            z.object({ token: z.string().min(1), newPassword: password, confirmPassword: z.string() }),
            req.body,
        );
        if (body.newPassword !== body.confirmPassword) throw new ApiError(400, 'Passwords do not match');
        const r = await query(
            `UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_expires_at = NULL, updated_at = now()
             WHERE reset_token_hash = $2 AND reset_expires_at > now() RETURNING id`,
            [await bcrypt.hash(body.newPassword, 10), sha256(body.token)],
        );
        if (!r.rowCount) throw new ApiError(400, 'Reset link is invalid or has expired');
        await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [r.rows[0].id]);
        res.json({ status: 'success', message: 'Password updated' });
    }),
);

// Self-service signup: creates a new tenant and its first admin user.
publicAuthRouter.post(
    '/auth/register',
    authLimiter,
    h(async (req, res) => {
        const b = parse(
            z.object({
                username: z.string().trim().min(2).max(100),
                email: z.string().trim().email(),
                password,
                organization: z.string().trim().max(200).optional(),
            }),
            req.body,
        );
        const exists = await query('SELECT 1 FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($2)', [b.email, b.username]);
        if (exists.rowCount) throw conflict('An account with this email or username already exists');
        const u = await withTx(async (db) => {
            const t = (await db.query('INSERT INTO tenants(name) VALUES ($1) RETURNING id', [b.organization || `${b.username}'s organization`])).rows[0];
            return (
                await db.query(
                    `INSERT INTO users (tenant_id, email, username, password_hash, first_name, role)
                     VALUES ($1,$2,$3,$4,$5,'admin') RETURNING *`,
                    [t.id, b.email, b.username, await bcrypt.hash(b.password, 10), b.username],
                )
            ).rows[0];
        });
        const full = await loadUser('u.id = $1', [u.id]);
        const tokens = await issueTokens({ query }, full);
        res.status(201).json({ status: 'success', ...tokens, role: full.role, user: publicUser(full) });
    }),
);

// ---------------------------------------------------------- authenticated
authRouter.use(requireAuth);

authRouter.post(
    '/auth/logout',
    h(async (req, res) => {
        const { refreshToken } = req.body || {};
        if (typeof refreshToken === 'string') {
            await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND user_id = $2', [sha256(refreshToken), req.user.id]);
        }
        res.json({ status: 'success' });
    }),
);

authRouter.get(
    '/auth/profile',
    h(async (req, res) => {
        const u = await loadUser('u.id = $1', [req.user.id]);
        if (!u) throw notFound('User not found');
        ok(res, publicUser(u));
    }),
);

authRouter.put(
    '/auth/profile',
    h(async (req, res) => {
        const b = parse(
            z.object({
                firstName: z.string().trim().max(100).optional(),
                lastName: z.string().trim().max(100).optional(),
                preferences: z.record(z.string(), z.unknown()).optional(),
            }),
            req.body,
        );
        await query(
            `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
                    preferences = COALESCE($3::jsonb, preferences), updated_at = now() WHERE id = $4`,
            [b.firstName ?? null, b.lastName ?? null, b.preferences ? JSON.stringify(b.preferences) : null, req.user.id],
        );
        ok(res, publicUser(await loadUser('u.id = $1', [req.user.id])));
    }),
);

authRouter.get(
    '/tenants/current',
    h(async (req, res) => {
        const t = (await query('SELECT id, name, created_at FROM tenants WHERE id = $1', [req.user.tenantId])).rows[0];
        if (!t) throw notFound('Tenant not found');
        ok(res, { id: t.id, _id: t.id, name: t.name, createdAt: t.created_at });
    }),
);

authRouter.put(
    '/tenants/current',
    requireRole(),
    h(async (req, res) => {
        const { name } = parse(z.object({ name: z.string().trim().min(1).max(200) }), req.body);
        const t = (await query('UPDATE tenants SET name = $1 WHERE id = $2 RETURNING id, name', [name, req.user.tenantId])).rows[0];
        ok(res, { id: t.id, _id: t.id, name: t.name });
    }),
);

// --- user administration (admin only; always scoped to the caller's tenant)
const listUsers = h(async (req, res) => {
    const r = await query(
        `SELECT u.*, t.name AS tenant_name FROM users u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.tenant_id = $1 ORDER BY u.created_at`,
        [req.user.tenantId],
    );
    ok(res, r.rows.map((u) => publicUser(u)));
});
authRouter.get('/tenants/users', requireRole(), listUsers);
authRouter.get('/subscription/users', requireRole(), listUsers);

const userBody = z.object({
    email: z.string().trim().email(),
    username: z.string().trim().min(2).max(100).optional(),
    password,
    firstName: z.string().trim().max(100).default(''),
    lastName: z.string().trim().max(100).default(''),
    role: z.enum(ROLES).default('nurse'),
});

authRouter.post(
    '/auth/register-user',
    requireRole(),
    h(async (req, res) => {
        const b = parse(userBody, req.body);
        const dup = await query('SELECT 1 FROM users WHERE lower(email)=lower($1) OR ($2::text IS NOT NULL AND lower(username)=lower($2))', [b.email, b.username ?? null]);
        if (dup.rowCount) throw conflict('An account with this email or username already exists');
        const u = (
            await query(
                `INSERT INTO users (tenant_id,email,username,password_hash,first_name,last_name,role)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [req.user.tenantId, b.email, b.username ?? null, await bcrypt.hash(b.password, 10), b.firstName, b.lastName, b.role],
            )
        ).rows[0];
        created(res, publicUser(u));
    }),
);

const updateUser = h(async (req, res) => {
    const b = parse(
        userBody.partial().extend({ isActive: z.boolean().optional() }),
        req.body,
    );
    const hash = b.password ? await bcrypt.hash(b.password, 10) : null;
    const r = await query(
        `UPDATE users SET email = COALESCE($1,email), username = COALESCE($2,username), password_hash = COALESCE($3,password_hash),
                first_name = COALESCE($4,first_name), last_name = COALESCE($5,last_name), role = COALESCE($6,role),
                is_active = COALESCE($7,is_active), updated_at = now()
         WHERE id = $8 AND tenant_id = $9 RETURNING *`,
        [b.email ?? null, b.username ?? null, hash, b.firstName ?? null, b.lastName ?? null, b.role ?? null, b.isActive ?? null, req.params.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('User not found');
    ok(res, publicUser(r.rows[0]));
});
authRouter.put('/auth/users/:id', requireRole(), updateUser);
authRouter.put('/tenant/users/:id', requireRole(), updateUser);

authRouter.delete(
    '/auth/users/:id',
    requireRole(),
    h(async (req, res) => {
        if (req.params.id === req.user.id) throw forbidden('You cannot delete your own account');
        const r = await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
        if (!r.rowCount) throw notFound('User not found');
        res.json({ status: 'success' });
    }),
);
