// @ts-check
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config, isProd, devTokensAllowed } from '../config.js';
import { q, tx } from '../lib/sql.js';
import { ApiError, h, ok, parse } from '../lib/http.js';
import { sendEmail } from '../lib/email.js';
import { recordAuditEvent } from '../lib/audit.js';

export const smartAuthRouter = Router();

const sha256 = (/** @type {string} */ s) => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);

/**
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 */
const route = (fn) => h(fn);

const RESOURCE_TYPES = [
    'Patient',
    'Encounter',
    'Condition',
    'AllergyIntolerance',
    'MedicationRequest',
    'Observation',
    'Immunization',
    'DocumentReference',
];

const SUPPORTED_SCOPES = new Set([
    'openid',
    'fhirUser',
    'launch/patient',
    'offline_access',
    'patient/*.read',
    ...RESOURCE_TYPES.map((t) => `patient/${t}.read`),
]);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? 40 : 400,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many attempts, try again later' },
});

/**
 * @param {string} ttl
 * @returns {number}
 */
function ttlMs(ttl) {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 15 * 60e3;
    const n = Number(m[1]);
    const unit = /** @type {Record<string, number>} */ ({ s: 1e3, m: 6e4, h: 36e5, d: 864e5 })[m[2] || 'm'];
    return n * (unit || 6e4);
}

/**
 * @param {string} scopeStr
 * @returns {{ ok: true, scopes: string[] } | { ok: false, error: string }}
 */
function parseAndValidateScopes(scopeStr) {
    const scopes = String(scopeStr || '')
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (!scopes.length) return { ok: false, error: 'scope is required' };
    for (const s of scopes) {
        if (s.endsWith('.write') || s.includes('/*.write')) {
            return { ok: false, error: `Write scope not allowed: ${s}` };
        }
        if (!SUPPORTED_SCOPES.has(s)) {
            return { ok: false, error: `Unsupported scope: ${s}` };
        }
    }
    return { ok: true, scopes };
}

/**
 * @param {string} verifier
 * @param {string} challenge
 */
function verifyPkceS256(verifier, challenge) {
    const digest = crypto.createHash('sha256').update(verifier).digest();
    const computed = digest.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return computed === challenge;
}

/**
 * @param {Record<string, any>} account
 * @param {string} [expiresIn]
 */
function signPatientJwt(account, expiresIn = '15m') {
    return jwt.sign(
        {
            typ: 'patient',
            tid: account.tenant_id,
            email: account.email,
            patient: account.patient_id,
        },
        config.smartJwtSecret,
        {
            subject: String(account.id),
            expiresIn: /** @type {import('jsonwebtoken').SignOptions['expiresIn']} */ (expiresIn),
        },
    );
}

/**
 * @param {{
 *   authorizationId: string,
 *   tenantId: string,
 *   clientId: string,
 *   patientAccountId: string,
 *   patientId: string,
 *   scopes: string[],
 * }} g
 */
function signSmartAccess(g) {
    return jwt.sign(
        {
            typ: 'smart',
            tid: g.tenantId,
            cid: g.clientId,
            aid: g.authorizationId,
            patient: g.patientId,
            scope: g.scopes.join(' '),
        },
        config.smartJwtSecret,
        {
            subject: g.patientAccountId,
            expiresIn: /** @type {import('jsonwebtoken').SignOptions['expiresIn']} */ (config.smartAccessTokenTtl),
        },
    );
}

/**
 * @param {import('express').Request} req
 * @returns {Promise<Record<string, any>>}
 */
async function requirePatientJwt(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Patient authentication required');
    /** @type {import('jsonwebtoken').JwtPayload} */
    let payload;
    try {
        payload = /** @type {import('jsonwebtoken').JwtPayload} */ (jwt.verify(token, config.smartJwtSecret));
        if (payload.typ !== 'patient') throw new Error('wrong type');
    } catch {
        throw new ApiError(401, 'Invalid or expired patient token');
    }
    const account = (
        await q(`SELECT * FROM patient_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`, [
            payload.sub,
            payload.tid,
        ])
    ).rows[0];
    if (!account || !account.password_hash) throw new ApiError(401, 'Invalid or expired patient token');
    return account;
}

