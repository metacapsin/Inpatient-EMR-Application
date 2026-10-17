import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IRootState } from '../../store';
import { tenantIdFromUser } from '../../features/consent/utils/consentLinks';
import { CDIWorklistTable } from '../../features/cdi/components/CDIWorklistTable';
import { CDIQueryFormDrawer } from '../../features/cdi/components/CDIQueryFormDrawer';
import type { CDIQueryFormValues, CDIWorklistRecord } from '../../features/cdi/types/cdi.types';
import {
    assignCdiSpecialist,
    clinicalWorkflowsPath,
    dischargeReadinessPath,
    fetchCdiWorklist,
    sendCdiQuery,
} from '../../features/cdi/services/cdi.service';
import { billingDenialsPath } from '../../features/denial-management/services/denial.service';

export default function CDIWorklistPage() {
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const tenantId = tenantIdFromUser(authUser);
    const cdiUserName =
        [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || 'CDI Specialist (mock)';

    const [rows, setRows] = useState<CDIWorklistRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selected, setSelected] = useState<CDIWorklistRecord | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchCdiWorklist(tenantId);
            if (res.ok) setRows(res.data);
            else toast.error(res.message);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const onAssign = async (queryId: string, specialist: string) => {
        setBusy(true);
        try {
            const res = await assignCdiSpecialist(tenantId, queryId, specialist);
            if (!res.ok) toast.error(res.message);
            else await refresh();
        } finally {
            setBusy(false);
        }
    };

    const onSendQuery = async (form: CDIQueryFormValues): Promise<boolean> => {
        if (!selected) return false;
        setBusy(true);
        try {
            const res = await sendCdiQuery(tenantId, selected.queryId, form);
            if (!res.ok) {
                toast.error(res.message);
                return false;
            }
            toast.success('Query sent to physician');
            await refresh();
            return true;
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 p-2 sm:p-0">
            <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        <ClipboardList className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            CDI Worklist
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Clinical documentation improvement queries and DRG opportunities
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    <Link
                        to={clinicalWorkflowsPath()}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Physician Clinical Workflows
                    </Link>
                    <Link
                        to={dischargeReadinessPath()}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Discharge Readiness
                    </Link>
                    <Link
                        to={billingDenialsPath()}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Denial Management
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading CDI worklist…</p>
                </div>
            ) : (
                <CDIWorklistTable
                    rows={rows}
                    busy={busy}
                    onCreateQuery={(row) => {
                        setSelected(row);
                        setDrawerOpen(true);
                    }}
                    onAssignSpecialist={(id, specialist) => void onAssign(id, specialist)}
                />
            )}

            <CDIQueryFormDrawer
                open={drawerOpen}
                row={selected}
                cdiUserName={cdiUserName}
                busy={busy}
                onClose={() => setDrawerOpen(false)}
                onSend={onSendQuery}
            />
        </div>
    );
}
