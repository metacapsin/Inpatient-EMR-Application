import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ClipboardList, Pill, Plus, ScanLine, Syringe, TestTubes } from 'lucide-react';
import { toast } from 'sonner';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { AppModal } from '../../components/shared/AppModal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { NewOrderForm } from '../../features/cpoe/components/NewOrderForm';
import { OrdersTable } from '../../features/cpoe/components/OrdersTable';
import { listEncounterOrders, updateOrderStatus } from '../../services/cpoeOrders.service';
import type { CpoeOrderRow, CpoeOrderType } from '../../types/cpoeOrders';

const TYPE_TABS: Array<{ type: CpoeOrderType; label: string; icon: typeof Pill }> = [
    { type: 'medication', label: 'Medication', icon: Pill },
    { type: 'prn_stat', label: 'PRN / STAT', icon: Syringe },
    { type: 'lab', label: 'Lab', icon: TestTubes },
    { type: 'radiology', label: 'Radiology', icon: ScanLine },
];

const TAB_TITLE: Record<CpoeOrderType, string> = {
    medication: 'Add medication order',
    prn_stat: 'Add PRN / STAT order',
    lab: 'Add lab order',
    radiology: 'Add radiology order',
};

export default function UnifiedOrders() {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const session = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = session?.encounterId?.trim() || '';

    const [orders, setOrders] = useState<CpoeOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<CpoeOrderType>('medication');
    const [addOpen, setAddOpen] = useState(false);
    const [statusConfirm, setStatusConfirm] = useState<{
        order: CpoeOrderRow;
        status: 'discontinued' | 'cancelled';
    } | null>(null);

    const load = useCallback(async () => {
        if (!encounterId) {
            setOrders([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setOrders(await listEncounterOrders(encounterId));
        } catch {
            toast.error('Could not load orders for this encounter');
        } finally {
            setLoading(false);
        }
    }, [encounterId]);

    useEffect(() => {
        void load();
    }, [load]);

    const filteredOrders = useMemo(
        () => orders.filter((o) => o.orderType === activeType),
        [orders, activeType],
    );

    const askStatusChange = (order: CpoeOrderRow, status: 'discontinued' | 'cancelled') => {
        setStatusConfirm({ order, status });
    };

    const handleStatusChange = async () => {
        if (!statusConfirm) return;
        const { order, status } = statusConfirm;
        const verb = status === 'cancelled' ? 'Cancel' : 'Discontinue';
        setBusyId(order.id);
        try {
            const updated = await updateOrderStatus(order.id, status);
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            toast.success(`Order ${status}`);
            setStatusConfirm(null);
        } catch (err) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e?.response?.data?.message || `Could not ${verb.toLowerCase()} order`);
        } finally {
            setBusyId(null);
        }
    };

    if (!patientId?.trim()) {
        return (
            <p className="p-4 text-sm text-gray-600 dark:text-gray-400">
                Open this module from a patient facesheet to load chart context.
            </p>
        );
    }

    return (
        <div className={`${moduleRootClass} flex min-h-0 flex-1 flex-col gap-3 overflow-hidden`}>
            <div className="flex items-center gap-2.5 px-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                    <ClipboardList className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                    <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">Unified orders</h1>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                        Place medication, PRN/STAT, lab, or radiology orders and review them by type for this encounter.
                    </p>
                </div>
            </div>

            {!encounterId ? (
                <p className="rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100">
                    This patient has no active encounter — admit the patient before placing orders.
                </p>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200/70 bg-white dark:border-white/[0.08] dark:bg-[#141210]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-white/[0.06]">
                    <div className="flex flex-wrap gap-1.5">
                        {TYPE_TABS.map(({ type, label, icon: Icon }) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setActiveType(type)}
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                                    activeType === type
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-gray-200/80 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-300 dark:hover:bg-white/[0.04]'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" aria-hidden />
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        disabled={!encounterId}
                        onClick={() => setAddOpen(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add {TYPE_TABS.find((t) => t.type === activeType)?.label}
                    </button>
                </div>

                <OrdersTable
                    orderType={activeType}
                    orders={filteredOrders}
                    loading={loading}
                    busyId={busyId}
                    onStatusChange={(o, status) => askStatusChange(o, status)}
                />
            </div>

            <AppModal
                open={addOpen}
                title={TAB_TITLE[activeType]}
                description="Fill in the required fields and place the order for this encounter."
                onClose={() => setAddOpen(false)}
                size="lg"
            >
                {encounterId ? (
                    <NewOrderForm
                        key={activeType}
                        patientId={patientId.trim()}
                        encounterId={encounterId}
                        orderType={activeType}
                        onPlaced={(o) => {
                            setOrders((prev) => [o, ...prev]);
                            setAddOpen(false);
                        }}
                    />
                ) : null}
            </AppModal>

            <ConfirmDialog
                open={Boolean(statusConfirm)}
                title={statusConfirm?.status === 'cancelled' ? 'Cancel order' : 'Discontinue order'}
                message={
                    statusConfirm?.status === 'cancelled'
                        ? 'Cancel this order in the chart workflow? This cannot be undone from this screen.'
                        : 'Discontinue this active order? The order will move out of the active list.'
                }
                detail={statusConfirm?.order.name}
                confirmLabel={statusConfirm?.status === 'cancelled' ? 'Cancel order' : 'Discontinue'}
                variant={statusConfirm?.status === 'cancelled' ? 'danger' : 'warning'}
                busy={Boolean(statusConfirm && busyId === statusConfirm.order.id)}
                onCancel={() => setStatusConfirm(null)}
                onConfirm={() => void handleStatusChange()}
            />
        </div>
    );
}
