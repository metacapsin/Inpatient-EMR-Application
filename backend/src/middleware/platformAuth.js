import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../lib/http.js';

/**
 * Verifies a Bearer token issued by platform-admin login and sets req.platformAdmin = { id, email }.
 * Structurally parallel to requireAuth, but signed with a distinct secret and `typ` claim so tenant
 * and platform tokens can never be replayed as each other.
 */
export function requirePlatformAuth(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new ApiError(401, 'Authentication required'));
    try {
        const p = jwt.verify(token, config.platformJwtSecret);
        if (p.typ !== 'platform') throw new Error('wrong token type');
        req.platformAdmin = { id: p.sub, email: p.email };
        next();
    } catch {
        next(new ApiError(401, 'Invalid or expired token'));
    }
}
