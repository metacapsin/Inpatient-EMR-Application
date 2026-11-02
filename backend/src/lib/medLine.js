import { z } from 'zod';

/**
 * Shared "medication line" contract (plan §2a). One shape is used by e-prescribing (`prescriptions.medicines`),
 * medication reconciliation (`medication_reconciliations.lines`) and the discharge summary snapshot, so the
 * three modules never need a mapping layer between them. Extends the pre-existing discharge_medications line
 * (`name, dose, frequency, duration, instructions`) rather than replacing it.
 */
const optStr = (max) => z.preprocess((v) => (v === null || v === undefined ? undefined : String(v)), z.string().trim().max(max).optional());
const optInt = (max) => z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().min(0).max(max).optional());

export const medLineSchema = z.object({
    name: z.string().trim().min(1).max(200),
    rxnormCode: optStr(20),
    dose: optStr(100).default(''),
    route: optStr(50),
    frequency: optStr(100).default(''),
    duration: optStr(100),
    instructions: optStr(1000),
    quantity: optInt(100000),
    refills: optInt(99),
    source: z.enum(['home', 'inpatient', 'discharge']).optional(),
});

/** Normalises a line for JSON storage: blank optionals become '' so the UI never sees null/undefined. */
export function medLineOut(l) {
    return {
        name: l.name,
        rxnormCode: l.rxnormCode ?? '',
        dose: l.dose ?? '',
        route: l.route ?? '',
        frequency: l.frequency ?? '',
        duration: l.duration ?? '',
        instructions: l.instructions ?? '',
        quantity: l.quantity ?? null,
        refills: l.refills ?? null,
        source: l.source ?? undefined,
    };
}

/** Human-readable one-liner, e.g. "Lisinopril 10 mg PO Daily × 30 days — take in the morning". */
export function medLineText(l) {
    const head = [l.name, l.dose, l.route, l.frequency].filter(Boolean).join(' ');
    const dur = l.duration ? ` × ${l.duration}` : '';
    const sig = l.instructions ? ` — ${l.instructions}` : '';
    return `${head}${dur}${sig}`;
}
