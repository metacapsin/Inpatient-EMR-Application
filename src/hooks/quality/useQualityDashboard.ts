import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getQualityDashboard, evaluateQualityEncounter } from '../../services/quality/qualityMeasure.service';
import { filterDashboardPatients } from '../../mock/quality/qualityMockStore';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { useMemo } from 'react';

export const qualityDashboardQueryKey = (unitId: string) => ['qualityMeasure', 'dashboard', unitId] as const;

export function useQualityDashboard() {
    const unitId = useQualityMeasuresStore((s) => s.unitId);
    const searchQuery = useQualityMeasuresStore((s) => s.searchQuery);

    const query = useQuery({
        queryKey: qualityDashboardQueryKey(unitId),
        queryFn: () => getQualityDashboard(unitId),
        staleTime: 30_000,
    });

    const filteredPatients = useMemo(() => {
        if (!query.data?.patients) return [];
        return filterDashboardPatients(query.data.patients, searchQuery);
    }, [query.data?.patients, searchQuery]);

    return { ...query, filteredPatients, unitId };
}

export function useRefreshQualityDashboard() {
    const queryClient = useQueryClient();
    const unitId = useQualityMeasuresStore((s) => s.unitId);

    return async () => {
        await queryClient.invalidateQueries({ queryKey: qualityDashboardQueryKey(unitId) });
    };
}

export async function runEvaluateAndRefresh(
    encounterId: string,
    queryClient: ReturnType<typeof useQueryClient>,
    unitId: string,
) {
    await evaluateQualityEncounter(encounterId);
    await queryClient.invalidateQueries({ queryKey: qualityDashboardQueryKey(unitId) });
}
