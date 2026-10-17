import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate every React Query surface that shows ADT-derived occupancy or placement.
 * Call after admit, transfer, or discharge mutations (single choke point).
 */
export function invalidateAdtSurfaces(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: ['liveBedBoard'] });
    void queryClient.invalidateQueries({ queryKey: ['beds', 'emr-list'] });
    void queryClient.invalidateQueries({ queryKey: ['patient-placement'] });
    void queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] });
    void queryClient.invalidateQueries({ queryKey: ['facility'] });
    void queryClient.invalidateQueries({ queryKey: ['activeEncounters'] });
    void queryClient.invalidateQueries({ queryKey: ['ipdDashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['dischargeFinalizeReadiness'] });
}
