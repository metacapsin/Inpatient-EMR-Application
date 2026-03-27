import { useMemo } from 'react';

/**
 * Returns the current patient ID from localStorage user (patientId or rcopiaID).
 * Use this for all Health Monitoring API calls so patient context is consistent.
 */
export function usePatientId(): string | null {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const user = JSON.parse(raw) as Record<string, unknown>;
      const sub = user.user as Record<string, unknown> | undefined;
      const id =
        (user.patientId as string) ||
        (user.rcopiaID as string) ||
        (sub?.patientId as string) ||
        (sub?.rcopiaID as string);
      return id && String(id).trim() ? String(id).trim() : null;
    } catch {
      return null;
    }
  }, []);
}

export default usePatientId;
