import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LiveBedBoardRow } from '../../types/liveBedBoard';
import { bedStatusIndicatorClass } from '../../lib/adtBedPicker';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 0] as const;

function formatAdmission(ts: string | undefined): string {
    if (!ts?.trim()) return '—';
    try {
        const d = parseISO(ts.trim());
        if (!isValid(d)) return ts.trim();
        return format(d, 'MMM d, yyyy HH:mm');
    } catch {
        return ts.trim();
    }
}

function abbrevId(id: string): string {
    const t = id.trim();
    if (t.length <= 10) return t;
    return `${t.slice(0, 8)}…`;
}

function StatusBadge({ status }: { status: string }) {
    const label = status.trim() || 'unknown';
    const cls = bedStatusIndicatorClass(label);
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />
            <span className="capitalize text-gray-800 dark:text-gray-100">{label || '—'}</span>
        </span>
    );
}

interface LiveBedBoardGridProps {
    rows: LiveBedBoardRow[];
    loading: boolean;
    onFilterEncountersByBed?: (bedId: string) => void;
}

function GridSkeleton() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                    <td className="px-3 py-3" colSpan={9}>
                        <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                </tr>
            ))}
        </>
    );
}

function pageSizeLabel(n: number): string {
    return n === 0 ? 'All' : String(n);
}

export function LiveBedBoardGrid({ rows, loading, onFilterEncountersByBed }: LiveBedBoardGridProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(25);

    const rowSignature = useMemo(() => rows.map((r) => r.bed.id).join('|'), [rows]);
    useEffect(() => {
        setPage(1);
    }, [rowSignature]);

    const total = rows.length;
    const showAll = pageSize === 0;
    const totalPages = showAll || total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageSlice = useMemo(() => {
        if (loading || total === 0) return [];
        if (showAll) return rows;
        const start = (safePage - 1) * pageSize;
        return rows.slice(start, start + pageSize);
    }, [rows, loading, total, showAll, safePage, pageSize]);

    const from = total === 0 ? 0 : showAll ? 1 : (safePage - 1) * pageSize + 1;
    const to = total === 0 ? 0 : showAll ? total : Math.min(safePage * pageSize, total);

    useEffect(() => {
        if (page !== safePage) setPage(safePage);
    }, [page, safePage]);

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="md:hidden flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pe-1">
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
                            ))}
                        </div>
                    ) : total === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No beds match the current filters.</p>
                    ) : (
                        pageSlice.map((row) => {
                        const pid = row.patient?.id;
                        return (
                            <article
                                key={row.bed.id}
                                className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1a1a1a]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{row.bed.label}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {[row.ward?.name, row.room?.name].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                    <div className="text-xs" aria-label={`Bed status ${row.bed.bedStatus}`}>
                                        <StatusBadge status={row.bed.bedStatus} />
                                    </div>
                                </div>
                                <dl className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                    <div className="flex justify-between gap-2">
                                        <dt className="text-gray-500 dark:text-gray-400">Patient</dt>
                                        <dd className="max-w-[60%] truncate text-right font-medium text-gray-900 dark:text-white">
                                            {row.patient?.displayName ?? '—'}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <dt className="text-gray-500 dark:text-gray-400">MRN</dt>
                                        <dd className="font-mono text-[11px]">{row.patient?.mrn || '—'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <dt className="text-gray-500 dark:text-gray-400">Admitted</dt>
                                        <dd>{formatAdmission(row.encounter?.admissionTimestamp)}</dd>
                                    </div>
                                </dl>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {pid ? (
                                        <>
                                            <Link
                                                to={`/app/facesheet/${encodeURIComponent(pid)}`}
                                                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100"
                                            >
                                                Chart
                                            </Link>
                                            <Link
                                                to={`/app/facesheet/${encodeURIComponent(pid)}/adt`}
                                                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white"
                                            >
                                                ADT
                                            </Link>
                                        </>
                                    ) : null}
                                    {onFilterEncountersByBed ? (
                                        <button
                                            type="button"
                                            onClick={() => onFilterEncountersByBed(row.bed.id)}
                                            className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary"
                                        >
                                            Active on bed
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })
                    )}
                </div>
                {!loading && total > 0 ? (
                    <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-gray-200 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {showAll ? (
                                <>
                                    Showing all{' '}
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span> beds
                                </>
                            ) : (
                                <>
                                    Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
                                </>
                            )}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span>Rows</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                >
                                    {PAGE_SIZE_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {pageSizeLabel(n)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {totalPages > 1 ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        title="Previous page"
                                        disabled={safePage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/5"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-[5.5rem] text-center text-sm text-gray-600 dark:text-gray-400">
                                        Page {safePage} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        title="Next page"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/5"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a] md:flex">
                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[880px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 text-xs font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/10 dark:bg-[#1a1a1a]/95 dark:text-gray-400">
                        <tr>
                            <th className="px-3 py-2.5">Ward</th>
                            <th className="px-3 py-2.5">Room</th>
                            <th className="px-3 py-2.5">Bed</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Patient</th>
                            <th className="px-3 py-2.5">MRN</th>
                            <th className="px-3 py-2.5">Admission</th>
                            <th className="px-3 py-2.5">Encounter</th>
                            <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                        {loading ? (
                            <GridSkeleton />
                        ) : total === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No beds match the current filters.
                                </td>
                            </tr>
                        ) : (
                            pageSlice.map((row) => {
                                const pid = row.patient?.id;
                                const encId = row.encounter?.id;
                                return (
                                    <tr key={row.bed.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                                        <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">{row.ward?.name ?? '—'}</td>
                                        <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">{row.room?.name ?? '—'}</td>
                                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{row.bed.label}</td>
                                        <td className="px-3 py-2.5" aria-label={`Bed status ${row.bed.bedStatus}`}>
                                            <StatusBadge status={row.bed.bedStatus} />
                                        </td>
                                        <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-800 dark:text-gray-200">
                                            {row.patient?.displayName ?? '—'}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                            {row.patient?.mrn || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-600 dark:text-gray-300">
                                            {formatAdmission(row.encounter?.admissionTimestamp)}
                                        </td>
                                        <td
                                            className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300"
                                            title={encId ?? undefined}
                                        >
                                            {encId ? abbrevId(encId) : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                {pid ? (
                                                    <>
                                                        <Link
                                                            to={`/app/facesheet/${encodeURIComponent(pid)}`}
                                                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-800 dark:border-white/12 dark:bg-[#1a1816] dark:text-gray-100"
                                                        >
                                                            Chart
                                                        </Link>
                                                        <Link
                                                            to={`/app/facesheet/${encodeURIComponent(pid)}/adt`}
                                                            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-xs font-semibold text-white"
                                                        >
                                                            ADT
                                                        </Link>
                                                    </>
                                                ) : null}
                                                {onFilterEncountersByBed ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onFilterEncountersByBed(row.bed.id)}
                                                        className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 text-xs font-semibold text-primary"
                                                    >
                                                        Bed filter
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
                {!loading && total > 0 ? (
                    <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200 px-3 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {showAll ? (
                                <>
                                    Showing all{' '}
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span> beds
                                </>
                            ) : (
                                <>
                                    Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
                                </>
                            )}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span>Rows</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-white/12 dark:bg-[#1a1816]"
                                >
                                    {PAGE_SIZE_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {pageSizeLabel(n)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {totalPages > 1 ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        title="Previous page"
                                        disabled={safePage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/5"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="min-w-[5.5rem] text-center text-sm text-gray-600 dark:text-gray-400">
                                        Page {safePage} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        title="Next page"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/5"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
