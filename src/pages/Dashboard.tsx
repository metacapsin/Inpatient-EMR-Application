import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FaClipboardList } from 'react-icons/fa';
import { IpdAlertsStrip } from '../components/ipd/IpdAlertsStrip';
import { StaffCoverageWidget } from '../components/ipd/StaffCoverageWidget';
import { IpdBedBoardTable } from '../components/ipd/IpdBedBoardTable';
import { IpdKpiRow } from '../components/ipd/IpdKpiRow';
import { IpdPatientDetailsPanel } from '../components/ipd/IpdPatientDetailsPanel';
import { IpdTransferModal } from '../components/ipd/IpdTransferModal';
import { fetchIpdDashboard } from '../services/ipdDashboard.service';
import { formatAdtUserMessage, transferPatient } from '../services/adtWorkflowService';
import type { AppDispatch } from '../store';
import type { IpdBedRow, IpdDashboardPayload } from '../types/ipdDashboard';

const emptyPayload = (): IpdDashboardPayload => ({
    kpis: {
        totalAdmittedPatients: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        dischargedToday: 0,
    },
    bedBoard: [],
    alerts: { criticalPatients: [], bedsPendingCleaning: [], transferRequests: [] },
});

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);

    const dashboardQuery = useQuery({
        queryKey: ['ipdDashboard'],
        queryFn: async () => {
            const result = await fetchIpdDashboard();
            if (!result.ok) throw new Error(result.message);
            return result.data;
        },
    });

    useEffect(() => {
        if (dashboardQuery.isError && dashboardQuery.error instanceof Error) {
            toast.error(dashboardQuery.error.message);
        }
    }, [dashboardQuery.isError, dashboardQuery.error]);

    const payload = dashboardQuery.data ?? emptyPayload();
    const loading = dashboardQuery.isLoading && !dashboardQuery.data;

    useEffect(() => {
        if (!dashboardQuery.data) return;
        setSelectedId((prev) => {
            if (!prev) return null;
            return dashboardQuery.data!.bedBoard.some((r) => r.id === prev) ? prev : null;
        });
    }, [dashboardQuery.data]);

    const selectedRow = useMemo(
        () => (selectedId ? payload.bedBoard.find((r) => r.id === selectedId) ?? null : null),
        [payload.bedBoard, selectedId]
    );

    const transferMutation = useMutation({
        mutationFn: async ({ newBedId, reason }: { newBedId: string; reason: string }) => {
            if (!selectedRow?.encounterId) throw new Error('No encounter for transfer');
            const ctx = { dispatch, queryClient };
            return transferPatient(ctx, {
                encounterId: selectedRow.encounterId,
                newBedId,
                reason: reason || undefined,
                patientId: selectedRow.patientId ?? undefined,
            });
        },
        onSuccess: (res) => {
            if (!res.ok) {
                toast.error(formatAdtUserMessage(res));
                return;
            }
            toast.success(res.message || 'Transfer completed');
            setTransferOpen(false);
            void dashboardQuery.refetch();
        },
        onError: (e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Transfer failed');
        },
    });

    const onSelectRow = useCallback((row: IpdBedRow) => {
        setSelectedId(row.id);
    }, []);

    const onTransferClick = useCallback(() => {
        if (!selectedRow?.encounterId) return;
        setTransferOpen(true);
    }, [selectedRow?.encounterId]);

    const onStartDischargeClick = useCallback(() => {
        if (!selectedRow?.encounterId) return;
        const qs = new URLSearchParams();
        qs.set('encounterId', selectedRow.encounterId);
        if (selectedRow.patientId) qs.set('patientId', selectedRow.patientId);
        navigate(`/app/inpatient/discharge-readiness?${qs.toString()}`);
    }, [selectedRow, navigate]);

    const onTransferConfirm = useCallback(
        async (newBedId: string, reason: string) => {
            transferMutation.mutate({ newBedId, reason });
        },
        [transferMutation]
    );

    if (loading && payload.bedBoard.length === 0 && !payload.kpis.totalAdmittedPatients) {
        return (
            <div className="flex flex-1 min-h-0 items-center justify-center rounded-xl border border-white-light dark:border-dark bg-white/50 dark:bg-black/10">
                <div className="text-center">
                    <div className="relative mx-auto w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                        <div className="absolute inset-2 rounded-full bg-primary/5 flex items-center justify-center">
                            <FaClipboardList className="text-primary text-base" />
                        </div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">Loading IPD dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
            <div className="shrink-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">In-Patient Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Real-time hospital operations overview</p>
            </div>

            <IpdKpiRow kpis={payload.kpis} loading={dashboardQuery.isFetching && !dashboardQuery.isLoading} />

            <StaffCoverageWidget />

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4 flex-1 min-h-0">
                <div className="lg:col-span-7 min-h-0 flex flex-col min-h-[220px]">
                    <IpdBedBoardTable
                        rows={payload.bedBoard}
                        selectedId={selectedId}
                        onSelect={onSelectRow}
                        loading={dashboardQuery.isFetching}
                    />
                </div>
                <div className="lg:col-span-3 min-h-0 flex flex-col min-h-[260px] lg:min-h-0">
                    <IpdPatientDetailsPanel
                        row={selectedRow}
                        transferBusy={transferMutation.isPending}
                        onTransferClick={onTransferClick}
                        onStartDischargeClick={onStartDischargeClick}
                    />
                </div>
            </div>

            <IpdAlertsStrip alerts={payload.alerts} />

            <IpdTransferModal
                open={transferOpen}
                busy={transferMutation.isPending}
                patientLabel={selectedRow?.patientName ? `Patient: ${selectedRow.patientName}` : 'Transfer'}
                onClose={() => !transferMutation.isPending && setTransferOpen(false)}
                onConfirm={onTransferConfirm}
            />
        </div>
    );
};

export default Dashboard;
