import { format } from 'date-fns';
import { Loader2, Pill, Syringe, TestTubes, ScanLine } from 'lucide-react';
import type { CpoeOrderRow, CpoeOrderStatus, CpoeOrderType } from '../../../types/cpoeOrders';

const TERMINAL_STATUSES: CpoeOrderStatus[] = ['completed', 'discontinued', 'cancelled'];

const TYPE_META: Record<CpoeOrderType, { label: string; icon: typeof Pill; className: string }> = {
    medication: { label: 'Medication', icon: Pill, className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
    prn_stat: { label: 'PRN / STAT', icon: Syringe, className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
    lab: { label: 'Lab', icon: TestTubes, className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
    radiology: { label: 'Radiology', icon: ScanLine, className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

const STATUS_CLASS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300',
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    completed: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    discontinued: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

function summarize(order: CpoeOrderRow): string {
    const d = order.detail ?? {};
    switch (order.orderType) {
        case 'medication':
            return [d.name, d.dose, d.route, d.frequency].filter(Boolean).join(' ') || 'Medication order';
        case 'prn_stat':
            return `${d.medicationName ?? 'Medication'} — ${d.indication ?? ''}`.trim();
        case 'lab': {
            const tests = Array.isArray(d.labTests) ? (d.labTests as Array<{ name?: string }>).map((t) => t.name).filter(Boolean) : [];
            return tests.length ? tests.join(', ') : 'Lab order';
        }
        case 'radiology':
            return [d.modality, d.bodyRegion].filter(Boolean).join(' ') || 'Radiology order';
        default:
            return 'Order';
    }
}

function formatWhen(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : format(d, 'MM/dd/yy HH:mm');
}

type OrdersTimelineProps = {
    orders: CpoeOrderRow[];
    loading: boolean;
    busyId?: string | null;
    onStatusChange?: (order: CpoeOrderRow, status: 'discontinued' | 'cancelled') => void;
};

export function OrdersTimeline({ orders, loading, busyId, onStatusChange }: OrdersTimelineProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 px-1 py-6 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading orders…
            </div>
        );
    }

    if (!orders.length) {
        return (
            <p className="px-1 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                No orders have been placed for this encounter yet.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {orders.map((o) => {
                const meta = TYPE_META[o.orderType];
                const Icon = meta.icon;
                const priority = (o.detail?.priority as string | undefined) ?? undefined;
                return (
                    <li key={o.id} className="flex items-start gap-3 py-2.5">
                        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.className}`}>
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{meta.label}</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_CLASS[o.status] ?? STATUS_CLASS.active}`}>
                                    {o.status}
                                </span>
                                {priority ? (
                                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                                        {priority}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-gray-600 dark:text-gray-400">{summarize(o)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="whitespace-nowrap text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                                {formatWhen(o.orderedAt)}
                            </span>
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
                            ) : null}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