/** @param {string} clientId */
async function loadActiveClient(clientId) {
    return (await q(`SELECT * FROM smart_clients WHERE client_id = $1 AND is_active = TRUE`, [clientId])).rows[0];
}

/**
 * @param {Record<string, any>} client
 * @param {string} redirectUri
 */
function redirectAllowed(client, redirectUri) {
    const uris = Array.isArray(client.redirect_uris) ? client.redirect_uris.map(String) : [];
    return uris.includes(redirectUri);
}

/**
 * @param {Record<string, any>} client
 * @param {string[]} scopes
 */
function scopesAllowedByClient(client, scopes) {
    const allowed = Array.isArray(client.allowed_scopes) ? client.allowed_scopes.map(String) : [];
    if (!allowed.length) return true;
    return scopes.every((s) => allowed.includes(s) || (s.endsWith('.read') && allowed.includes('patient/*.read')));
}

// SEC-15: SMART App Launch requires discovery at `{FHIR base URL}/.well-known/smart-configuration`
// (absolute to the FHIR server, not the app root) — this API's FHIR base is `/fhir` (see fhir.js's
// `/fhir/metadata`), so that's where it's actually served now. The old root-level path redirects here
// for anything still pointed at it.
smartAuthRouter.get('/.well-known/smart-configuration', (_req, res) => {
    res.redirect(301, '/fhir/.well-known/smart-configuration');
});

smartAuthRouter.get(
    '/fhir/.well-known/smart-configuration',
    route(async (_req, res) => {
        res.json({
            authorization_endpoint: `${config.backendUrl}/oauth/authorize`,
            token_endpoint: `${config.backendUrl}/oauth/token`,
            revocation_endpoint: `${config.backendUrl}/oauth/revoke`,
            capabilities: [
                'launch-standalone',
                'client-public',
                'client-confidential-symmetric',
                'sso-openid-connect',
                'context-standalone-patient',
                'permission-offline',
                'permission-patient',
            ],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: [...SUPPORTED_SCOPES],
            response_types_supported: ['code'],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        });
    }),
);

smartAuthRouter.get(
    '/oauth/authorize',
    route(async (req, res) => {
        const queryIn = parse(
            z.object({
                response_type: z.literal('code'),
                client_id: z.string().min(1),
                redirect_uri: z.string().url(),
                scope: z.string().min(1),
                state: z.string().min(1),
                code_challenge: z.string().min(43).max(128),
                code_challenge_method: z.literal('S256'),
                // SEC-15: SMART App Launch requires the app to send `aud` (the FHIR server it intends
                // to call) and the authorization server to reject a mismatch — otherwise a code issued
                // here could be replayed against a different FHIR server impersonating this one.
                aud: z.string().min(1),
            }),
            req.query,
        );

        const client = await loadActiveClient(queryIn.client_id);
        if (!client) throw new ApiError(400, 'Unknown or inactive client_id');
        if (!redirectAllowed(client, queryIn.redirect_uri)) {
            throw new ApiError(400, 'redirect_uri does not match a registered URI');
        }

        const expectedAud = `${config.backendUrl}/fhir`;
        if (queryIn.aud.replace(/\/$/, '') !== expectedAud) {
            const errUrl = new URL(queryIn.redirect_uri);
            errUrl.searchParams.set('error', 'invalid_request');
            errUrl.searchParams.set('error_description', `aud must be ${expectedAud}`);
            errUrl.searchParams.set('state', queryIn.state);
            res.redirect(302, errUrl.toString());
            return;
        }

        const scopeResult = parseAndValidateScopes(queryIn.scope);
        if (!scopeResult.ok) {
            const errUrl = new URL(queryIn.redirect_uri);
            errUrl.searchParams.set('error', 'invalid_scope');
            errUrl.searchParams.set('error_description', scopeResult.error);
            errUrl.searchParams.set('state', queryIn.state);
            res.redirect(302, errUrl.toString());
            return;
        }
        if (!scopesAllowedByClient(client, scopeResult.scopes)) {
            const errUrl = new URL(queryIn.redirect_uri);
            errUrl.searchParams.set('error', 'invalid_scope');
            errUrl.searchParams.set('error_description', 'Scope not allowed for this client');
            errUrl.searchParams.set('state', queryIn.state);
            res.redirect(302, errUrl.toString());
            return;
        }

        const dest = new URL(`${config.frontendUrl}/patient/authorize`);
        dest.searchParams.set('client_id', queryIn.client_id);
        dest.searchParams.set('redirect_uri', queryIn.redirect_uri);
        dest.searchParams.set('scope', queryIn.scope);
        dest.searchParams.set('state', queryIn.state);
        dest.searchParams.set('code_challenge', queryIn.code_challenge);
        dest.searchParams.set('code_challenge_method', 'S256');
        dest.searchParams.set('client_name', String(client.name));
        res.redirect(302, dest.toString());
    }),
);

