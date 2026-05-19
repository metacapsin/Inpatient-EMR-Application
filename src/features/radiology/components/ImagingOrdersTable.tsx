import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { TablePagination } from '../../../components/shared/TablePagination';
import { AppModal } from '../../../components/shared/AppModal';
import AppButton from '../../../components/ui/AppButton';
import {
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';
import type { RadiologyOrder, RadiologyResultPayload } from '../types/radiologyOrder.types';
import { formatRadiologyDateTime, resolveOrderId } from '../utils/radiologyMappers';
import { RadiologyPriorityBadge } from './RadiologyPriorityBadge';
import { RadiologyStatusBadge } from './RadiologyStatusBadge';

import { RADIOLOGY_SECTION_CARD_CLASS } from '../constants/radiologyLayout';

const CARD_CLASS = `flex min-h-0 flex-1 flex-col overflow-hidden ${RADIOLOGY_SECTION_CARD_CLASS}`;

const ROWS_SCROLL =
    'min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain scroll-smooth [scrollbar-width:thin]';

const TH_CLASS =
    'sticky top-0 z-10 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-[#1a1816] dark:text-gray-400';

const TD_CLASS = 'px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200';

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

type ImagingOrdersTableProps = {
    orders: RadiologyOrder[];
    loading?: boolean;
    orderedById: string;
    onNewOrder: () => void;
    newOrderDisabled?: boolean;
    onAcknowledge: (orderId: string) => void;
    onCancel: (orderId: string) => void;
    onSubmitResult: (orderId: string, body: RadiologyResultPayload) => void;
    onMarkCritical: (orderId: string, notifiedTo: string) => void;
};

export function ImagingOrdersTable({
    orders,
    loading,
    orderedById,
    onNewOrder,
    newOrderDisabled = false,
    onAcknowledge,
    onCancel,
    onSubmitResult,
    onMarkCritical,
}: ImagingOrdersTableProps) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [resultOrder, setResultOrder] = useState<RadiologyOrder | null>(null);
    const [impression, setImpression] = useState('');
    const [findings, setFindings] = useState('');
    const [radiologistName, setRadiologistName] = useState('');
    const [dicomViewerUrl, setDicomViewerUrl] = useState('');
    const [criticalOrder, setCriticalOrder] = useState<RadiologyOrder | null>(null);
    const [notifiedTo, setNotifiedTo] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((o) => {
            const hay = [
                o.modality,
                o.bodyRegion,
                o.priority,
                o.status,
                o.radiologistName,
                formatRadiologyDateTime(o.orderedAt),
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [orders, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    useEffect(() => {
        setPage(1);
    }, [search, orders]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pageRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    const openResult = (order: RadiologyOrder) => {
        setResultOrder(order);
        setImpression(order.impression ?? '');
        setFindings(order.findings ?? '');
        setRadiologistName(order.radiologistName ?? '');
        setDicomViewerUrl(order.dicomViewerUrl ?? '');
    };

    const saveResult = () => {
        if (!resultOrder) return;
        const id = resolveOrderId(resultOrder);
        if (!id) return;
        onSubmitResult(id, {
            impression: impression.trim() || undefined,
            findings: findings.trim() || undefined,
            radiologistName: radiologistName.trim() || undefined,
            dicomViewerUrl: dicomViewerUrl.trim() || undefined,
            resultedAt: new Date().toISOString(),
            performedAt: resultOrder.performedAt ?? new Date().toISOString(),
        });
        setResultOrder(null);
    };

    const saveCritical = () => {
        if (!criticalOrder) return;
        const id = resolveOrderId(criticalOrder);
        if (!id) return;
        onMarkCritical(id, notifiedTo.trim());
        setCriticalOrder(null);
        setNotifiedTo('');
    };

    return (
        <>
            <section className={CARD_CLASS} aria-labelledby="rad-orders-heading">
                <div className="z-[2] shrink-0 border-b border-gray-200/80 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-[#141210]">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h4
                            id="rad-orders-heading"
                            className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                        >
                            Encounter imaging orders
                        </h4>
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                aria-hidden
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search orders…"
                                disabled={loading}
                                className="h-8 w-full rounded-lg border border-gray-200/90 bg-white py-0 pl-8 pr-2.5 text-xs font-medium text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary/15 disabled:opacity-60 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600"
                                aria-label="Search imaging orders"
                            />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <AppButton
                                type="button"
                                className="!h-8 !px-3 !py-0 !text-xs font-semibold"
                                disabled={newOrderDisabled || loading}
                                onClick={onNewOrder}
                            >
                                New imaging order
                            </AppButton>
                        </div>
                    </div>
                </div>

                <div className={ROWS_SCROLL}>
                    <table className="min-w-full w-full table-fixed border-collapse">
                        <thead>
                            <tr>
                                <th className={TH_CLASS}>Order Date</th>
                                <th className={TH_CLASS}>Modality</th>
                                <th className={TH_CLASS}>Body Region</th>
                                <th className={TH_CLASS}>Priority</th>
                                <th className={TH_CLASS}>Status</th>
                                <th className={TH_CLASS}>Radiologist</th>
                                <th className={TH_CLASS}>Critical</th>
                                <th className={TH_CLASS}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                                    </td>
                                </tr>
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">
                                        No imaging orders for this encounter.
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((order) => {
                                    const id = resolveOrderId(order);
                                    const status = String(order.status ?? 'Ordered');
                                    const cancelled = status.toLowerCase().includes('cancel');
                                    return (
                                        <tr key={id || `${order.modality}-${order.orderedAt}`} className="border-t border-gray-100 dark:border-white/5">
                                            <td className={TD_CLASS}>{formatRadiologyDateTime(order.orderedAt)}</td>
                                            <td className={TD_CLASS}>{order.modality || '—'}</td>
                                            <td className={TD_CLASS}>{order.bodyRegion || '—'}</td>
                                            <td className={TD_CLASS}>
                                                <RadiologyPriorityBadge priority={String(order.priority ?? '')} />
                                            </td>
                                            <td className={TD_CLASS}>
                                                <RadiologyStatusBadge status={status} />
                                            </td>
                                            <td className={TD_CLASS}>{order.radiologistName?.trim() || '—'}</td>
                                            <td className={TD_CLASS}>
                                                {order.criticalValue ? (
                                                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800 dark:bg-red-950/50 dark:text-red-200">
                                                        Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className={TD_CLASS}>
                                                <div className="flex flex-wrap gap-1">
                                                    {!cancelled && !order.acknowledgedAt ? (
                                                        <button
                                                            type="button"
                                                            className="text-[10px] font-semibold text-primary hover:underline"
                                                            onClick={() => onAcknowledge(id)}
                                                        >
                                                            Ack
                                                        </button>
                                                    ) : null}
                                                    {!cancelled ? (
                                                        <button
                                                            type="button"
                                                            className="text-[10px] font-semibold text-primary hover:underline"
                                                            onClick={() => openResult(order)}
                                                        >
                                                            Result
                                                        </button>
                                                    ) : null}
                                                    {!cancelled ? (
                                                        <button
                                                            type="button"
                                                            className="text-[10px] font-semibold text-amber-700 hover:underline dark:text-amber-300"
                                                            onClick={() => setCriticalOrder(order)}
                                                        >
                                                            Critical
                                                        </button>
                                                    ) : null}
                                                    {!cancelled && order.orderedBy === orderedById ? (
                                                        <button
                                                            type="button"
                                                            className="text-[10px] font-semibold text-red-600 hover:underline dark:text-red-400"
                                                            onClick={() => onCancel(id)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    ) : null}
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
                    totalItems={filtered.length}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    loading={loading}
                    itemLabel="orders"
                />
            </section>

            <AppModal
                open={Boolean(resultOrder)}
                title="Enter imaging result"
                onClose={() => setResultOrder(null)}
                size="lg"
                footer={
                    <div className="flex justify-end gap-2">
                        <AppButton type="button" onClick={() => setResultOrder(null)}>
                            Close
                        </AppButton>
                        <AppButton type="button" onClick={saveResult}>
                            Save result
                        </AppButton>
                    </div>
                }
            >
                <div className={NFS_SECTION_GRID_CLASS}>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="res-rad-name"
                            label="Radiologist Name"
                            value={radiologistName}
                            onChange={setRadiologistName}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="res-dicom-url"
                            label="DICOM Viewer Link"
                            value={dicomViewerUrl}
                            onChange={setDicomViewerUrl}
                        />
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextarea fieldId="res-findings" label="Findings" value={findings} onChange={setFindings} />
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextarea fieldId="res-impression" label="Impression" value={impression} onChange={setImpression} />
                    </div>
                </div>
            </AppModal>

            <AppModal
                open={Boolean(criticalOrder)}
                title="Mark critical result"
                onClose={() => setCriticalOrder(null)}
                footer={
                    <div className="flex justify-end gap-2">
                        <AppButton type="button" onClick={() => setCriticalOrder(null)}>
                            Close
                        </AppButton>
                        <AppButton type="button" onClick={saveCritical}>
                            Save
                        </AppButton>
                    </div>
                }
            >
                <FlowsheetOutlinedTextInput
                    fieldId="crit-notified-to"
                    label="Critical Value Notified To"
                    value={notifiedTo}
                    onChange={setNotifiedTo}
                />
            </AppModal>
        </>
    );
}
