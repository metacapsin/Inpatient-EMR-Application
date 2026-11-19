import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { ApiError } from '../lib/http.js';

/**
 * Verifies the Bearer access token, sets req.user = { id, tenantId, role, name, email }, and loads
 * the tenant's current status/enabledModules plus the user's own is_active/token_version/role onto
 * req.tenant / the token_version check — all checked fresh every request, not cached on the JWT, so
 * a Super Admin suspending a tenant, an admin deactivating a user, or a role change all take effect
 * on the very next request instead of waiting for the token to expire (SEC-07). `tv` on a token
 * issued before this check existed is absent, which is treated as 0 — the column's default — so
 * deploying this does not invalidate every session that was already live. Express 5 forwards a
 * rejected promise from async middleware to the error handler automatically (see lib/http.js's `h`
 * comment), so no try/catch wrapper is needed here.
 */
export async function requireAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new ApiError(401, 'Authentication required'));
    let payload;
    try {
        payload = jwt.verify(token, config.jwtSecret);
        if (payload.typ !== 'access') throw new Error('wrong token type');
    } catch {
        return next(new ApiError(401, 'Invalid or expired token'));
    }
    req.user = { id: payload.sub, tenantId: payload.tid, role: payload.role, name: payload.name, email: payload.email };
    const row = (
        await query(
            `SELECT t.status AS tenant_status, t.enabled_modules, u.is_active, u.token_version, u.role
             FROM tenants t JOIN users u ON u.tenant_id = t.id
             WHERE t.id = $1 AND u.id = $2`,
            [req.user.tenantId, req.user.id],
        )
    ).rows[0];
    if (!row || !row.is_active) return next(new ApiError(401, 'Invalid or expired token'));
    if ((payload.tv ?? 0) !== row.token_version) return next(new ApiError(401, 'Invalid or expired token'));
    if (row.tenant_status === 'suspended')
        return next(new ApiError(403, "This organization's account is suspended. Contact your administrator.", undefined, 'TENANT_SUSPENDED'));
    req.user.role = row.role;
    req.tenant = { status: row.tenant_status, enabledModules: row.enabled_modules ?? [] };
    next();
}

/** Role gate: requireRole('admin','physician'). Admin always passes. */
export const requireRole =
    (...roles) =>
    (req, _res, next) => {
        if (req.user?.role === 'admin' || roles.includes(req.user?.role)) return next();
        next(new ApiError(403, 'You do not have permission to perform this action'));
    };

/**
 * Like requireRole, but `admin` does NOT automatically pass (SEC-17). Reserved for the small set of
 * actions that require an actual clinical credential — signing a note, signing/transmitting a
 * prescription, dispensing via MAR, acknowledging a critical result, signing a discharge summary,
 * attesting medication reconciliation — where "administrator" is not itself a clinical qualification.
 * Everything else (user/tenant management, settings, and every other requireRole() gate in the app)
 * keeps the normal admin-bypass behavior; this is deliberately a separate, narrowly-applied export
 * rather than a change to requireRole itself.
 */
export const requireClinicalRole =
    (...roles) =>
    (req, _res, next) => {
        if (roles.includes(req.user?.role)) return next();
        next(new ApiError(403, 'This action requires a clinical role — an administrator account cannot perform it.'));
    };
