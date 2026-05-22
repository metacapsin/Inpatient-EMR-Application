import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BundleKey, UpdateMeasureElementPayload } from '../../types/quality';
import {
    getQualityEncounterMeasure,
    updateQualityMeasureElement,
} from '../../services/quality/qualityMeasure.service';
import { qualityDashboardQueryKey } from './useQualityDashboard';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { toast } from '@/lib/utils';
import { QUALITY_STAFF_OPTIONS } from '../../constants/quality/staff';

export const qualityEncounterQueryKey = (
    encounterId: string,
    bundleKey: BundleKey,
) => ['qualityMeasure', 'encounter', encounterId, bundleKey] as const;

export function useQualityEncounterDetail(
    encounterId: string | undefined,
    bundleKey: BundleKey | undefined,
    enabled: boolean,
) {
    return useQuery({
        queryKey:
            encounterId && bundleKey
                ? qualityEncounterQueryKey(encounterId, bundleKey)
                : ['qualityMeasure', 'encounter', 'idle'],
        queryFn: () =>
            getQualityEncounterMeasure(encounterId!, bundleKey!),
        enabled: Boolean(enabled && encounterId && bundleKey),
        staleTime: 15_000,
    });
}

export function useUpdateMeasureElement(measureId: string | undefined) {
    const queryClient = useQueryClient();
    const unitId = useQualityMeasuresStore((s) => s.unitId);
    const selected = useQualityMeasuresStore((s) => s.selectedBundle);

    return useMutation({
        mutationFn: (payload: UpdateMeasureElementPayload) => {
            if (!measureId) throw new Error('measureId required');
            return updateQualityMeasureElement(measureId, payload);
        },
        onMutate: async (payload) => {
            if (!selected?.encounterId || !selected.bundleKey) return;
            const key = qualityEncounterQueryKey(selected.encounterId, selected.bundleKey);
            await queryClient.cancelQueries({ queryKey: key });
            const prev = queryClient.getQueryData(key);
            queryClient.setQueryData(key, (old: typeof prev) => {
                if (!old || typeof old !== 'object' || !('elements' in old)) return old;
                const data = old as { elements: { id: string; assignTo?: string | null; notes?: string | null }[] };
                return {
                    ...data,
                    elements: data.elements.map((el) =>
                        el.id === payload.elementId
                            ? {
                                  ...el,
                                  ...(payload.assignTo !== undefined
                                      ? { assignTo: payload.assignTo }
                                      : {}),
                                  ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
                              }
                            : el,
                    ),
                };
            });
            return { prev, key };
        },
        onError: (_err, _payload, ctx) => {
            if (ctx?.prev && ctx.key) queryClient.setQueryData(ctx.key, ctx.prev);
            toast.error('Failed to update bundle element.');
        },
        onSuccess: (res, _payload, ctx) => {
            if (ctx?.key) {
                queryClient.setQueryData(ctx.key, (old: unknown) => {
                    if (!old || typeof old !== 'object' || !('elements' in old)) return old;
                    const data = old as { elements: { id: string }[] };
                    return {
                        ...data,
                        elements: data.elements.map((el) =>
                            el.id === res.element.id ? res.element : el,
                        ),
                    };
                });
            }
            queryClient.invalidateQueries({ queryKey: qualityDashboardQueryKey(unitId) });
        },
    });
}

export function useAssignElementTask(measureId: string | undefined) {
    const mutation = useUpdateMeasureElement(measureId);

    return {
        ...mutation,
        assign: async (elementId: string, assignTo: string) => {
            await mutation.mutateAsync({ elementId, assignTo });
            const name =
                QUALITY_STAFF_OPTIONS.find((s) => s.id === assignTo)?.name ?? assignTo;
            toast.success('Task assignment notification sent.', {
                description: `Assigned to ${name}`,
            });
        },
    };
}
