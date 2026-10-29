import { ZodError } from 'zod';

export class ApiError extends Error {
    /** `code` is an optional stable machine-readable marker (e.g. 'TENANT_SUSPENDED') for cases
     *  where the frontend needs to react to a specific error, not just display its message. */
    constructor(status, message, details, code) {
        super(message);
        this.status = status;
        this.details = details;
        this.code = code;
    }
}

export const badRequest = (m, d) => new ApiError(400, m, d);
export const notFound = (m = 'Not found') => new ApiError(404, m);
export const conflict = (m) => new ApiError(409, m);
export const forbidden = (m = 'Forbidden') => new ApiError(403, m);

/** Wrap async route handlers so rejections reach the error middleware (Express 5 does this too; kept explicit). */
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate `data` against a zod schema, throwing a 400 ApiError with field details. */
export function parse(schema, data) {
    const r = schema.safeParse(data);
    if (!r.success) throw zodToApiError(r.error);
    return r.data;
}

export function zodToApiError(err) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = details[0];
    return new ApiError(400, first ? `${first.path ? first.path + ': ' : ''}${first.message}` : 'Validation failed', details);
}

export const ok = (res, data, extra = {}) => res.json({ status: 'success', data, ...extra });
export const created = (res, data, extra = {}) => res.status(201).json({ status: 'success', data, ...extra });

const camelKey = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * snake_case row -> camelCase object; adds `_id` mirror of `id` because the frontend normalizers
 * accept both. JSONB columns keep their inner keys untouched.
 */
export function row(r) {
    if (!r) return r;
    const out = {};
    for (const [k, v] of Object.entries(r)) {
        out[camelKey(k)] = v instanceof Date ? v.toISOString() : v;
    }
    if (out.id !== undefined && out._id === undefined) out._id = out.id;
    return out;
}
export const rows = (list) => list.map(row);

export { ZodError };
