import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import api from '../services/api';
import type { IRootState } from '../store';

export type ModuleKey = 'adt' | 'patients' | 'medication' | 'billing' | 'staffing';

/**
 * The tenant's enabled modules (see Super Admin's Tenant Directory). This only drives which nav
 * items are shown — the backend enforces the real boundary (middleware/moduleGate.js returns 403
 * for a disabled module regardless of what the UI shows), so staying permissive while loading (or
 * if the request fails) is safe: it can only make the nav show a link the backend then rejects,
 * never hide something the backend would actually allow.
 */
export function useTenantModules(): { enabledModules: ModuleKey[] | null; isModuleEnabled: (m: ModuleKey) => boolean } {
  const token = useSelector((s: IRootState) => s.auth.token);

  const { data } = useQuery({
    queryKey: ['tenantModules'],
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ data?: { enabledModules?: ModuleKey[] } }>('/tenants/current');
      return res.data?.data?.enabledModules ?? null;
    },
  });

  return {
    enabledModules: data ?? null,
    isModuleEnabled: (m) => data == null || data.includes(m),
  };
}