smartAuthRouter.post(
    '/oauth/authorize/decision',
    authLimiter,
    route(async (req, res) => {
        const account = await requirePatientJwt(req);
        const b = parse(
            z.object({
                allow: z.boolean(),
                client_id: z.string().min(1),
                redirect_uri: z.string().url(),
                scope: z.string().min(1),
                state: z.string().min(1),
                code_challenge: z.string().min(43).max(128),
                code_challenge_method: z.literal('S256'),
            }),
            req.body,
        );

        const client = await loadActiveClient(b.client_id);
        if (!client || String(client.tenant_id) !== String(account.tenant_id)) {
            throw new ApiError(400, 'Unknown or inactive client_id');
        }
        if (!redirectAllowed(client, b.redirect_uri)) {
            throw new ApiError(400, 'redirect_uri does not match a registered URI');
        }

        const redirect = new URL(b.redirect_uri);
        redirect.searchParams.set('state', b.state);

        if (!b.allow) {
            await recordAuditEvent({
                tenantId: account.tenant_id,
                actorType: 'patient',
                actorId: account.id,
                action: 'update',
                resource: 'smart_authorization',
                details: { decision: 'denied', clientId: b.client_id },
            });
            redirect.searchParams.set('error', 'access_denied');
            redirect.searchParams.set('error_description', 'The patient denied the request');
            ok(res, { redirectUrl: redirect.toString() });
            return;
        }

        const scopeResult = parseAndValidateScopes(b.scope);
        if (!scopeResult.ok) throw new ApiError(400, scopeResult.error);
        if (!scopesAllowedByClient(client, scopeResult.scopes)) {
            throw new ApiError(400, 'Scope not allowed for this client');
        }

        const code = crypto.randomBytes(32).toString('hex');
        await q(
            `INSERT INTO smart_authorizations
                (tenant_id, client_id, patient_account_id, scopes, code_hash, code_challenge,
                 code_challenge_method, code_expires_at)
             VALUES ($1,$2,$3,$4::jsonb,$5,$6,'S256', now() + interval '5 minutes')`,
            [
                account.tenant_id,
                b.client_id,
                account.id,
                JSON.stringify(scopeResult.scopes),
                sha256(code),
                b.code_challenge,
            ],
        );

        await recordAuditEvent({
            tenantId: account.tenant_id,
            actorType: 'patient',
            actorId: account.id,
            action: 'update',
            resource: 'smart_authorization',
            details: { decision: 'allowed', clientId: b.client_id, scopes: scopeResult.scopes },
        });
        redirect.searchParams.set('code', code);
        ok(res, { redirectUrl: redirect.toString() });
    }),
);

/**
 * @param {import('express').Request} req
 * @param {{ client_id?: string, client_secret?: string }} body
 */
function extractClientAuth(req, body) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Basic ')) {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        if (idx >= 0) {
            return {
                clientId: decoded.slice(0, idx),
                clientSecret: decoded.slice(idx + 1),
            };
        }
    }
    return {
        clientId: body.client_id || '',
        clientSecret: body.client_secret || '',
    };
}

/**
 * @param {Record<string, any>} client
 * @param {string} clientSecret
 */
async function assertClientSecret(client, clientSecret) {
    if (!client.is_confidential) return;
    const okSecret = await bcrypt.compare(clientSecret || '', String(client.client_secret_hash || DUMMY_HASH));
    if (!okSecret) throw new ApiError(401, 'Invalid client credentials');
}

