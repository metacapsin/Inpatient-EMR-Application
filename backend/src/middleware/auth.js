import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { ApiError } from '../lib/http.js';

/**
 * Verifies the Bearer access token, sets req.user = { id, tenantId, role, name, email }, and loads
 * the tenant's current status/enabledModules onto req.tenant (checked fresh every request — not
 * cached on the JWT — so a Super Admin suspending a tenant takes effect immediately, not just at
 * the token's next refresh). Express 5 forwards a rejected promise from async middleware to the
 * error handler automatically (see lib/http.js's `h` comment), so no try/catch wrapper is needed here.
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
    const t = (await query('SELECT status, enabled_modules FROM tenants WHERE id = $1', [req.user.tenantId])).rows[0];
    if (!t) return next(new ApiError(401, 'Invalid or expired token'));
    if (t.status === 'suspended')
        return next(new ApiError(403, "This organization's account is suspended. Contact your administrator.", undefined, 'TENANT_SUSPENDED'));
    req.tenant = { status: t.status, enabledModules: t.enabled_modules ?? [] };
    next();
}

/** Role gate: requireRole('admin','physician'). Admin always passes. */
export const requireRole =
    (...roles) =>
    (req, _res, next) => {
        if (req.user?.role === 'admin' || roles.includes(req.user?.role)) return next();
        next(new ApiError(403, 'You do not have permission to perform this action'));
    };
