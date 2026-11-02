import { ApiError } from './http.js';

/**
 * e-Prescribing transmission adapter (Phase B hook). Mirrors lib/stedi.js: ERX_MODE selects the backend —
 *   stub    (default) no vendor; "transmit" flips the row to transmitted with a fake reference and logs the payload
 *   sandbox / live    reserved for the DrFirst Rcopia / Surescripts adapter; until a contract exists they refuse
 * so a misconfigured deployment can never silently pretend a prescription was sent.
 */
export const ERX_MODE = (process.env.ERX_MODE || 'stub').toLowerCase();
export const isStub = () => ERX_MODE === 'stub';

/** Hooks run before a prescription is signed (CDS interaction check #9, PDMP #70 plug in here). Each may throw ApiError. */
const beforeSignHooks = [];
export const onBeforeSign = (fn) => beforeSignHooks.push(fn);
export async function runBeforeSign(ctx) {
    for (const fn of beforeSignHooks) await fn(ctx);
}

const nextRef = () => `STUB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Returns { ref, mode }. Throws ApiError(503, ERX_NOT_CONFIGURED) when a vendor mode has no adapter yet. */
export async function transmit({ prescription, pharmacy }) {
    if (isStub()) {
        const ref = nextRef();
        console.log(`[erx:stub] would transmit prescription ${prescription.id} to ${pharmacy?.name ?? 'pharmacy'} (NCPDP ${pharmacy?.ncpdp_id ?? '?'}) ref=${ref}`);
        return { ref, mode: 'stub' };
    }
    throw new ApiError(503, `e-Prescribing vendor transmission is not configured (ERX_MODE=${ERX_MODE})`, undefined, 'ERX_NOT_CONFIGURED');
}
