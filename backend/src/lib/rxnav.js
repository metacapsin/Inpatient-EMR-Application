// @ts-check
/**
 * NLM RxNav drug identity. Pattern mirrors lib/stedi.js:
 *   RXNAV_MODE=live|stub  (stub default in test / when unset for offline safety)
 */
import { z } from 'zod';
import { drugHitSchema } from './cds/schemas.js';
import { ApiError } from './http.js';

/** @typedef {import('./cds/schemas.js').DrugHit} DrugHit */

const MODE = (process.env.RXNAV_MODE || (process.env.NODE_ENV === 'test' ? 'stub' : 'stub')).toLowerCase();
const TIMEOUT_MS = Number(process.env.RXNAV_TIMEOUT_MS || 8000);
const RXNAV_BASE = (process.env.RXNAV_BASE_URL || 'https://rxnav.nlm.nih.gov/REST').replace(/\/$/, '');

/** In-memory teaching stubs — not a clinical formulary. */
const STUB_DRUGS = /** @type {DrugHit[]} */ ([
    { rxnormCode: '11289', name: 'Warfarin', tty: 'IN' },
    { rxnormCode: '1191', name: 'Aspirin', tty: 'IN' },
    { rxnormCode: '5640', name: 'Ibuprofen', tty: 'IN' },
    { rxnormCode: '29046', name: 'Lisinopril', tty: 'IN' },
    { rxnormCode: '8591', name: 'Potassium Chloride', tty: 'IN' },
    { rxnormCode: '723', name: 'Amoxicillin', tty: 'IN' },
    { rxnormCode: '10831', name: 'Sulfamethoxazole / Trimethoprim', tty: 'IN' },
    { rxnormCode: '36567', name: 'Simvastatin', tty: 'IN' },
    { rxnormCode: '703', name: 'Amiodarone', tty: 'IN' },
    { rxnormCode: '6918', name: 'Metoprolol', tty: 'IN' },
    { rxnormCode: '11170', name: 'Verapamil', tty: 'IN' },
    { rxnormCode: '6809', name: 'Metformin', tty: 'IN' },
    { rxnormCode: '161', name: 'Acetaminophen', tty: 'IN' },
    { rxnormCode: '19711', name: 'Atorvastatin', tty: 'IN' },
]);

export const isStub = () => MODE !== 'live';

/**
 * @param {string} term
 * @returns {Promise<DrugHit[]>}
 */
export async function searchDrugs(term) {
    const q = String(term || '').trim();
    if (q.length < 2) return [];

    if (isStub()) {
        const lower = q.toLowerCase();
        return STUB_DRUGS.filter((d) => d.name.toLowerCase().includes(lower) || d.rxnormCode === q).slice(0, 20);
    }

    const url = new URL(`${RXNAV_BASE}/drugs.json`);
    url.searchParams.set('name', q);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new ApiError(502, `RxNav error (${res.status})`, undefined, 'RXNAV_ERROR');
        const data = await res.json();
        /** @type {DrugHit[]} */
        const hits = [];
        const groups = data?.drugGroup?.conceptGroup ?? [];
        for (const g of groups) {
            const tty = g?.tty;
            if (!tty || !['IN', 'SCD', 'SBD', 'BN'].includes(tty)) continue;
            for (const c of g.conceptProperties ?? []) {
                if (!c?.rxcui || !c?.name) continue;
                const parsed = drugHitSchema.safeParse({ rxnormCode: String(c.rxcui), name: String(c.name), tty });
                if (parsed.success) hits.push(parsed.data);
            }
        }
        return hits.slice(0, 25);
    } catch (e) {
        if (e instanceof ApiError) throw e;
        const aborted = /** @type {{name?: string}} */ (e)?.name === 'AbortError';
        throw new ApiError(aborted ? 504 : 502, aborted ? 'RxNav timed out' : 'RxNav unreachable', undefined, aborted ? 'RXNAV_TIMEOUT' : 'RXNAV_UNREACHABLE');
    } finally {
        clearTimeout(timer);
    }
}

/** Re-export schema for routes/tests. */
export { drugHitSchema, z };
