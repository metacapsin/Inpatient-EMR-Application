import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, isProd, devTokensAllowed } from '../config.js';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, forbidden, h, notFound, ok, parse, created } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isValidNpi } from '../lib/npi.js';
import { recordAuditEvent } from '../lib/audit.js';
import { sendEmail } from '../lib/email.js';
import { checkPasswordPolicy } from '../lib/passwordPolicy.js';
import { generateTotpSecret, verifyTotpCode, buildOtpauthUri, generateBackupCodes, hashBackupCode } from '../lib/totp.js';

export const publicAuthRouter = Router();
export const authRouter = Router();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const ROLES = ['admin', 'physician', 'nurse', 'pharmacist', 'billing', 'staff'];
/** Prescriber identity (e-prescribing): NPI with the real Luhn check digit; DEA = 2 letters + 7 digits. Blank clears. */
const npiField = z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).replace(/\D/g, '')), z.string().refine((s) => s === '' || isValidNpi(s), 'NPI check digit is invalid').optional());
const deaField = z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).trim().toUpperCase()), z.string().regex(/^$|^[A-Z]{2}\d{7}$/, 'DEA number must be 2 letters followed by 7 digits').optional());
/** NIST 800-63B: length + a common-password check, not forced composition rules. See lib/passwordPolicy.js. */
const password = z
    .string()
    .max(128)
    .superRefine((val, ctx) => {
        const err = checkPasswordPolicy(val);
        if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    });

// --- lockout (SEC-07)
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// --- refresh token now lives in an httpOnly cookie, not localStorage/JSON (SEC-09).
const REFRESH_COOKIE = 'refreshToken';
function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: ttlMs(config.refreshTokenTtl),
    });
}
function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
}
/** Express 5 doesn't parse cookies by default; this avoids adding a dependency for one header. */
function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return null;
}

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
        npi: u.npi ?? '',
        deaNumber: u.dea_number ?? '',
        preferences: u.preferences || {},
        mfaEnabled: Boolean(u.mfa_enabled),
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
            // Checked against the live DB value on every request (middleware/auth.js). A mismatch
            // means this token predates a deactivation/role-change/logout-everywhere and must stop
            // working now, not at its own natural expiry (SEC-07).
            tv: u.token_version ?? 0,
        },
        config.jwtSecret,
        { subject: u.id, expiresIn: config.accessTokenTtl },
    );
}

/** Short-lived (5 min) token proving the password step passed; must still clear the MFA step. */
function signMfaChallenge(u) {
    return jwt.sign({ typ: 'mfa_challenge', tid: u.tenant_id }, config.jwtSecret, { subject: u.id, expiresIn: '5m' });
}

