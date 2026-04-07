import type { AxiosError } from 'axios';

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

/**
 * Extracts a user-facing message from axios errors and common API error bodies.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
    if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        return error.message || fallback;
    }
    const ax = error as AxiosError<unknown>;
    const status = ax.response?.status;
    const d = ax.response?.data;

    if (d != null && typeof d === 'string' && d.trim()) {
        return d.trim().slice(0, 500);
    }

    if (isRecord(d)) {
        const msg = d.message;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
        const err = d.error;
        if (typeof err === 'string' && err.trim()) return err.trim();
        if (isRecord(err) && typeof err.message === 'string') return err.message;

        const errors = d.errors;
        if (Array.isArray(errors) && errors.length) {
            return errors.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ');
        }
        if (isRecord(errors)) {
            const parts: string[] = [];
            for (const v of Object.values(errors)) {
                if (Array.isArray(v)) parts.push(...v.map(String));
                else if (v != null) parts.push(String(v));
            }
            if (parts.length) return parts.join('; ');
        }
    }

    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 409) {
        if (isRecord(d) && typeof d.message === 'string' && d.message.trim()) return d.message.trim();
        return 'This conflicts with current data (for example, the bed may already be occupied). Refresh and try again.';
    }
    if (status === 400) {
        if (isRecord(d) && typeof d.message === 'string' && d.message.trim()) return d.message.trim();
        return 'Invalid request. Check required fields and try again.';
    }

    return ax.message || fallback;
}
