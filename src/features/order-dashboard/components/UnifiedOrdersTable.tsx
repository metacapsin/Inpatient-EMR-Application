import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { TablePagination } from '../../../components/shared/TablePagination';
import type { UnifiedOrderRow } from '../../../types/unifiedOrders';
import { OrderSourceButton } from './OrderSourceButton';
import { OrderTypeBadge } from './OrderTypeBadge';
import { OrderPriorityPill } from './OrderPriorityPill';
import { OrderStatusBadge } from './OrderStatusBadge';

const TH_CLASS =
    'sticky top-0 z-10 whitespace-nowrap px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-[#1a1816] dark:text-gray-400';

const TD_CLASS = 'px-2.5 py-2 align-middle text-xs font-medium text-gray-800 dark:text-gray-200';

const ROWS_SCROLL =
    'min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain scroll-smooth [scrollbar-width:thin]';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatOrderedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'MM/dd/yy HH:mm');
}

type UnifiedOrdersTableProps = {
    rows: UnifiedOrderRow[];
    total: number;
    page: number;
    pageSize: number;
    loading?: boolean;
    actionId?: string | null;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onAcknowledge: (row: UnifiedOrderRow) => void;
    onCancel: (row: UnifiedOrderRow) => void;
};

function TableSkeleton() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                    <td colSpan={9} className="px-2.5 py-2">
                        <div className="h-3.5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                </tr>
            ))}
        </>
    );
}

export function UnifiedOrdersTable({
    rows,
    total,
    page,
    pageSize,
    loading,
    actionId,
    onPageChange,
    onPageSizeChange,
    onAcknowledge,
    onCancel,
}: UnifiedOrdersTableProps) {
    const empty = !loading && rows.length === 0;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className={ROWS_SCROLL}>
                <table className="min-w-full w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH_CLASS}>Patient</th>
                            <th className={TH_CLASS}>Unit</th>
                            <th className={TH_CLASS}>Order</th>
                            <th className={TH_CLASS}>Type</th>
                            <th className={TH_CLASS}>Priority</th>
                            <th className={TH_CLASS}>Status</th>
                            <th className={TH_CLASS}>Ordered</th>
                            <th className={TH_CLASS}>Ordered by</th>
                            <th className={`${TH_CLASS} text-right`}>Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                        {loading ? (
                            <TableSkeleton />
                        ) : empty ? (
                            <tr>
                                <td colSpan={9} className="px-3 py-10 text-center text-xs text-gray-500 dark:text-gray-400">
                                    No orders match the current filters.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const busy = actionId === row.id;
                                return (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.03]"
                                    >
                                        <td className={TD_CLASS}>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                                    {row.patientName}
                                                </p>
                                                {row.mrn ? (
                                                    <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                                                        MRN {row.mrn}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className={`${TD_CLASS} whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-400`}>
                                            {row.unitName || '—'}
                                        </td>
                                        <td className={`${TD_CLASS} max-w-[14rem]`}>
                                            <p className="line-clamp-2 text-[11px] leading-snug">{row.summary}</p>
                                        </td>
                                        <td className={TD_CLASS}>
                                            <OrderTypeBadge orderType={row.orderType} />
                                        </td>
                                        <td className={TD_CLASS}>
                                            <OrderPriorityPill priority={row.priority} />
                                        </td>
                                        <td className={TD_CLASS}>
                                            <OrderStatusBadge status={row.status} />
                                        </td>
                                        <td className={`${TD_CLASS} whitespace-nowrap text-[11px] tabular-nums text-gray-600 dark:text-gray-400`}>
                                            {formatOrderedAt(row.orderedAt)}
                                        </td>
                                        <td className={`${TD_CLASS} max-w-[8rem] truncate text-[11px] text-gray-600 dark:text-gray-400`}>
                                            {row.orderedByName || '—'}
                                        </td>
                                        <td className={`${TD_CLASS} text-right`}>
                                            <div className="flex flex-wrap items-center justify-end gap-1">
                                                {row.canAcknowledge ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => onAcknowledge(row)}
                                                        className="inline-flex h-7 items-center rounded-md border border-gray-200/80 bg-white px-2 text-[10px] font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                                    >
                                                        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : 'Acknowledge'}
                                                    </button>
                                                ) : null}
                                                {row.canCancel ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => onCancel(row)}
                                                        className="inline-flex h-7 items-center rounded-md border border-rose-200/80 bg-rose-50/80 px-2 text-[10px] font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/50"
                                                    >
                                                        Cancel
                                                    </button>
                                                ) : null}
                                                <OrderSourceButton row={row} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={total}
                loading={loading}
                itemLabel="orders"
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </div>
    );
}
