import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

function patientIdFromLocalUser(): string | null {
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
}

/**
 * Patient context for APIs: facesheet URL `/app/facesheet/:id/...` wins, else logged-in user patientId/rcopiaID.
 */
export function usePatientId(): string | null {
  const location = useLocation();
  return useMemo(() => {
    const m = location.pathname.match(/^\/app\/facesheet\/([^/]+)/);
    if (m?.[1]) {
      const id = decodeURIComponent(m[1].trim());
      if (id) return id;
    }
    return patientIdFromLocalUser();
  }, [location.pathname]);
}

export default usePatientId;