smartAuthRouter.post(
    '/oauth/token',
    authLimiter,
    route(async (req, res) => {
        const body = /** @type {Record<string, string>} */ (req.body || {});
        const grantType = String(body.grant_type || '');
        const { clientId, clientSecret } = extractClientAuth(req, body);
        if (!clientId) throw new ApiError(400, 'client_id is required');

        const client = await loadActiveClient(clientId);
        if (!client) throw new ApiError(401, 'Invalid client');
        await assertClientSecret(client, clientSecret);

        if (grantType === 'authorization_code') {
            const code = String(body.code || '');
            const redirectUri = String(body.redirect_uri || '');
            const codeVerifier = String(body.code_verifier || '');
            if (!code || !redirectUri || !codeVerifier) {
                throw new ApiError(400, 'code, redirect_uri, and code_verifier are required');
            }
            if (!redirectAllowed(client, redirectUri)) {
                throw new ApiError(400, 'redirect_uri mismatch');
            }

            const result = await tx(async (db) => {
                const grant = (
                    await db.query(
                        `SELECT a.*, pa.patient_id, pa.is_active AS account_active
                         FROM smart_authorizations a
                         JOIN patient_accounts pa ON pa.id = a.patient_account_id
                         WHERE a.code_hash = $1 AND a.client_id = $2 AND a.tenant_id = $3
                         FOR UPDATE OF a`,
                        [sha256(code), clientId, client.tenant_id],
                    )
                ).rows[0];
                if (!grant || grant.code_used_at || grant.revoked_at || !grant.account_active) {
                    return null;
                }
                if (!grant.code_expires_at || new Date(grant.code_expires_at) < new Date()) {
                    return null;
                }
                if (
                    grant.code_challenge_method !== 'S256' ||
                    !verifyPkceS256(codeVerifier, String(grant.code_challenge))
                ) {
                    throw new ApiError(400, 'PKCE verification failed');
                }

                /** @type {string[]} */
                const scopes = Array.isArray(grant.scopes) ? grant.scopes.map(String) : [];
                const wantsRefresh = scopes.includes('offline_access');
                const refresh = wantsRefresh ? crypto.randomBytes(48).toString('hex') : null;

                await db.query(
                    `UPDATE smart_authorizations SET
                        code_used_at = now(),
                        code_hash = NULL,
                        refresh_token_hash = $1,
                        refresh_expires_at = $2
                     WHERE id = $3`,
                    [refresh ? sha256(refresh) : null, refresh ? new Date(Date.now() + 30 * 864e5) : null, grant.id],
                );

                return {
                    grant,
                    scopes,
                    refresh,
                    access: signSmartAccess({
                        authorizationId: String(grant.id),
                        tenantId: String(grant.tenant_id),
                        clientId: String(grant.client_id),
                        patientAccountId: String(grant.patient_account_id),
                        patientId: String(grant.patient_id),
                        scopes,
                    }),
                };
            });

            if (!result) throw new ApiError(400, 'Invalid or expired authorization code');

            /** @type {Record<string, unknown>} */
            const tokenResponse = {
                access_token: result.access,
                token_type: 'Bearer',
                expires_in: Math.floor(ttlMs(config.smartAccessTokenTtl) / 1000),
                scope: result.scopes.join(' '),
                patient: result.grant.patient_id,
            };
            if (result.refresh) tokenResponse.refresh_token = result.refresh;
            res.json(tokenResponse);
            return;
        }

        if (grantType === 'refresh_token') {
            const refreshToken = String(body.refresh_token || '');
            if (!refreshToken) throw new ApiError(400, 'refresh_token is required');

            const result = await tx(async (db) => {
                const grant = (
                    await db.query(
                        `SELECT a.*, pa.patient_id, pa.is_active AS account_active
                         FROM smart_authorizations a
                         JOIN patient_accounts pa ON pa.id = a.patient_account_id
                         WHERE a.refresh_token_hash = $1 AND a.client_id = $2 AND a.tenant_id = $3
                         FOR UPDATE OF a`,
                        [sha256(refreshToken), clientId, client.tenant_id],
                    )
                ).rows[0];
                if (!grant || grant.revoked_at || !grant.account_active) return null;
                if (!grant.refresh_expires_at || new Date(grant.refresh_expires_at) < new Date()) return null;

                /** @type {string[]} */
                const scopes = Array.isArray(grant.scopes) ? grant.scopes.map(String) : [];
                const newRefresh = crypto.randomBytes(48).toString('hex');
                await db.query(
                    `UPDATE smart_authorizations SET refresh_token_hash = $1, refresh_expires_at = $2 WHERE id = $3`,
                    [sha256(newRefresh), new Date(Date.now() + 30 * 864e5), grant.id],
                );
                return {
                    grant,
                    scopes,
                    refresh: newRefresh,
                    access: signSmartAccess({
                        authorizationId: String(grant.id),
                        tenantId: String(grant.tenant_id),
                        clientId: String(grant.client_id),
                        patientAccountId: String(grant.patient_account_id),
                        patientId: String(grant.patient_id),
                        scopes,
                    }),
                };
            });

            if (!result) throw new ApiError(400, 'Invalid or expired refresh token');
            res.json({
                access_token: result.access,
                token_type: 'Bearer',
                expires_in: Math.floor(ttlMs(config.smartAccessTokenTtl) / 1000),
                scope: result.scopes.join(' '),
                patient: result.grant.patient_id,
                refresh_token: result.refresh,
            });
            return;
        }

        throw new ApiError(400, 'Unsupported grant_type');
    }),
);