function verifyMfaChallenge(token) {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.typ !== 'mfa_challenge') throw new Error('wrong token type');
    return payload;
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
            `SELECT u.*, t.name AS tenant_name, t.status AS tenant_status FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE ${where}`,
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

        if (u && u.locked_until && new Date(u.locked_until) > new Date()) {
            const minutes = Math.ceil((new Date(u.locked_until) - new Date()) / 60000);
            await recordAuditEvent({
                tenantId: u.tenant_id,
                actorType: 'anonymous',
                action: 'login_failed',
                resource: 'auth',
                details: { reason: 'locked', usernameHash: sha256(username.toLowerCase()) },
            });
            throw new ApiError(423, `Account temporarily locked from repeated failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, undefined, 'ACCOUNT_LOCKED');
        }

        const valid = await bcrypt.compare(pw, u?.password_hash ?? DUMMY_HASH);
        if (!u || !valid || !u.is_active) {
            let justLocked = false;
            if (u && u.is_active) {
                const nextCount = (u.failed_login_count ?? 0) + 1;
                justLocked = nextCount >= MAX_FAILED_LOGINS;
                await query('UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3', [
                    justLocked ? 0 : nextCount,
                    justLocked ? new Date(Date.now() + LOCKOUT_MS) : null,
                    u.id,
                ]);
            }
            await recordAuditEvent({
                tenantId: u?.tenant_id ?? null,
                actorType: 'anonymous',
                action: 'login_failed',
                resource: 'auth',
                details: { usernameHash: sha256(username.toLowerCase()), justLocked },
            });
            if (justLocked) {
                const minutes = Math.ceil(LOCKOUT_MS / 60000);
                throw new ApiError(423, `Too many failed attempts. Account locked for ${minutes} minutes.`, undefined, 'ACCOUNT_LOCKED');
            }
            throw new ApiError(401, 'Invalid username or password');
        }
        if (u.failed_login_count || u.locked_until) {
            await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [u.id]);
        }
        if (u.tenant_status === 'suspended')
            throw new ApiError(403, "This organization's account is suspended. Contact your administrator.", undefined, 'TENANT_SUSPENDED');

        if (u.mfa_enabled) {
            return res.json({ status: 'mfa_required', mfaToken: signMfaChallenge(u) });
        }

        const tokens = await issueTokens({ query }, u);
        setRefreshCookie(res, tokens.refreshToken);
        await recordAuditEvent({
            tenantId: u.tenant_id,
            actorType: 'staff',
            actorId: u.id,
            actorRole: u.role,
            action: 'login',
            resource: 'auth',
        });
        res.json({ status: 'success', token: tokens.token, role: u.role, user: publicUser(u) });
    }),
);

publicAuthRouter.post(
    '/auth/mfa/verify',
    authLimiter,
    h(async (req, res) => {
        const b = parse(
            z.object({ mfaToken: z.string().min(1), code: z.string().trim().optional(), backupCode: z.string().trim().optional() }),
            req.body,
        );
        let payload;
        try {
            payload = verifyMfaChallenge(b.mfaToken);
        } catch {
            throw new ApiError(401, 'MFA challenge has expired. Log in again.');
        }
        const u = await loadUser('u.id = $1', [payload.sub]);
        if (!u || !u.is_active || !u.mfa_enabled) throw new ApiError(401, 'MFA challenge has expired. Log in again.');

        let verified = false;
        let usedBackupCode = false;
        if (b.code && verifyTotpCode(u.mfa_secret, b.code)) {
            verified = true;
        } else if (b.backupCode) {
            const hash = hashBackupCode(b.backupCode);
            const codes = Array.isArray(u.mfa_backup_codes) ? u.mfa_backup_codes : [];
            if (codes.includes(hash)) {
                verified = true;
                usedBackupCode = true;
                await query('UPDATE users SET mfa_backup_codes = $1::jsonb WHERE id = $2', [
                    JSON.stringify(codes.filter((c) => c !== hash)),
                    u.id,
                ]);
            }
        }

        if (!verified) {
            await recordAuditEvent({
                tenantId: u.tenant_id,
                actorType: 'anonymous',
                action: 'login_failed',
                resource: 'auth',
                details: { reason: 'mfa' },
            });
            throw new ApiError(401, 'Invalid code');
        }

        const tokens = await issueTokens({ query }, u);
        setRefreshCookie(res, tokens.refreshToken);
        await recordAuditEvent({
            tenantId: u.tenant_id,
            actorType: 'staff',
            actorId: u.id,
            actorRole: u.role,
            action: 'login',
            resource: 'auth',
            details: { mfa: true, usedBackupCode },
        });
        res.json({ status: 'success', token: tokens.token, role: u.role, user: publicUser(u) });
    }),
);

publicAuthRouter.post(
    '/auth/refresh',
    authLimiter,
    h(async (req, res) => {
        const refreshToken = getCookie(req, REFRESH_COOKIE);
        if (!refreshToken) throw new ApiError(401, 'Invalid or expired refresh token');
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
            return { tokens: await issueTokens(db, t), user: t };
        });
        if (!result) {
            clearRefreshCookie(res);
            throw new ApiError(401, 'Invalid or expired refresh token');
        }
        setRefreshCookie(res, result.tokens.refreshToken);
        await recordAuditEvent({
            tenantId: result.user.tenant_id,
            actorType: 'staff',
            actorId: result.user.id,
            actorRole: result.user.role,
            action: 'refresh',
            resource: 'auth',
        });
        res.json({ status: 'success', token: result.tokens.token });
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
            // SEC-08: this used to only console.log the token outside production and do nothing at
            // all in production — a staff user had no way to actually receive the reset link. Now it
            // emails it the same way the patient-portal and platform-admin flows already do (and
            // lib/email.js falls back to a console stub itself when SMTP isn't configured).
            // /set-password already exists and is wired to POST /auth/reset-password (see SetPasswordPage.tsx) —
            // the same page the platform-admin invite link uses, so this reuses it rather than a dead route.
            const link = `${config.frontendUrl}/set-password?token=${raw}`;
            await sendEmail({
                to: u.email,
                subject: 'Reset your password',
                text: `Reset your password:\n${link}\n\nThis link expires in 1 hour.`,
                html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
            });
            if (devTokensAllowed()) console.log(`[forgotPassword] reset token for ${u.email}: ${raw}`);
            await recordAuditEvent({
                tenantId: u.tenant_id,
                actorType: 'staff',
                actorId: u.id,
                actorRole: u.role,
                action: 'password_reset',
                resource: 'auth',
                details: { stage: 'requested' },
            });
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
            `UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_expires_at = NULL,
                    token_version = token_version + 1, failed_login_count = 0, locked_until = NULL, updated_at = now()
             WHERE reset_token_hash = $2 AND reset_expires_at > now() RETURNING id, tenant_id, role`,
            [await bcrypt.hash(body.newPassword, 10), sha256(body.token)],
        );
        if (!r.rowCount) throw new ApiError(400, 'Reset link is invalid or has expired');
        // token_version above invalidates any access token already issued; revoking refresh tokens
        // here stops a stolen one from minting a fresh access token after the password changes.
        await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [r.rows[0].id]);
        await recordAuditEvent({
            tenantId: r.rows[0].tenant_id,
            actorType: 'staff',
            actorId: r.rows[0].id,
            actorRole: r.rows[0].role,
            action: 'password_reset',
            resource: 'auth',
            details: { stage: 'completed' },
        });
        res.json({ status: 'success', message: 'Password updated' });
    }),
);

/** Self-service signup is disabled unless ALLOW_SELF_SERVICE_REGISTRATION=true (always on under test). */
function registrationEnabled() {
    if (process.env.ALLOW_SELF_SERVICE_REGISTRATION === 'true') return true;
    if (process.env.ALLOW_SELF_SERVICE_REGISTRATION === 'false') return false;
    return config.allowSelfServiceRegistration;
}

// Self-service signup: creates a new tenant and its first admin user. Gated — see registrationEnabled().
publicAuthRouter.post(
    '/auth/register',
    authLimiter,
    h(async (req, res) => {
        if (!registrationEnabled()) {
            throw new ApiError(403, 'Self-service registration is disabled. Ask your platform administrator to provision your organization.', undefined, 'REGISTRATION_DISABLED');
        }
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
        setRefreshCookie(res, tokens.refreshToken);
        res.status(201).json({ status: 'success', token: tokens.token, role: full.role, user: publicUser(full) });
    }),
);

// ---------------------------------------------------------- authenticated
authRouter.use(requireAuth);

authRouter.post(
    '/auth/logout',
    h(async (req, res) => {
        const refreshToken = getCookie(req, REFRESH_COOKIE);
        if (refreshToken) {
            await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND user_id = $2', [sha256(refreshToken), req.user.id]);
        }
        clearRefreshCookie(res);
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'logout',
            resource: 'auth',
        });
        res.json({ status: 'success' });
    }),
);

// "Sign out of all devices" — bumps token_version (every currently-issued access token, anywhere,
// stops working on its next request) and revokes every refresh token for this user.
authRouter.post(
    '/auth/logout-all',
    h(async (req, res) => {
        await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
        await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id]);
        clearRefreshCookie(res);
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'logout',
            resource: 'auth',
            details: { allDevices: true },
        });
        res.json({ status: 'success' });
    }),
);

// --- MFA (TOTP, opt-in per user; see lib/totp.js)
authRouter.post(
    '/auth/mfa/enroll',
    h(async (req, res) => {
        const u = await loadUser('u.id = $1', [req.user.id]);
        if (u.mfa_enabled) throw new ApiError(409, 'MFA is already enabled. Disable it before re-enrolling.');
        const secret = generateTotpSecret();
        await query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, req.user.id]);
        ok(res, { secret, otpauthUri: buildOtpauthUri({ secret, accountName: u.email }) });
    }),
);

authRouter.post(
    '/auth/mfa/confirm',
    h(async (req, res) => {
        const { code } = parse(z.object({ code: z.string().trim().min(1) }), req.body);
        const u = await loadUser('u.id = $1', [req.user.id]);
        if (!u.mfa_secret) throw new ApiError(400, 'Start enrollment first');
        if (!verifyTotpCode(u.mfa_secret, code)) throw new ApiError(401, 'Invalid code');
        const backupCodes = generateBackupCodes();
        await query('UPDATE users SET mfa_enabled = TRUE, mfa_backup_codes = $1::jsonb WHERE id = $2', [
            JSON.stringify(backupCodes.map(hashBackupCode)),
            req.user.id,
        ]);
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'update',
            resource: 'user',
            resourceId: req.user.id,
            details: { mfaEnabled: true },
        });
        // Shown once — these are the only recovery path if the authenticator app is lost.
        ok(res, { backupCodes });
    }),
);

authRouter.post(
    '/auth/mfa/disable',
    h(async (req, res) => {
        const { password: pw } = parse(z.object({ password: z.string().min(1) }), req.body);
        const u = await loadUser('u.id = $1', [req.user.id]);
        if (!(await bcrypt.compare(pw, u.password_hash))) throw new ApiError(401, 'Incorrect password');
        await query(`UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = '[]'::jsonb WHERE id = $1`, [req.user.id]);
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'update',
            resource: 'user',
            resourceId: req.user.id,
            details: { mfaEnabled: false },
        });
        ok(res, { message: 'MFA disabled' });
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
        // SEC-16: npi/deaNumber are deliberately NOT accepted here — this endpoint lets any
        // authenticated user edit their own profile with no role check, so a self-asserted
        // prescriber credential was previously possible for any role (nurse, billing, staff). Those
        // fields are admin-only now, set via PUT /auth/users/:id (already admin-gated, below).
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
        const t = (await query('SELECT * FROM tenants WHERE id = $1', [req.user.tenantId])).rows[0];
        if (!t) throw notFound('Tenant not found');
        ok(res, {
            id: t.id,
            _id: t.id,
            name: t.name,
            createdAt: t.created_at,
            status: t.status,
            plan: t.plan,
            enabledModules: t.enabled_modules,
            onboardingStatus: t.onboarding_status,
        });
    }),
);

// The tenant's own admin marks onboarding complete at the end of the wizard (see Tenant Onboarding
// Wizard). Platform admins separately manage status/plan/enabledModules via /api/platform/tenants/:id.
authRouter.put(
    '/tenants/current/onboarding-status',
    requireRole(),
    h(async (req, res) => {
        const { onboardingStatus } = parse(z.object({ onboardingStatus: z.enum(['provisioned', 'in_progress', 'complete']) }), req.body);
        const t = (
            await query('UPDATE tenants SET onboarding_status = $1 WHERE id = $2 RETURNING id, onboarding_status', [onboardingStatus, req.user.tenantId])
        ).rows[0];
        ok(res, { id: t.id, _id: t.id, onboardingStatus: t.onboarding_status });
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
    npi: npiField,
    deaNumber: deaField,
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
                `INSERT INTO users (tenant_id,email,username,password_hash,first_name,last_name,role,npi,dea_number)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                [req.user.tenantId, b.email, b.username ?? null, await bcrypt.hash(b.password, 10), b.firstName, b.lastName, b.role, b.npi || null, b.deaNumber || null],
            )
        ).rows[0];
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'create',
            resource: 'user',
            resourceId: u.id,
            details: { email: u.email, role: u.role },
        });
        created(res, publicUser(u));
    }),
);

