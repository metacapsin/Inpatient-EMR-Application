import type { IRootState } from '../../store';

/** Same keys/values as EMR-Backend `api/services/rbacService.js` ROLE_ALIASES. */
const ROLE_ALIASES: Record<string, string> = {
    super_admin: 'super-admin',
    provider_agent: 'provider-agent',
    'help-desk': 'support-staff',
    helpdesk: 'support-staff',
    doctor: 'provider',
    physician: 'provider',
    nurse: 'clinical-staff',
    receptionist: 'non-clinical-staff',
};

/** Mirror `rbacService.normalizeRole`: lowercase, spaces/underscores → hyphen, then alias. */
function normalizeRoleToken(raw: string): string {
    const normalized = String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
    return ROLE_ALIASES[normalized] ?? normalized;
}

function addRoleChunks(source: string, out: Set<string>): void {
    const parts = source.includes(',')
        ? source.split(',').map((p) => p.trim()).filter(Boolean)
        : [source.trim()].filter(Boolean);
    parts.forEach((p) => out.add(normalizeRoleToken(p)));
}

/**
 * Canonical role strings for UI gates, aligned with EMR-Backend `getNormalizedRolesForUser`.
 * Do not split on spaces: a single value may be `clinical staff` → `clinical-staff`.
 */
export function normalizeRoles(role: string | null | undefined, user: IRootState['auth']['user']): string[] {
    const out = new Set<string>();
    if (role) addRoleChunks(String(role), out);
    const ur = user?.role;
    if (Array.isArray(ur)) {
        ur.filter(Boolean).forEach((r: string) => out.add(normalizeRoleToken(String(r))));
    } else if (typeof ur === 'string' && ur) {
        addRoleChunks(ur, out);
    }
    return Array.from(out);
}

export function canSignPhysicianNote(rolesNorm: string[]): boolean {
    return rolesNorm.some((r) => ['provider', 'admin', 'super-admin'].includes(r));
}

export function canCreateOrders(rolesNorm: string[]): boolean {
    return canSignPhysicianNote(rolesNorm);
}

/** Matches EMR-Backend `canWriteNursingOrHandover` (after rbac normalization, doctor→provider, nurse→clinical-staff). */
export function canNursingActions(rolesNorm: string[]): boolean {
    return rolesNorm.some((r) => ['clinical-staff', 'provider', 'admin', 'super-admin'].includes(r));
}
