import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLastIoDataSource } from '../api/ioRecordWithFallback';
import { USE_IO_MOCK } from '../config/ioMock.config';
import { getMockIoSnapshot } from '../mock/ioMockApi';
import { addIoRecord, getIoBalance, getIoTimeline } from '../../../services/ioRecord.service';
import type { IoAddIntakePayload, IoAddOutputPayload, IoBalanceSummary } from '../types/ioRecord.types';
import { publishIoBalanceForClinical, publishUrineOutputForQuality } from '../clinical/ioClinicalBridge';

const EMPTY_BALANCE: IoBalanceSummary = {
    intake8hMl: 0,
    output8hMl: 0,
    balance8hMl: 0,
    intake24hMl: 0,
    output24hMl: 0,
    balance24hMl: 0,
    urineOutputLastHourMl: 0,
};

export function useIoTracking(encounterId: string) {
    const queryClient = useQueryClient();
    const enabled = Boolean(encounterId.trim());

    const balanceQuery = useQuery({
        queryKey: ['ioBalance', encounterId],
        queryFn: () => getIoBalance(encounterId),
        enabled,
        staleTime: 30_000,
        retry: USE_IO_MOCK ? false : 2,
    });

    const timelineQuery = useQuery({
        queryKey: ['ioTimeline', encounterId],
        queryFn: () => getIoTimeline(encounterId),
        enabled,
        staleTime: 30_000,
        retry: USE_IO_MOCK ? false : 2,
    });

    const syncMockCache = useCallback(() => {
        const { balance, timeline } = getMockIoSnapshot(encounterId);
        queryClient.setQueryData(['ioBalance', encounterId], balance);
        queryClient.setQueryData(['ioTimeline', encounterId], timeline);
        publishIoBalanceForClinical(encounterId, balance);
        publishUrineOutputForQuality(encounterId, balance.urineOutputLastHourMl);
    }, [queryClient, encounterId]);

    const refreshSummary = useCallback(async () => {
        if (USE_IO_MOCK && getLastIoDataSource(encounterId) === 'mock') {
            syncMockCache();
            return;
        }
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['ioBalance', encounterId] }),
            queryClient.invalidateQueries({ queryKey: ['ioTimeline', encounterId] }),
        ]);
    }, [queryClient, encounterId, syncMockCache]);

    const addMutation = useMutation({
        mutationFn: (payload: IoAddIntakePayload | IoAddOutputPayload) => addIoRecord(payload),
        onSuccess: async () => {
            if (USE_IO_MOCK && getLastIoDataSource(encounterId) === 'mock') {
                syncMockCache();
                return;
            }
            await refreshSummary();
        },
    });

    const summary = balanceQuery.data ?? EMPTY_BALANCE;

    const balanceLoading =
        enabled && balanceQuery.isPending && !balanceQuery.data && !balanceQuery.isError;
    const timelineLoading =
        enabled && timelineQuery.isPending && !timelineQuery.data && !timelineQuery.isError;

    useEffect(() => {
        if (!enabled || !balanceQuery.data) return;
        publishIoBalanceForClinical(encounterId, balanceQuery.data);
        publishUrineOutputForQuality(encounterId, balanceQuery.data.urineOutputLastHourMl);
    }, [enabled, encounterId, balanceQuery.data]);

    return {
        summary,
        timeline: timelineQuery.data ?? [],
        balanceLoading,
        balanceFetching: balanceQuery.isFetching,
        timelineLoading,
        timelineFetching: timelineQuery.isFetching,
        balanceError: balanceQuery.isError && !USE_IO_MOCK,
        timelineError: timelineQuery.isError && !USE_IO_MOCK,
        addRecord: addMutation.mutateAsync,
        adding: addMutation.isPending,
        refreshSummary,
    };
}
