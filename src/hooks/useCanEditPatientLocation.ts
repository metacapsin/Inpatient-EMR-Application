import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '../store';

const EDIT_ROLES = new Set([
    'admin',
    'administrator',
    'physician',
    'doctor',
    'provider',
    'nurse',
    'rn',
    'lpn',
    'charge nurse',
    'nurse practitioner',
    'np',
]);

/**
 * Basic RBAC: clinical placement editing for staff roles; read-only otherwise.
 * When no role is present (some dev logins), editing is allowed so flows stay testable.
 */
export function useCanEditPatientLocation(): boolean {
    const roleRaw = useSelector((s: IRootState) => s.auth.role);
    return useMemo(() => {
        if (roleRaw == null || String(roleRaw).trim() === '') return true;
        const role = String(roleRaw).trim().toLowerCase();
        if (EDIT_ROLES.has(role)) return true;
        for (const r of EDIT_ROLES) {
            if (role.includes(r)) return true;
        }
        return false;
    }, [roleRaw]);
}
