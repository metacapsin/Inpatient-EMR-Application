import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { CpoeOrderRow, CpoeOrderStatus, CpoeOrderType } from '../../../types/cpoeOrders';

const TERMINAL_STATUSES: CpoeOrderStatus[] = ['completed', 'discontinued', 'cancelled'];

const STATUS_CLASS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300',
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    completed: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    discontinued: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

const TH_CLASS =
    'sticky top-0 z-10 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-[#1a1816] dark:text-gray-400';

const TD_CLASS = 'px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200';

export function summarizeOrder(order: CpoeOrderRow): string {
    const d = order.detail ?? {};
    switch (order.orderType) {
        case 'medication':
            return [d.name, d.dose, d.route, d.frequency].filter(Boolean).join(' ') || 'Medication order';
        case 'prn_stat':
            return `${d.medicationName ?? 'Medication'} — ${d.indication ?? ''}`.trim();
        case 'lab': {
            const tests = Array.isArray(d.labTests)
                ? (d.labTests as Array<{ name?: string }>).map((t) => t.name).filter(Boolean)
                : [];
            return tests.length ? tests.join(', ') : 'Lab order';
        }
        case 'radiology':
            return [d.modality, d.bodyRegion].filter(Boolean).join(' ') || 'Radiology order';
        default:
            return 'Order';
    }
}

function detailExtra(order: CpoeOrderRow): string {
    const d = order.detail ?? {};
    switch (order.orderType) {
        case 'medication':
            return (d.nextScheduledTime as string | undefined)
                ? formatWhen(String(d.nextScheduledTime))
                : '—';
        case 'prn_stat':
            return [d.type, d.givenBy].filter(Boolean).join(' · ') || '—';
        case 'lab':
        case 'radiology':
            return (d.priority as string | undefined) || '—';
        default:
            return '—';
    }
}

function formatWhen(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : format(d, 'MM/dd/yy HH:mm');
}

const EXTRA_HEADER: Record<CpoeOrderType, string> = {
    medication: 'Scheduled',
    prn_stat: 'Type / Given by',
    lab: 'Priority',
    radiology: 'Priority',
};

type OrdersTableProps = {
    orderType: CpoeOrderType;
    orders: CpoeOrderRow[];
    loading: boolean;
    busyId?: string | null;
    onStatusChange?: (order: CpoeOrderRow, status: 'discontinued' | 'cancelled') => void;
};

export function OrdersTable({ orderType, orders, loading, busyId, onStatusChange }: OrdersTableProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-8 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading orders…
            </div>
        );
    }

    if (!orders.length) {
        return (
            <p className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No {orderType === 'prn_stat' ? 'PRN / STAT' : orderType} orders for this encounter yet.
            </p>
        );
    }

    return (
        <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
            <table className="min-w-full w-full border-collapse">
                <thead>
                    <tr>
                        <th className={TH_CLASS}>Order</th>
                        <th className={TH_CLASS}>{EXTRA_HEADER[orderType]}</th>
                        <th className={TH_CLASS}>Status</th>
                        <th className={TH_CLASS}>Ordered</th>
                        <th className={TH_CLASS}>Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                    {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.03]">
                            <td className={`${TD_CLASS} max-w-[280px]`}>
                                <span className="line-clamp-2">{summarizeOrder(o)}</span>
                            </td>
                            <td className={`${TD_CLASS} whitespace-nowrap text-gray-600 dark:text-gray-400`}>
                                {detailExtra(o)}
                            </td>
                            <td className={TD_CLASS}>
                                <span
                                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_CLASS[o.status] ?? STATUS_CLASS.active}`}
                                >
                                    {o.status}
                                </span>
                            </td>
                            <td className={`${TD_CLASS} whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400`}>
                                {formatWhen(o.orderedAt)}
                            </td>
                            <td className={TD_CLASS}>
                                {onStatusChange && !TERMINAL_STATUSES.includes(o.status) ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={busyId === o.id}
                                            onClick={() => onStatusChange(o, 'discontinued')}
                                            className="inline-flex h-6 items-center rounded-md border border-gray-200/80 bg-white px-1.5 text-[10px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                        >
                                            Discontinue
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === o.id}
                                            onClick={() => onStatusChange(o, 'cancelled')}
                                            className="inline-flex h-6 items-center rounded-md border border-rose-200/80 bg-rose-50/80 px-1.5 text-[10px] font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-gray-400">—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
