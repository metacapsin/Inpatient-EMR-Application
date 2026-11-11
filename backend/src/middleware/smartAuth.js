// @ts-check
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { q } from '../lib/sql.js';
import { ApiError } from '../lib/http.js';

/**
 * Whether the granted SMART scopes cover `requiredScope`.
 * `patient/*.read` covers any `patient/<Type>.read`.
 * @param {string[]} granted
 * @param {string} [requiredScope]
 */
export function smartScopeAllows(granted, requiredScope) {
    if (!requiredScope) return true;
    if (granted.includes(requiredScope)) return true;
    if (
        requiredScope.startsWith('patient/') &&
        requiredScope.endsWith('.read') &&
        granted.includes('patient/*.read')
    ) {
        return true;
    }
    return false;
}

/**
 * Verifies a SMART access JWT (`typ: 'smart'`), loads the underlying grant, checks revocation and
 * optional scope, and sets `req.smart`. When a `patient` query param is present it must equal the
 * authorized patient id (patient compartment).
 * @param {string} [requiredScope]
 * @returns {import('express').RequestHandler}
 */
export function requireSmartAuth(requiredScope) {
    return async (req, _res, next) => {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');
        if (scheme !== 'Bearer' || !token) return next(new ApiError(401, 'Authentication required'));

        /** @type {import('jsonwebtoken').JwtPayload} */
        let payload;
        try {
            payload = /** @type {import('jsonwebtoken').JwtPayload} */ (jwt.verify(token, config.smartJwtSecret));
            if (payload.typ !== 'smart') throw new Error('wrong token type');
        } catch {
            return next(new ApiError(401, 'Invalid or expired token'));
        }

        const authorizationId = String(payload.aid || '');
        const tenantId = String(payload.tid || '');
        if (!authorizationId || !tenantId) return next(new ApiError(401, 'Invalid or expired token'));

        const grant = (
            await q(
                `SELECT a.*, pa.patient_id, pa.is_active AS account_active
                 FROM smart_authorizations a
                 JOIN patient_accounts pa ON pa.id = a.patient_account_id
                 WHERE a.id = $1 AND a.tenant_id = $2`,
                [authorizationId, tenantId],
            )
        ).rows[0];
        if (!grant || grant.revoked_at || !grant.account_active) {
            return next(new ApiError(401, 'Authorization revoked or inactive'));
        }

        /** @type {string[]} */
        const scopes = Array.isArray(grant.scopes) ? grant.scopes.map(String) : [];
        if (!smartScopeAllows(scopes, requiredScope)) {
            return next(new ApiError(403, `Missing required scope: ${requiredScope}`));
        }

        const patientId = String(grant.patient_id);
        const qPatient = req.query?.patient != null ? String(req.query.patient) : '';
        if (qPatient && qPatient !== patientId) {
            return next(new ApiError(403, 'Patient parameter does not match authorized patient'));
        }

        req.smart = {
            patientId,
            patientAccountId: String(grant.patient_account_id),
            clientId: String(grant.client_id),
            scopes,
            tenantId,
            authorizationId: String(grant.id),
        };
        next();
    };
}
