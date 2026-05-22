import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveCodeEvents } from '../features/code-event/hooks/useActiveCodeEvents';
import { IpdCodeAlertStrip } from '../features/code-event/components/IpdCodeAlertStrip';
import { IpdActiveCodeBadges } from '../features/code-event/components/IpdActiveCodeBadges';
import { CodeActivateButton } from '../features/code-event/components/CodeActivateButton';
import { CodeActivateModal } from '../features/code-event/components/CodeActivateModal';
import { connectCodeEventWebSocket, disconnectCodeEventWebSocket } from '../features/code-event/utils/codeEventBroadcast';
import { DEFAULT_CODE_EVENT_UNIT_ID } from '../features/code-event/config/codeEventMock.config';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Activity } from 'lucide-react';
import { FaClipboardList } from 'react-icons/fa';
import { IpdAlertsStrip } from '../components/ipd/IpdAlertsStrip';
import { IpdPpeAlertStrip } from '../components/ipd/IpdPpeAlertStrip';
import { StaffCoverageWidget } from '../components/ipd/StaffCoverageWidget';
import { IpdBedBoardTable } from '../components/ipd/IpdBedBoardTable';
import { IpdKpiRow } from '../components/ipd/IpdKpiRow';
import { IpdPatientDetailsPanel } from '../components/ipd/IpdPatientDetailsPanel';
import { IpdTransferModal } from '../components/ipd/IpdTransferModal';
import { fetchIpdDashboard } from '../services/ipdDashboard.service';
import { formatAdtUserMessage, transferPatient } from '../services/adtWorkflowService';
import type { AppDispatch } from '../store';
import type { IpdBedRow, IpdDashboardPayload } from '../types/ipdDashboard';
import {
    ipdBedBoardColClass,
    ipdEyebrowClass,
    ipdMainGridClass,
    ipdMetricsBandClass,
    ipdPageHeaderClass,
    ipdPageSubtitleClass,
    ipdPageTitleClass,
    ipdPatientColClass,
    ipdShellClass,
} from '../styles/ipdDashboardClasses';

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
    const [codeModalOpen, setCodeModalOpen] = useState(false);
    const { events: activeCodeEvents } = useActiveCodeEvents(DEFAULT_CODE_EVENT_UNIT_ID);

    useEffect(() => {
        connectCodeEventWebSocket(DEFAULT_CODE_EVENT_UNIT_ID);
        return () => disconnectCodeEventWebSocket();
    }, []);

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
            <div className="ipd-operations-shell flex flex-1 min-h-0 items-center justify-center rounded-xl border border-emr-border/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
                <div className="text-center">
                    <div className="relative mx-auto h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                        <div className="absolute inset-2 flex items-center justify-center rounded-full bg-primary/5">
                            <FaClipboardList className="text-base text-primary" />
                        </div>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-emr-text dark:text-gray-300">Loading operations center…</p>
                    <p className="mt-1 text-xs text-emr-muted dark:text-gray-500">Census, bed board, and alerts</p>
                </div>
            </div>
        );
    }

    return (
        <div className={ipdShellClass}>
            <div className={ipdPageHeaderClass}>
                <div className="min-w-0">
                    <p className={ipdEyebrowClass}>Inpatient operations</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <h1 className={ipdPageTitleClass}>In-Patient Dashboard</h1>
                        <IpdActiveCodeBadges events={activeCodeEvents} />
                        {dashboardQuery.isFetching && !dashboardQuery.isLoading ? (
                            <span
                                className="inline-flex items-center gap-1 rounded-md border border-emr-border/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emr-muted dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-400"
                                aria-live="polite"
                            >
                                <Activity className="h-3 w-3 animate-pulse text-emr-accent" aria-hidden />
                                Syncing
                            </span>
                        ) : null}
                    </div>
                    <p className={`${ipdPageSubtitleClass} mt-0.5`}>Real-time hospital operations overview</p>
                </div>
                <CodeActivateButton label="Activate Code" size="md" onClick={() => setCodeModalOpen(true)} />
            </div>

            <IpdCodeAlertStrip events={activeCodeEvents} />

            <div className={ipdMetricsBandClass}>
                <IpdKpiRow kpis={payload.kpis} loading={dashboardQuery.isFetching && !dashboardQuery.isLoading} />
                <IpdPpeAlertStrip bedRows={payload.bedBoard} />
                <StaffCoverageWidget />
            </div>

            <div className={ipdMainGridClass}>
                <div className={ipdBedBoardColClass}>
                    <IpdBedBoardTable
                        rows={payload.bedBoard}
                        selectedId={selectedId}
                        onSelect={onSelectRow}
                        loading={dashboardQuery.isFetching}
                    />
                </div>
                <div className={ipdPatientColClass}>
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

            <CodeActivateModal
                open={codeModalOpen}
                onClose={() => setCodeModalOpen(false)}
                context={
                    selectedRow?.patientId && selectedRow.encounterId
                        ? {
                              patientId: selectedRow.patientId,
                              encounterId: selectedRow.encounterId,
                              patientName: selectedRow.patientName ?? undefined,
                              location: [selectedRow.ward, selectedRow.room, selectedRow.bed].filter(Boolean).join(' · '),
                          }
                        : undefined
                }
            />
        </div>
    );
};

export default Dashboard;