// Deliberately NOT `userBody.partial()`: zod's `.default()` on `firstName`/`lastName`/`role` still
// substitutes the default for an *omitted* key even after `.partial()` makes the key optional (the
// default short-circuits before the optional check runs). A caller updating just `isActive` or
// `npi` — exactly what this route is for — would silently have `role` reset to 'nurse' and
// `firstName`/`lastName` blanked out. Found while testing SEC-16 (an npi-only PUT here reset the
// target physician's role, which bumped their token_version and started 401ing their own token).
const updateUserBody = z.object({
    email: z.string().trim().email().optional(),
    username: z.string().trim().min(2).max(100).optional(),
    password: password.optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    role: z.enum(ROLES).optional(),
    npi: npiField,
    deaNumber: deaField,
    isActive: z.boolean().optional(),
});

const updateUser = h(async (req, res) => {
    const b = parse(updateUserBody, req.body);
    const hash = b.password ? await bcrypt.hash(b.password, 10) : null;
    // A still-valid access token must stop working immediately on deactivation or a role change
    // (SEC-07), not at its own expiry — bumping token_version here does that (checked every request
    // in requireAuth). Password changes bump it too, for the same reason /auth/reset-password does.
    const bumpTokenVersion = b.role !== undefined || b.isActive === false || Boolean(b.password);
    const r = await query(
        `UPDATE users SET email = COALESCE($1,email), username = COALESCE($2,username), password_hash = COALESCE($3,password_hash),
                first_name = COALESCE($4,first_name), last_name = COALESCE($5,last_name), role = COALESCE($6,role),
                is_active = COALESCE($7,is_active), npi = CASE WHEN $10::text IS NULL THEN npi ELSE NULLIF($10, '') END,
                dea_number = CASE WHEN $11::text IS NULL THEN dea_number ELSE NULLIF($11, '') END,
                token_version = CASE WHEN $12 THEN token_version + 1 ELSE token_version END, updated_at = now()
         WHERE id = $8 AND tenant_id = $9 RETURNING *`,
        [b.email ?? null, b.username ?? null, hash, b.firstName ?? null, b.lastName ?? null, b.role ?? null, b.isActive ?? null, req.params.id, req.user.tenantId, b.npi ?? null, b.deaNumber ?? null, bumpTokenVersion],
    );
    if (!r.rowCount) throw notFound('User not found');
    if (b.isActive === false) {
        // Deactivation also revokes refresh tokens, so a stolen one can't mint a fresh access token
        // with the bumped token_version — the bump alone only catches tokens already issued.
        await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.params.id]);
    }
    await recordAuditEvent({
        tenantId: req.user.tenantId,
        actorType: 'staff',
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'update',
        resource: 'user',
        resourceId: req.params.id,
        details: {
            fields: Object.keys(b).filter((k) => b[k] !== undefined),
            roleChanged: b.role !== undefined,
            deactivated: b.isActive === false,
        },
    });
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
        await recordAuditEvent({
            tenantId: req.user.tenantId,
            actorType: 'staff',
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'delete',
            resource: 'user',
            resourceId: req.params.id,
        });
        res.json({ status: 'success' });
    }),
);
