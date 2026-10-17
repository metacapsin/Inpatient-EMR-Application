import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { IRootState } from '../store';

function pickStringId(obj: unknown, keys: string[]): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const r = obj as Record<string, unknown>;
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
}

function patientIdFromLocalStorageUser(): string | null {
    try {
        const s = localStorage.getItem('user');
        if (!s) return null;
        const u = JSON.parse(s) as unknown;
        return pickStringId(u, ['patientId', 'rcopiaID', 'patient_id']);
    } catch {
        return null;
    }
}

/** Resolves portal patient id from Redux (user + patientData) with localStorage user fallback. */
export function usePatientPortalId(): string | null {
    const user = useSelector((s: IRootState) => s.auth.user);
    const patientData = useSelector((s: IRootState) => s.auth.patientData);

    return useMemo(() => {
        const fromUser = pickStringId(user, ['patientId', 'rcopiaID', 'patient_id']);
        if (fromUser) return fromUser;

        const blob = patientData && typeof patientData === 'object' ? (patientData as Record<string, unknown>) : null;
        const inner = blob?.data && typeof blob.data === 'object' ? (blob.data as Record<string, unknown>) : blob;
        const fromPatient = pickStringId(inner, ['patientId', 'rcopiaID', 'id']);
        if (fromPatient) return fromPatient;

        return patientIdFromLocalStorageUser();
    }, [user, patientData]);
}
