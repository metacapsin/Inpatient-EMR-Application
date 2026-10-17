import type { IRootState } from '../../store';
import { normalizeRoles } from '../clinical-workflows/clinicalRole';

export function canViewStaffSchedule(role: string | null | undefined, user: IRootState['auth']['user']): boolean {
    const roles = normalizeRoles(role, user);
    return roles.length > 0;
}

export function canManageStaffSchedule(role: string | null | undefined, user: IRootState['auth']['user']): boolean {
    const roles = normalizeRoles(role, user);
    return roles.some((r) =>
        ['admin', 'super-admin', 'non-clinical-staff'].includes(r)
    );
}
