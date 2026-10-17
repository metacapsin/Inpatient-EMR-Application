import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../lib/http.js';

/** Verifies the Bearer access token and sets req.user = { id, tenantId, role, name, email }. */
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new ApiError(401, 'Authentication required'));
    try {
        const p = jwt.verify(token, config.jwtSecret);
        if (p.typ !== 'access') throw new Error('wrong token type');
        req.user = { id: p.sub, tenantId: p.tid, role: p.role, name: p.name, email: p.email };
        next();
    } catch {
        next(new ApiError(401, 'Invalid or expired token'));
    }
}

/** Role gate: requireRole('admin','physician'). Admin always passes. */
export const requireRole =
    (...roles) =>
    (req, _res, next) => {
        if (req.user?.role === 'admin' || roles.includes(req.user?.role)) return next();
        next(new ApiError(403, 'You do not have permission to perform this action'));
    };
