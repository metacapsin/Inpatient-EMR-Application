import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import { tenantIdFromUser } from '../../features/consent/utils/consentLinks';
import { DenialWorklistTable } from '../../features/denial-management/components/DenialWorklistTable';
import { DenialAppealPanel } from '../../features/denial-management/components/DenialAppealPanel';
import { DenialStatusUpdateModal } from '../../features/denial-management/components/DenialStatusUpdateModal';
import { DenialAnalyticsPanel } from '../../features/denial-management/components/DenialAnalyticsPanel';
import type {
    ClaimDenialRecord,
    DenialAnalytics,
    DenialAppeal,
    DenialStatus,
} from '../../features/denial-management/types/denial.types';
import {
    billingCdiPath,
    billingPriorAuthPath,
    fetchDenialAnalytics,
    fetchDenialWorklist,
    submitDenialAppeal,
    updateDenialStatus,
} from '../../features/denial-management/services/denial.service';

export default function DenialWorklistPage() {
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const tenantId = tenantIdFromUser(authUser);
    const submittedByName =
        [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || 'Billing User (mock)';

    const [rows, setRows] = useState<ClaimDenialRecord[]>([]);
    const [analytics, setAnalytics] = useState<DenialAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [panelOpen, setPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<'view' | 'appeal'>('view');
    const [selected, setSelected] = useState<ClaimDenialRecord | null>(null);

    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [statusDraft, setStatusDraft] = useState<DenialStatus>('New');

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [listRes, analyticsRes] = await Promise.all([
                fetchDenialWorklist(tenantId),
                fetchDenialAnalytics(tenantId),
            ]);
            if (listRes.ok) setRows(listRes.data);
            else toast.error(listRes.message);
            if (analyticsRes.ok) setAnalytics(analyticsRes.data);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const openPanel = (row: ClaimDenialRecord, mode: 'view' | 'appeal') => {
        setSelected(row);
        setPanelMode(mode);
        setPanelOpen(true);
    };

    const onSaveAppeal = async (appeal: DenialAppeal): Promise<boolean> => {
        if (!selected) return false;
        setBusy(true);
        try {
            const res = await submitDenialAppeal(tenantId, selected.denialId, appeal);
            if (!res.ok) {
                toast.error(res.message);
                return false;
            }
            setPanelOpen(false);
            await refresh();
            return true;
        } finally {
            setBusy(false);
        }
    };

    const onSaveStatus = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            const res = await updateDenialStatus(tenantId, selected.denialId, statusDraft);
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Status updated');
            setStatusModalOpen(false);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 p-2 sm:p-0">
            <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Receipt className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Denial Management
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Denial worklist, appeals, and revenue analytics
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    <Link
                        to={billingCdiPath()}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        CDI Worklist
                    </Link>
                    {/* <Link
                        to={billingPriorAuthPath()}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Prior Auth
                    </Link> */}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading denial worklist…</p>
                </div>
            ) : (
                <>
                    <DenialWorklistTable 
                        rows={rows}
                        busy={busy}
                        onView={(row) => openPanel(row, 'view')}
                        onAppeal={(row) => openPanel(row, 'appeal')}
                        onUpdateStatus={(row) => {
                            setSelected(row);
                            setStatusDraft(row.status);
                            setStatusModalOpen(true);
                        }}
                    />

                    {analytics ? <DenialAnalyticsPanel analytics={analytics} /> : null}
                </>
            )}

            <DenialAppealPanel
                open={panelOpen}
                row={selected}
                mode={panelMode}
                submittedByName={submittedByName}
                busy={busy}
                onClose={() => setPanelOpen(false)}
                onSaveAppeal={onSaveAppeal}
            />

            <DenialStatusUpdateModal
                open={statusModalOpen}
                row={selected}
                status={statusDraft}
                busy={busy}
                onStatusChange={setStatusDraft}
                onClose={() => setStatusModalOpen(false)}
                onSave={() => void onSaveStatus()}
            />
        </div>
    );
}