smartAuthRouter.post(
    '/oauth/revoke',
    authLimiter,
    route(async (req, res) => {
        const body = /** @type {Record<string, string>} */ (req.body || {});
        const token = String(body.token || '');
        const { clientId, clientSecret } = extractClientAuth(req, body);
        if (!token) {
            res.status(200).json({});
            return;
        }
        if (clientId) {
            const client = await loadActiveClient(clientId);
            if (client) await assertClientSecret(client, clientSecret);
        }
        const hash = sha256(token);
        // SEC-15: scope the revoke to the authenticated client's own grants. Without the client_id
        // filter, any caller holding a valid token hash could revoke a grant belonging to a different
        // client — the token itself is secret so this isn't an easy attack, but a revocation endpoint
        // should never be able to touch another client's authorization regardless.
        const revoked = await q(
            clientId
                ? `UPDATE smart_authorizations SET revoked_at = now()
                   WHERE (refresh_token_hash = $1 OR code_hash = $1) AND client_id = $2 AND revoked_at IS NULL
                   RETURNING id, tenant_id, patient_account_id`
                : `UPDATE smart_authorizations SET revoked_at = now()
                   WHERE (refresh_token_hash = $1 OR code_hash = $1) AND revoked_at IS NULL
                   RETURNING id, tenant_id, patient_account_id`,
            clientId ? [hash, clientId] : [hash],
        );
        for (const r of revoked.rows) {
            await recordAuditEvent({
                tenantId: r.tenant_id,
                actorType: 'patient',
                actorId: r.patient_account_id,
                action: 'update',
                resource: 'smart_authorization',
                resourceId: r.id,
                details: { decision: 'revoked', clientId },
            });
        }
        try {
            const payload = /** @type {import('jsonwebtoken').JwtPayload} */ (
                jwt.verify(token, config.smartJwtSecret)
            );
            if (payload.typ === 'smart' && payload.aid) {
                const r2 = await q(
                    `UPDATE smart_authorizations SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL
                     RETURNING id, tenant_id, patient_account_id`,
                    [payload.aid],
                );
                for (const r of r2.rows) {
                    await recordAuditEvent({
                        tenantId: r.tenant_id,
                        actorType: 'patient',
                        actorId: r.patient_account_id,
                        action: 'update',
                        resource: 'smart_authorization',
                        resourceId: r.id,
                        details: { decision: 'revoked', clientId },
                    });
                }
            }
        } catch {
            /* RFC 7009 always returns 200 */
        }
        res.status(200).json({});
    }),
);

smartAuthRouter.post(
    '/patient-auth/set-password',
    authLimiter,
    route(async (req, res) => {
        const b = parse(
            z.object({
                token: z.string().min(1),
                newPassword: passwordSchema,
                confirmPassword: z.string(),
            }),
            req.body,
        );
        if (b.newPassword !== b.confirmPassword) throw new ApiError(400, 'Passwords do not match');
        const r = await q(
            `UPDATE patient_accounts
             SET password_hash = $1, invite_token_hash = NULL, invite_expires_at = NULL, is_active = TRUE
             WHERE invite_token_hash = $2 AND invite_expires_at > now() AND is_active = TRUE
             RETURNING id, email, tenant_id, patient_id`,
            [await bcrypt.hash(b.newPassword, 10), sha256(b.token)],
        );
        if (!r.rowCount || !r.rows[0]) throw new ApiError(400, 'Invite link is invalid or has expired');
        ok(res, { message: 'Password set', email: r.rows[0].email });
    }),
);

