import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import type { IRootState } from '../../../store';
import AppButton from '../../../components/ui/AppButton';
import { useRadiologyData } from '../../radiology/hooks/useRadiologyData';
import type { RadiologyOrder } from '../../radiology/types/radiologyOrder.types';
import { formatRadiologyDateTime, resolveOrderId } from '../../radiology/utils/radiologyMappers';
import { resolveOrderedBy } from '../../radiology/utils/resolveOrderedBy';
import { RadiologyPriorityBadge } from '../../radiology/components/RadiologyPriorityBadge';
import { RadiologyStatusBadge } from '../../radiology/components/RadiologyStatusBadge';
import { InpatientRadiologyQuickOrderModal } from './InpatientRadiologyQuickOrderModal';

const SEARCH_INPUT_CLASS =
    'h-8 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs leading-8 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

/** Thin neutral scrollbar (avoids theme brown primary scroll styling). */
const THIN_NEUTRAL_SCROLLBAR =
    '[scrollbar-width:thin] [scrollbar-color:rgb(156_163_175/0.45)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300/70 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600/70';

function orderStudyLabel(order: RadiologyOrder): string {
    const parts = [order.modality, order.bodyRegion].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Radiology study';
}

function orderMatchesSearch(order: RadiologyOrder, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [
        order.modality,
        order.bodyRegion,
        order.status,
        order.priority,
        order.clinicalIndication,
        order.orderedByName,
        order.radiologistName,
        formatRadiologyDateTime(order.orderedAt),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

type InpatientRadiologyQuickWorkflowProps = {
    patientId: string;
    encounterId: string;
    canPlaceOrders: boolean;
};

export function InpatientRadiologyQuickWorkflow({
    patientId,
    encounterId,
    canPlaceOrders,
}: InpatientRadiologyQuickWorkflowProps) {
    const authUser = useSelector((s: IRootState) => s.auth.user);
    const ordered = useMemo(() => resolveOrderedBy(authUser), [authUser]);
    const tenantId = String(authUser?.tenant?.id ?? authUser?.tenantId ?? '').trim();

    const {
        effectiveEncounterId,
        orders,
        loading,
        submitting,
        createImagingOrder,
    } = useRadiologyData({
        patientId,
        encounterId,
        tenantId: tenantId || undefined,
        orderedBy: ordered.id,
        orderedByName: ordered.name,
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [orderModalOpen, setOrderModalOpen] = useState(false);

    const facesheetRadiologyUrl = patientId.trim()
        ? `/app/facesheet/${encodeURIComponent(patientId.trim())}/radiology`
        : '';

    const hasEncounter = Boolean(effectiveEncounterId.trim());

    const formContext = hasEncounter
        ? {
              patientId: patientId.trim(),
              encounterId: effectiveEncounterId,
              tenantId: tenantId || undefined,
              orderedBy: ordered.id,
              orderedByName: ordered.name,
          }
        : null;

    const displayedOrders = useMemo(() => {
        return [...orders]
            .filter((o) => orderMatchesSearch(o, searchQuery))
            .sort((a, b) => {
                const ta = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
                const tb = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
                return tb - ta;
            });
    }, [orders, searchQuery]);

    return (
        <div className="space-y-2">
            {!hasEncounter ? (
                <p className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/30 dark:text-amber-100">
                    Select an encounter to view radiology orders and place new studies for this visit.
                </p>
            ) : null}

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5 dark:border-gray-700">
                    <h3 className="shrink-0 text-sm font-semibold leading-8 text-gray-900 dark:text-gray-100">
                        Recent Radiology Orders
                    </h3>
                    <div className="relative w-[230px] shrink-0">
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                            aria-hidden
                        />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search orders…"
                            aria-label="Search radiology orders"
                            className={SEARCH_INPUT_CLASS}
                            style={{ height: 32 }}
                        />
                    </div>
                    {canPlaceOrders ? (
                        <AppButton
                            type="button"
                            className="inline-flex h-8 shrink-0 items-center px-3 py-0 text-xs leading-none"
                            disabled={!hasEncounter}
                            onClick={() => setOrderModalOpen(true)}
                        >
                            New Order
                        </AppButton>
                    ) : null}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Loading" /> : null}
                        {facesheetRadiologyUrl ? (
                            <Link
                                to={facesheetRadiologyUrl}
                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200"
                            >
                                Open Full Module
                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                            </Link>
                        ) : null}
                    </div>
                </div>

                {displayedOrders.length === 0 && !loading ? (
                    <p className="px-3 py-6 text-center text-sm text-gray-500">
                        {searchQuery.trim()
                            ? 'No orders match your search.'
                            : 'No radiology orders for this encounter.'}
                    </p>
                ) : (
                    <ul
                        className={`max-h-[min(420px,50vh)] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800 ${THIN_NEUTRAL_SCROLLBAR}`}
                    >
                        {displayedOrders.map((order) => (
                            <li
                                key={resolveOrderId(order)}
                                className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 text-sm hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{orderStudyLabel(order)}</p>
                                    <p className="text-xs text-gray-500">
                                        {formatRadiologyDateTime(order.orderedAt)}
                                        {order.orderedByName ? ` · ${order.orderedByName}` : ''}
                                        {order.clinicalIndication?.trim()
                                            ? ` · ${order.clinicalIndication.trim().slice(0, 48)}${
                                                  order.clinicalIndication.trim().length > 48 ? '…' : ''
                                              }`
                                            : ''}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    {order.criticalValue ? (
                                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800 dark:bg-red-950/50 dark:text-red-200">
                                            Critical
                                        </span>
                                    ) : null}
                                    <RadiologyStatusBadge status={String(order.status)} />
                                    <RadiologyPriorityBadge priority={String(order.priority)} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <InpatientRadiologyQuickOrderModal
                open={orderModalOpen}
                formContext={formContext}
                disabled={!canPlaceOrders || !hasEncounter}
                submitting={submitting}
                onClose={() => setOrderModalOpen(false)}
                onSubmit={createImagingOrder}
            />
        </div>
    );
}
