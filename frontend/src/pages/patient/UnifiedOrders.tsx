import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import usePatientId from '../../hooks/usePatientId';
import { useFacesheetChartLayout } from '../../hooks/useFacesheetChartLayout';
import type { IRootState } from '../../store';
import { selectAdtEncounter } from '../../store/adtEncounterSlice';
import { NewOrderForm } from '../../features/cpoe/components/NewOrderForm';
import { OrdersTimeline } from '../../features/cpoe/components/OrdersTimeline';
import { listEncounterOrders, updateOrderStatus } from '../../services/cpoeOrders.service';
import type { CpoeOrderRow } from '../../types/cpoeOrders';

export default function UnifiedOrders() {
    const patientId = usePatientId();
    const { moduleRootClass } = useFacesheetChartLayout();
    const session = useSelector((s: IRootState) => (patientId ? selectAdtEncounter(s, patientId) : null));
    const encounterId = session?.encounterId?.trim() || '';

    const [orders, setOrders] = useState<CpoeOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

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

    const handleStatusChange = async (order: CpoeOrderRow, status: 'discontinued' | 'cancelled') => {
        const verb = status === 'cancelled' ? 'Cancel' : 'Discontinue';
        if (!window.confirm(`${verb} this order?`)) return;
        setBusyId(order.id);
        try {
            const updated = await updateOrderStatus(order.id, status);
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            toast.success(`Order ${status}`);
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
                        Place medication, PRN/STAT, lab, or radiology orders through one form and see them in one timeline for this encounter.
                    </p>
                </div>
            </div>

            {!encounterId ? (
                <p className="rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100">
                    This patient has no active encounter — admit the patient before placing orders.
                </p>
            ) : (
                <NewOrderForm patientId={patientId.trim()} encounterId={encounterId} onPlaced={(o) => setOrders((prev) => [o, ...prev])} />
            )}

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200/70 bg-white px-3 dark:border-white/[0.08] dark:bg-[#141210]">
                <OrdersTimeline orders={orders} loading={loading} busyId={busyId} onStatusChange={(o, status) => void handleStatusChange(o, status)} />
            </div>
        </div>
    );
}
