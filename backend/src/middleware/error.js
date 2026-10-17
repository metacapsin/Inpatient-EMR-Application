import { ApiError, ZodError, zodToApiError } from '../lib/http.js';
import { isProd } from '../config.js';

export function notFoundHandler(req, _res, next) {
    next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
}

// Postgres error codes we can translate into client errors.
const PG_MAP = {
    '23505': [409, 'A record with these values already exists'],
    '23503': [400, 'Referenced record does not exist or is still in use'],
    '23502': [400, 'A required field is missing'],
    '23514': [400, 'A value is outside the allowed range or set'],
    '22P02': [400, 'A value has an invalid format'],
    '22007': [400, 'A date/time value has an invalid format'],
    '22008': [400, 'A date/time value is out of range'],
};

export function errorHandler(err, _req, res, _next) {
    if (err instanceof ZodError) err = zodToApiError(err);
    if (err?.type === 'entity.parse.failed') err = new ApiError(400, 'Malformed JSON body');
    if (err?.type === 'entity.too.large') err = new ApiError(413, 'Request body too large');

    if (err?.code && PG_MAP[err.code]) {
        const [status, message] = PG_MAP[err.code];
        return res.status(status).json({ status: 'error', message, ...(isProd ? {} : { detail: err.detail }) });
    }
    if (err instanceof ApiError) {
        return res.status(err.status).json({ status: 'error', message: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    console.error('[error]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
}
