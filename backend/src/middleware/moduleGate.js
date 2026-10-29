import { ApiError } from '../lib/http.js';

/**
 * Maps a request path to the tenant-toggleable module that owns it (see Super Admin's
 * "enabled modules" picker in platformAdmin.js). Order matters — more specific rules must come
 * before more general ones for the one real overlap below (/api/discharges/*).
 *
 * This is deliberately a single flat table checked against req.path, NOT a per-router
 * `router.use(...)`. Every protected router in app.js is mounted at "/", so a blanket middleware
 * on any one of them runs for every request that falls through from the routers mounted before
 * it — see the backend-router-middleware-gotcha memory note. A path-based table sidesteps that
 * entirely: unmatched paths (dashboard, appointments, clinicalOps — not part of the module picker,
 * always on) simply fall through with no module requirement.
 */
const MODULE_RULES = [
    // medication's discharge-meds route overlaps adt.js's /api/discharges prefix — must be checked first.
    { module: 'medication', test: (p) => /^\/api\/discharges\/[^/]+\/medications\/?$/.test(p) },
    { module: 'medication', test: (p) => p.startsWith('/api/patients/') && p.includes('/medications') },
    { module: 'medication', test: (p) => /^\/api\/(mar|prn-stat|prescriptions|dispense|discharge)(\/|$)/.test(p) },

    { module: 'adt', test: (p) => /^\/api\/(admissions|transfers|discharges)(\/|$)/.test(p) },
    { module: 'adt', test: (p) => /^\/(Wards|Rooms|Beds)(\/|$)/i.test(p) },
    // Bed management (reservations, EVS turnaround, transfer requests) lives with ADT.
    { module: 'adt', test: (p) => /^\/api\/(beds|bed-reservations|evs|transfer-requests)(\/|$)/.test(p) },

    { module: 'billing', test: (p) => /^\/api\/(CDI|Denial)(\/|$)/i.test(p) },

    { module: 'staffing', test: (p) => /^\/api\/Staffing(\/|$)/i.test(p) },

    { module: 'patients', test: (p) => /^\/(Patient|patient)\//.test(p) },
    { module: 'patients', test: (p) => /^\/(Visitors|PatientFamily)(\/|$)/.test(p) },
    { module: 'patients', test: (p) => p.startsWith('/api/health/metrics') },
    { module: 'patients', test: (p) => /^\/api\/(CarePlan|IORecord|NursingFlowsheet|HAIEvent)(\/|$)/.test(p) },
    { module: 'patients', test: (p) => /^\/api\/(Consent|PatientRights)(\/|$)/.test(p) },
    { module: 'patients', test: (p) => /^\/(lab-orders|LabDetails)(\/|$)/.test(p) },
];

export function resolveModule(path) {
    return MODULE_RULES.find((r) => r.test(path))?.module ?? null;
}

/** Rejects a request if the module that owns its path isn't in the tenant's enabledModules. */
export function requireModuleGate(req, _res, next) {
    const moduleKey = resolveModule(req.path);
    if (!moduleKey) return next();
    if (req.tenant?.enabledModules?.includes(moduleKey)) return next();
    next(new ApiError(403, `The ${moduleKey} module is not enabled for your organization. Contact your Super Admin to enable it.`));
}
