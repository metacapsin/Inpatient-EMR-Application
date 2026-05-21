import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { FacilityManagementNav } from '../../components/evs/FacilityManagementNav';
import { EVSAssignModal } from '../../components/evs/EVSAssignModal';
import { EVSEmptyState } from '../../components/evs/EVSEmptyState';
import { EVSMetricsBar } from '../../components/evs/EVSMetricsBar';
import { EVSQueueTable } from '../../components/evs/EVSQueueTable';
import { InfectionDeepCleaningBanner } from '../../components/evs/InfectionDeepCleaningBanner';
import { useQueueTimerTick } from '../../components/evs/useQueueTimerTick';
import type { EvsQueueActionId } from '../../components/evs/evsQueueUtils';
import type { EvsQueueItem } from '../../types/evs';
import {
    approveCleaning,
    assignHousekeeper,
    completeCleaning,
    getMetrics,
    getQueue,
    inspectBed,
    startCleaning,
} from '../../services/evsMockService';

const QUEUE_KEY = ['evs', 'queue'] as const;
const METRICS_KEY = ['evs', 'metrics'] as const;

const EVSQueuePage = () => {
    const queryClient = useQueryClient();
    const nowTick = useQueueTimerTick();
    const [assignTarget, setAssignTarget] = useState<EvsQueueItem | null>(null);
    const [actionPendingId, setActionPendingId] = useState<string | null>(null);

    const queueQuery = useQuery({
        queryKey: QUEUE_KEY,
        queryFn: getQueue,
        staleTime: 5_000,
    });

    const metricsQuery = useQuery({
        queryKey: METRICS_KEY,
        queryFn: getMetrics,
        staleTime: 5_000,
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ['evs'] });
        void queryClient.invalidateQueries({ queryKey: ['liveBedBoard'] });
        void queryClient.invalidateQueries({ queryKey: ['evs', 'bedMap'] });
    }, [queryClient]);

    const assignMutation = useMutation({
        mutationFn: assignHousekeeper,
        onSuccess: () => {
            toast.success('Housekeeper assigned');
            setAssignTarget(null);
            invalidate();
        },
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => setActionPendingId(null),
    });

    const runAction = useMutation({
        mutationFn: async ({ action, item }: { action: EvsQueueActionId; item: EvsQueueItem }) => {
            switch (action) {
                case 'start':
                    return startCleaning(item.id);
                case 'complete':
                    return completeCleaning(item.id);
                case 'inspect':
                    return inspectBed({ queueItemId: item.id, inspectedBy: 'Charge Nurse (mock)' });
                case 'approve':
                    return approveCleaning(item.id);
                default:
                    throw new Error('Unknown action');
            }
        },
        onSuccess: (_, { action }) => {
            const labels: Record<string, string> = {
                start: 'Cleaning started',
                complete: 'Sent for inspection',
                inspect: 'Inspection recorded',
                approve: 'Bed marked clean',
            };
            toast.success(labels[action] ?? 'Updated');
            invalidate();
        },
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => setActionPendingId(null),
    });

    const handleAction = (action: EvsQueueActionId, item: EvsQueueItem) => {
        if (action === 'assign') {
            setAssignTarget(item);
            return;
        }
        setActionPendingId(item.id);
        runAction.mutate({ action, item });
    };

    const items = queueQuery.data ?? [];
    const loading = queueQuery.isLoading && !queueQuery.data;

    return (
        <div className="panel flex min-h-0 flex-1 flex-col">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
                <Link to="/app/dashboard" className="text-primary hover:underline">
                    Dashboard
                </Link>
                <span className="text-gray-400">/</span>
                <Link to="/app/settings" className="text-primary hover:underline">
                    Settings
                </Link>
                <span className="text-gray-400">/</span>
                <span className="font-medium text-gray-900 dark:text-white">EVS queue</span>
            </div>

            <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-primary/25">
                    <Sparkles className="h-5 w-5" aria-hidden />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EVS / bed turnaround</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Track discharged beds through cleaning and inspection. Mock data only — backend integration
                        pending.
                    </p>
                </div>
            </div>

            <FacilityManagementNav />

            <EVSMetricsBar metrics={metricsQuery.data} loading={metricsQuery.isLoading && !metricsQuery.data} />

            <InfectionDeepCleaningBanner />

            <div className="mt-4 flex min-h-[20rem] flex-1 flex-col">
                {!loading && items.length === 0 ? <EVSEmptyState /> : null}
                {loading || items.length > 0 ? (
                    <EVSQueueTable
                        items={items}
                        loading={loading}
                        nowTick={nowTick}
                        actionPendingId={actionPendingId}
                        onAction={handleAction}
                    />
                ) : null}
            </div>

            <EVSAssignModal
                open={Boolean(assignTarget)}
                bedLabel={assignTarget?.roomBedLabel ?? ''}
                onClose={() => setAssignTarget(null)}
                loading={assignMutation.isPending}
                onConfirm={(housekeeperId, housekeeperName) => {
                    if (!assignTarget) return;
                    setActionPendingId(assignTarget.id);
                    assignMutation.mutate({
                        queueItemId: assignTarget.id,
                        housekeeperId,
                        housekeeperName,
                    });
                }}
            />
        </div>
    );
};

export default EVSQueuePage;
