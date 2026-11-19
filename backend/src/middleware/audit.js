import { recordAuditEvent } from '../lib/audit.js';

/** Paths that would otherwise dominate the log with no investigative value (polling, not actions). */
const SKIP_PREFIXES = ['/notifications', '/tenants/current', '/api/ai/status'];

function shouldSkip(req) {
    if (req.method === 'OPTIONS') return true;
    return SKIP_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`));
}

/** '/api/patients/123/problems' -> 'patients'; '/Wards/getWardList' -> 'Wards'. */
function deriveResource(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'api') parts.shift();
    return parts[0] || null;
}

function derivePatientId(req) {
    const p = req.params || {};
    if (p.patientId) return String(p.patientId);
    if (p.id && (/^\/Patient\//i.test(req.path) || /^\/api\/patients\//.test(req.path))) return String(p.id);
    const q = req.query || {};
    if (q.patientId) return String(q.patientId);
    if (q.rcopiaID) return String(q.rcopiaID);
    const b = req.body || {};
    if (b && typeof b === 'object') {
        if (b.patientId) return String(b.patientId);
        if (b.rcopiaID) return String(b.rcopiaID);
    }
    return null;
}

function deriveEncounterId(req) {
    const p = req.params || {};
    if (p.encounterId) return String(p.encounterId);
    const q = req.query || {};
    if (q.encounterId) return String(q.encounterId);
    const b = req.body || {};
    if (b && typeof b === 'object' && b.encounterId) return String(b.encounterId);
    return null;
}

const METHOD_ACTION = { GET: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

/**
 * Per-request audit logger. Mounted once, right after `requireAuth` (so it also runs ahead of
 * `requireModuleGate` and captures the 403 a disabled module produces), and once at the top of
 * `platformAdminRouter` for the Super Admin branch, which never passes through `requireAuth`.
 *
 * One row per request, written on `res.on('finish', ...)` so the final status code and timing are
 * known; the write itself is fire-and-forget (see lib/audit.js) and never blocks or fails the
 * response. Routes that need a richer, hand-written event (login, tenant delete, SMART
 * authorization) call `recordAuditEvent` directly elsewhere — this middleware is the floor every
 * other authenticated request gets for free.
 */
export function auditMiddleware(req, res, next) {
    if (shouldSkip(req)) return next();
    const startedAt = Date.now();
    res.on('finish', () => {
        const isPlatform = Boolean(req.platformAdmin);
        const actorType = isPlatform ? 'platform_admin' : req.user ? 'staff' : 'anonymous';
        // Never guess a tenant_id for the platform branch: req.params.id is often the tenant the
        // request just acted on, and for a delete it may no longer exist by the time this fires on
        // res.on('finish'), which would violate the FK. The explicit recordAuditEvent() calls in
        // platformAdmin.js carry the real, correctly-timed tenant linkage for the events that need it.
        recordAuditEvent({
            tenantId: isPlatform ? null : req.user?.tenantId ?? null,
            actorType,
            actorId: isPlatform ? req.platformAdmin?.id : req.user?.id,
            actorRole: isPlatform ? 'platform_admin' : req.user?.role,
            action: isPlatform ? 'platform' : METHOD_ACTION[req.method] || 'read',
            resource: deriveResource(req.path),
            resourceId: req.params?.id ?? null,
            patientId: derivePatientId(req),
            encounterId: deriveEncounterId(req),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            latencyMs: Date.now() - startedAt,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            queryKeys: Object.keys(req.query || {}),
        });
    });
    next();
}
