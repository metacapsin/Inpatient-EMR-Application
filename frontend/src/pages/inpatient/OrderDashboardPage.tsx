import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import {
    OrderDashboardFiltersBar,
    type OrderDashboardFilters,
} from '../../features/order-dashboard/components/OrderDashboardFiltersBar';
import { UnifiedOrdersTable } from '../../features/order-dashboard/components/UnifiedOrdersTable';
import {
    acknowledgeUnifiedOrder,
    cancelUnifiedOrder,
    fetchOrderDashboardWards,
    listUnifiedOrders,
} from '../../services/unifiedOrders.service';
import type { UnifiedOrderRow } from '../../types/unifiedOrders';

const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_PAGE_SIZE = 25;

function defaultFilters(): OrderDashboardFilters {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return {
        patientSearch: '',
        unitId: '',
        orderTypes: [],
        statuses: [],
        priorities: [],
        dateRange: { from: fmt(from), to: fmt(now) },
    };
}

function displayStaffName(): string {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return 'Staff';
        const u = JSON.parse(raw) as Record<string, unknown>;
        const sub = (u.user as Record<string, unknown>) || u;
        const first = String(sub.firstName || sub.FirstName || '').trim();
        const last = String(sub.lastName || sub.LastName || '').trim();
        const name = [first, last].filter(Boolean).join(' ').trim();
        return name || String(sub.email || sub.userName || 'Staff').trim() || 'Staff';
    } catch {
        return 'Staff';
    }
}

export default function OrderDashboardPage() {
    const [filters, setFilters] = useState<OrderDashboardFilters>(defaultFilters);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [wards, setWards] = useState<Array<{ id: string; name: string; code?: string }>>([]);
    const [wardsLoading, setWardsLoading] = useState(true);

    const [rows, setRows] = useState<UnifiedOrderRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    const staffName = useMemo(() => displayStaffName(), []);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(filters.patientSearch.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [filters.patientSearch]);

    useEffect(() => {
        let cancelled = false;
        setWardsLoading(true);
        void fetchOrderDashboardWards()
            .then((w) => {
                if (!cancelled) setWards(w);
            })
            .finally(() => {
                if (!cancelled) setWardsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listUnifiedOrders({
                patientSearch: debouncedSearch || undefined,
                unitId: filters.unitId || undefined,
                orderTypes: filters.orderTypes.length ? filters.orderTypes : undefined,
                statuses: filters.statuses.length ? filters.statuses : undefined,
                priorities: filters.priorities.length ? filters.priorities : undefined,
                dateFrom: filters.dateRange.from || undefined,
                dateTo: filters.dateRange.to || undefined,
                page,
                limit: pageSize,
            });
            setRows(res.items);
            setTotal(res.total);
        } catch {
            toast.error('Could not load orders');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filters, page, pageSize]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, filters.unitId, filters.orderTypes, filters.statuses, filters.priorities, filters.dateRange]);

    const patchFilters = (patch: Partial<OrderDashboardFilters>) => {
        setFilters((f) => ({ ...f, ...patch }));
    };

    const clearFilters = () => {
        setFilters(defaultFilters());
        setPage(1);
    };

    const handleAcknowledge = async (row: UnifiedOrderRow) => {
        setActionId(row.id);
        try {
            const res = await acknowledgeUnifiedOrder(row.id, { acknowledgedBy: staffName });
            if (!res.ok) {
                toast.error(res.message || 'Acknowledge failed');
                return;
            }
            toast.success('Order acknowledged');
            await load();
        } catch {
            toast.error('Acknowledge failed');
        } finally {
            setActionId(null);
        }
    };

    const handleCancel = async (row: UnifiedOrderRow) => {
        if (!window.confirm('Cancel this order in the source module workflow?')) return;
        setActionId(row.id);
        try {
            const res = await cancelUnifiedOrder(row.id, { cancelledBy: staffName });
            if (!res.ok) {
                toast.error(res.message || 'Cancel failed');
                return;
            }
            toast.success('Order cancelled');
            await load();
        } catch {
            toast.error('Cancel failed');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div className="font-inter relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[#141210] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)]">
            <div className="shrink-0 space-y-3 p-4 sm:p-5 sm:pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                            <ClipboardList className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                                Orders dashboard
                            </h1>
                            <p className="mt-0.5 max-w-2xl text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                                Monitor active inpatient orders across medication, lab, radiology, dietary, therapy, and procedure.
                                Acknowledge or cancel here; open the source module for full order entry and lifecycle.
                            </p>
                        </div>
                    </div>
                </div>

                <OrderDashboardFiltersBar
                    filters={filters}
                    wards={wards}
                    wardsLoading={wardsLoading}
                    disabled={loading && rows.length === 0}
                    onChange={patchFilters}
                    onClear={clearFilters}
                />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-gray-200/50 px-4 pb-4 pt-2 dark:border-white/[0.06] sm:px-5 sm:pb-5">
                <UnifiedOrdersTable
                    rows={rows}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    loading={loading}
                    actionId={actionId}
                    onPageChange={setPage}
                    onPageSizeChange={(n) => {
                        setPageSize(n);
                        setPage(1);
                    }}
                    onAcknowledge={(row) => void handleAcknowledge(row)}
                    onCancel={(row) => void handleCancel(row)}
                />
            </div>
        </div>
    );
}