smartAuthRouter.post(
    '/patient-auth/login',
    authLimiter,
    route(async (req, res) => {
        const b = parse(
            z.object({
                email: z.string().trim().email(),
                password: z.string().min(1),
                tenantId: z.string().trim().min(1).optional(),
            }),
            req.body,
        );
        // SEC-14: the same email can exist in more than one tenant's patient_accounts (two unrelated
        // organizations inviting the same person). Picking "the oldest one" and comparing the password
        // against only that row meant a patient with the *correct* password for a newer tenant account
        // could get a confusing "invalid email or password" because the wrong row was tried. Instead,
        // when tenantId isn't given, try every matching row and log in to whichever one's password
        // actually matches — tenantId (when supplied) still narrows it directly.
        const candidates = (
            await q(
                b.tenantId
                    ? `SELECT * FROM patient_accounts WHERE lower(email) = lower($1) AND tenant_id = $2`
                    : `SELECT * FROM patient_accounts WHERE lower(email) = lower($1) ORDER BY created_at`,
                b.tenantId ? [b.email, b.tenantId] : [b.email],
            )
        ).rows;
        let account = null;
        for (const candidate of candidates.length ? candidates : [null]) {
            const valid = await bcrypt.compare(b.password, candidate?.password_hash ?? DUMMY_HASH);
            if (candidate && valid && candidate.is_active && candidate.password_hash) {
                account = candidate;
                break;
            }
        }
        if (!account) {
            await recordAuditEvent({
                tenantId: candidates[0]?.tenant_id ?? null,
                actorType: 'anonymous',
                action: 'login_failed',
                resource: 'patient_account',
                details: { emailHash: sha256(b.email.toLowerCase()) },
            });
            throw new ApiError(401, 'Invalid email or password');
        }
        await q(`UPDATE patient_accounts SET last_login_at = now() WHERE id = $1`, [account.id]);
        await recordAuditEvent({
            tenantId: account.tenant_id,
            actorType: 'patient',
            actorId: account.id,
            action: 'login',
            resource: 'patient_account',
            patientId: account.patient_id,
        });
        ok(res, {
            token: signPatientJwt(account),
            patientId: account.patient_id,
            tenantId: account.tenant_id,
            email: account.email,
        });
    }),
);

smartAuthRouter.post(
    '/patient-auth/forgot-password',
    authLimiter,
    route(async (req, res) => {
        const { email } = parse(z.object({ email: z.string().trim().email() }), req.body);
        // SEC-14: the same email can be registered under more than one tenant. Rather than picking one
        // (silently resetting the wrong tenant's account while the one the patient actually meant stays
        // untouched), send a correctly-scoped reset link for *every* matching active account — same
        // inbox either way, so this discloses nothing a single-match response wouldn't already imply.
        const accounts = (
            await q(
                `SELECT * FROM patient_accounts WHERE lower(email) = lower($1) AND is_active = TRUE AND password_hash IS NOT NULL`,
                [email],
            )
        ).rows;
        for (const account of accounts) {
            const raw = crypto.randomBytes(32).toString('hex');
            await q(
                `UPDATE patient_accounts SET invite_token_hash = $1, invite_expires_at = now() + interval '1 hour' WHERE id = $2`,
                [sha256(raw), account.id],
            );
            const link = `${config.frontendUrl}/patient/set-password?token=${raw}`;
            await sendEmail({
                to: account.email,
                subject: 'Reset your patient portal password',
                text: `Reset your password:\n${link}\n\nThis link expires in 1 hour.${accounts.length > 1 ? '\n\nNote: you have more than one patient portal account with this email; use the link from the message that matches the organization you meant to sign in to.' : ''}`,
                html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>${accounts.length > 1 ? '<p>Note: you have more than one patient portal account with this email; use the link from the message that matches the organization you meant to sign in to.</p>' : ''}`,
            });
            if (devTokensAllowed()) console.log(`[patient-auth/forgot-password] token for ${account.email} (tenant ${account.tenant_id}): ${raw}`);
        }
        ok(res, { message: 'If that email is registered, a reset link has been sent.' });
    }),
);
