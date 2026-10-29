/**
 * Thin fetch wrapper around Stedi's Healthcare APIs (ported from EMR-Backend/api/services/stedi.js).
 *   - healthcare.us.stedi.com/2024-04-01 → real-time eligibility (270/271)
 *   - payers.us.stedi.com/2024-04-01     → payer directory (search, get)
 * Owns the API key, base URLs, timeouts, error normalization and PHI-redacted logging.
 */
import { config } from '../config.js';
import { ApiError } from './http.js';

/**
 * Upstream failure surfaced to the client as a gateway error (never a 500): 503 when the integration
 * is off, 504 on timeout, otherwise 502 with Stedi's own message/field list as `details`.
 */
export class StediError extends ApiError {
    constructor(message, { status = null, stediError = null, code = 'STEDI_ERROR' } = {}) {
        const httpStatus = code === 'STEDI_DISABLED' ? 503 : code === 'STEDI_TIMEOUT' ? 504 : 502;
        super(httpStatus, message, stediError ?? undefined, code);
        this.upstreamStatus = status;
        this.stediError = stediError;
    }
}

export const isEnabled = () => config.stedi.enabled;

const PHI_KEYS = new Set(['memberId', 'subscriberId', 'dateOfBirth', 'dob', 'ssn']);
export function redactPhi(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = JSON.parse(JSON.stringify(obj));
    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        for (const k of Object.keys(node)) {
            if (PHI_KEYS.has(k)) node[k] = '***REDACTED***';
            else if (typeof node[k] === 'object') walk(node[k]);
        }
    };
    walk(clone);
    return clone;
}

async function request(baseUrl, path, { method = 'GET', body, params } = {}) {
    if (!isEnabled()) throw new StediError('Stedi integration disabled (no STEDI_API_KEY)', { code: 'STEDI_DISABLED', status: 503 });
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.stedi.timeoutMs);
    let res;
    try {
        res = await fetch(url, {
            method,
            headers: { Authorization: `Key ${config.stedi.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch (e) {
        throw new StediError(e.name === 'AbortError' ? 'Stedi API timed out' : `Stedi API unreachable: ${e.cause?.message || e.message}`, { code: e.name === 'AbortError' ? 'STEDI_TIMEOUT' : 'STEDI_UNREACHABLE' });
    } finally {
        clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText;
        throw new StediError(`Stedi API error (${res.status}): ${msg}`, { status: res.status, stediError: data });
    }
    return data ?? {};
}

/** POST /change/medicalnetwork/eligibility/v3 — real-time 270/271 as JSON. */
export async function realtimeEligibility(payload) {
    console.info('[stedi] 270 →', JSON.stringify(redactPhi(payload)));
    const data = await request(config.stedi.healthcareBaseUrl, '/change/medicalnetwork/eligibility/v3', { method: 'POST', body: payload });
    console.info('[stedi] 271 ←', JSON.stringify({
        payer: data.payer?.name,
        planStatus: (data.planStatus ?? []).map((p) => ({ code: p.statusCode, status: p.status })),
        benefits: Array.isArray(data.benefitsInformation) ? data.benefitsInformation.length : 0,
        errors: data.errors,
    }));
    return data;
}

/** GET /payers/search — fuzzy match on payer name / id / alias. */
export function searchPayers({ query, pageSize, pageToken, eligibilityCheck, claimSubmission } = {}) {
    // Stedi validates pageSize to 10..100; the UI asks for fewer and trims client-side.
    const size = pageSize ? Math.min(100, Math.max(10, Number(pageSize))) : undefined;
    return request(config.stedi.payersBaseUrl, '/payers/search', { params: { query, pageSize: size, pageToken, eligibilityCheck, claimSubmission } });
}

/** GET /payer/{stediId}. */
export function getPayer(stediId) {
    return request(config.stedi.payersBaseUrl, `/payer/${encodeURIComponent(stediId)}`);
}
