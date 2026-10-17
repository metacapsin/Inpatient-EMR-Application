/** Shared response unwrapping for EMR list/detail payloads. */

export function asRecord(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

export function unwrapList(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    const o = asRecord(payload);
    if (!o) return [];
    const st = typeof o.status === 'string' ? o.status.toLowerCase() : '';
    if ((st === 'success' || st === 'ok') && o.data !== undefined) {
        return unwrapList(o.data);
    }
    const keys = [
        'data',
        'result',
        'items',
        'wards',
        'rooms',
        'beds',
        'visitors',
        'contacts',
        'familyContacts',
        'list',
        'records',
        'rows',
        'body',
    ] as const;
    for (const k of keys) {
        const v = o[k];
        if (Array.isArray(v)) return v;
    }
    const nested = asRecord(o.data);
    if (nested) {
        for (const k of ['beds', 'rooms', 'wards', 'items', 'list', 'data', 'records', 'result', 'rows'] as const) {
            const v = nested[k];
            if (Array.isArray(v)) return v;
        }
    }
    return [];
}

export function extractIdString(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'object' && v !== null && '$oid' in v && typeof (v as { $oid: unknown }).$oid === 'string') {
        return (v as { $oid: string }).$oid.trim();
    }
    return '';
}

export function pickString(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const v = row[k];
        if (v == null) continue;
        const s = typeof v === 'string' ? v.trim() : String(v).trim();
        if (s) return s;
    }
    return '';
}

/**
 * Reads `{ status: 'success' | 'ok', data: object }` envelopes without coercing `data` to a list.
 * Returns the inner object, or null if the payload is not a success object envelope.
 */
export function unwrapSuccessObjectData(payload: unknown): Record<string, unknown> | null {
    const o = asRecord(payload);
    if (!o) return null;
    const st = typeof o.status === 'string' ? o.status.toLowerCase() : '';
    if (st !== 'success' && st !== 'ok') return null;
    if (o.data === undefined || o.data === null) return null;
    return asRecord(o.data);
}
