import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaClipboardList } from 'react-icons/fa';
import { IpdAlertsStrip } from '../components/ipd/IpdAlertsStrip';
import { IpdBedBoardTable } from '../components/ipd/IpdBedBoardTable';
import { IpdKpiRow } from '../components/ipd/IpdKpiRow';
import { IpdPatientDetailsPanel } from '../components/ipd/IpdPatientDetailsPanel';
import { IpdTransferModal } from '../components/ipd/IpdTransferModal';
import {
    fetchIpdDashboard,
    postEncounterDischarge,
    postEncounterTransfer,
} from '../services/ipdDashboard.service';
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
    const [payload, setPayload] = useState<IpdDashboardPayload>(emptyPayload);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState<'transfer' | 'discharge' | null>(null);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        const result = await fetchIpdDashboard();
        setLoading(false);
        if (!result.ok) {
            toast.error(result.message);
            setPayload(emptyPayload());
            setSelectedId(null);
            return;
        }
        setPayload(result.data);
        setSelectedId((prev) => {
            if (!prev) return null;
            return result.data.bedBoard.some((r) => r.id === prev) ? prev : null;
        });
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const selectedRow = useMemo(
        () => (selectedId ? payload.bedBoard.find((r) => r.id === selectedId) ?? null : null),
        [payload.bedBoard, selectedId]
    );

    const onSelectRow = useCallback((row: IpdBedRow) => {
        setSelectedId(row.id);
    }, []);

    const onTransferClick = useCallback(() => {
        if (!selectedRow?.encounterId) return;
        setTransferOpen(true);
    }, [selectedRow?.encounterId]);

    const onDischargeClick = useCallback(async () => {
        if (!selectedRow?.encounterId) return;
        const ok = window.confirm('Discharge this patient? This action may require confirmation on the server.');
        if (!ok) return;
        setActionBusy('discharge');
        const res = await postEncounterDischarge({ encounterId: selectedRow.encounterId });
        setActionBusy(null);
        if (!res.ok) {
            toast.error(res.message);
            return;
        }
        toast.success('Discharge submitted');
        setSelectedId(null);
        await loadDashboard();
    }, [selectedRow?.encounterId, loadDashboard]);

    const onTransferConfirm = useCallback(
        async (newBedId: string, reason: string) => {
            if (!selectedRow?.encounterId) return;
            setActionBusy('transfer');
            const res = await postEncounterTransfer({
                encounterId: selectedRow.encounterId,
                newBedId,
                reason: reason || undefined,
            });
            setActionBusy(null);
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Transfer submitted');
            setTransferOpen(false);
            await loadDashboard();
        },
        [selectedRow?.encounterId, loadDashboard]
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

            <IpdKpiRow kpis={payload.kpis} loading={loading} />

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4 flex-1 min-h-0">
                <div className="lg:col-span-7 min-h-0 flex flex-col min-h-[220px]">
                    <IpdBedBoardTable
                        rows={payload.bedBoard}
                        selectedId={selectedId}
                        onSelect={onSelectRow}
                        loading={loading}
                    />
                </div>
                <div className="lg:col-span-3 min-h-0 flex flex-col min-h-[260px] lg:min-h-0">
                    <IpdPatientDetailsPanel
                        row={selectedRow}
                        actionBusy={actionBusy}
                        onTransferClick={onTransferClick}
                        onDischargeClick={onDischargeClick}
                    />
                </div>
            </div>

            <IpdAlertsStrip alerts={payload.alerts} />

            <IpdTransferModal
                open={transferOpen}
                busy={actionBusy === 'transfer'}
                patientLabel={selectedRow?.patientName ? `Patient: ${selectedRow.patientName}` : 'Transfer'}
                onClose={() => !actionBusy && setTransferOpen(false)}
                onConfirm={onTransferConfirm}
            />
        </div>
    );
};

export default Dashboard;
