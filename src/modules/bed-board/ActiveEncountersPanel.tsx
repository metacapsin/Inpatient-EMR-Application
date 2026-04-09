import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isToday, isYesterday, parseISO, isValid } from 'date-fns';
import type { LiveBedBoardRow } from '../../types/liveBedBoard';
import { cn } from '../../lib/utils';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 0] as const;

function pageSizeLabel(n: number): string {
    return n === 0 ? 'All' : String(n);
}

type SortKey = 'admission' | 'patient' | 'location' | 'status';

function rowLocation(r: LiveBedBoardRow): string {
    const ward = r.ward?.name ?? '';
    const room = r.room?.name ?? '';
    const bedLabel = r.bed.label ?? '';
    const parts = [ward, room, bedLabel].filter((x) => x.trim() !== '');
    return parts.length ? parts.join(' / ') : '—';
}

function rowPatientName(r: LiveBedBoardRow): string {
    return r.patient?.displayName?.trim() || '—';
}

function patientIdForActions(r: LiveBedBoardRow): string | null {
    const id = r.patient?.id ?? r.encounter?.patientId;
    return id?.trim() ? id.trim() : null;
}

function rowAdmissionRaw(r: LiveBedBoardRow): string {
    return r.encounter?.admissionTimestamp?.trim() ?? '';
}

function formatAdmissionRelative(ts: string): string {
    if (!ts.trim()) return '—';
    try {
        const d = parseISO(ts.trim());
        if (!isValid(d)) return ts.trim();
        if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
        if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`;
        return format(d, 'MMM d, yyyy');
    } catch {
        return ts.trim();
    }
}

function formatEncounterStatus(raw: string | undefined): string {
    const compact = (raw || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (compact.includes('inprogress') || compact === 'active') return 'In Progress';
    if (compact.includes('admitted') || compact.includes('admit')) return 'Admitted';
    if (!raw?.trim()) return 'In Progress';
    return raw.replace(/_/g, ' ');
}

interface ActiveEncountersPanelProps {
    rows: LiveBedBoardRow[];
    loading: boolean;
    errorMessage: string | null;
}

export function ActiveEncountersPanel({ rows, loading, errorMessage }: ActiveEncountersPanelProps) {
    const [sortBy, setSortBy] = useState<SortKey>('admission');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const sorted = useMemo(() => {
        const list = Array.isArray(rows) ? [...rows] : [];
        const mult = sortOrder === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            const idA = a.encounter?.id ?? a.bed.id;
            const idB = b.encounter?.id ?? b.bed.id;
            if (sortBy === 'admission') {
                const ta = rowAdmissionRaw(a);
                const tb = rowAdmissionRaw(b);
                const da = ta ? parseISO(ta) : null;
                const db = tb ? parseISO(tb) : null;
                const va = da && isValid(da) ? da.getTime() : 0;
                const vb = db && isValid(db) ? db.getTime() : 0;
                if (va !== vb) return va < vb ? -mult : mult;
                return idA.localeCompare(idB) * mult;
            }
            if (sortBy === 'patient') {
                const pa = rowPatientName(a).toLowerCase();
                const pb = rowPatientName(b).toLowerCase();
                if (pa !== pb) return pa < pb ? -mult : mult;
                return idA.localeCompare(idB) * mult;
            }
            if (sortBy === 'location') {
                const la = rowLocation(a).toLowerCase();
                const lb = rowLocation(b).toLowerCase();
                if (la !== lb) return la < lb ? -mult : mult;
                return idA.localeCompare(idB) * mult;
            }
            const sa = formatEncounterStatus(a.encounter?.status).toLowerCase();
            const sb = formatEncounterStatus(b.encounter?.status).toLowerCase();
            if (sa !== sb) return sa < sb ? -mult : mult;
            return idA.localeCompare(idB) * mult;
        });
        return list;
    }, [rows, sortBy, sortOrder]);

    const rowSignature = useMemo(
        () => (Array.isArray(rows) ? rows : []).map((r) => r.encounter?.id ?? r.bed.id).join('|'),
        [rows]
    );
    useEffect(() => {
        setPage(1);
    }, [rowSignature]);

    const total = sorted.length;
    const showAll = pageSize === 0;
    const totalPages = showAll || total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageSlice = useMemo(() => {
        if (loading || total === 0) return [];
        if (showAll) return sorted;
        const start = (safePage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, loading, total, showAll, safePage, pageSize]);

    const from = total === 0 ? 0 : showAll ? 1 : (safePage - 1) * pageSize + 1;
    const to = total === 0 ? 0 : showAll ? total : Math.min(safePage * pageSize, total);

    useEffect(() => {
        if (page !== safePage) setPage(safePage);
    }, [page, safePage]);

    const toggleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(key);
            setSortOrder(key === 'admission' ? 'desc' : 'asc');
        }
    };

    const sortBtn = (key: SortKey, label: string) => {
        const active = sortBy === key;
        return (
            <button
                type="button"
                onClick={() => toggleSort(key)}
                className={cn(
                    '-mx-0.5 inline-flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left transition-colors duration-150 hover:bg-gray-100/70 dark:hover:bg-white/[0.04]',
                    active ? 'text-primary dark:text-primary-200' : 'text-gray-500 dark:text-gray-400'
                )}
            >
                <span>{label}</span>
                <span className="text-[10px] font-normal tabular-nums text-gray-400" aria-hidden>
                    {active ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                </span>
            </button>
        );
    };

    if (errorMessage) {
        return (
            <div className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-100">
                {errorMessage}
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-200/45 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-white/[0.06] dark:bg-[#1a1a1a] dark:shadow-none">
            <div className="h-[calc(100vh-220px)] max-h-full min-h-[12rem] overflow-y-auto overflow-x-auto overscroll-contain">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px] leading-snug text-gray-900 dark:text-gray-100">
                    <thead className="sticky top-0 z-20 border-b border-gray-200/50 text-[10px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/[0.05] dark:text-gray-400">
                        <tr className="h-8">
                            <th className="bg-gray-50/95 px-2 py-1.5 align-middle dark:bg-[#1c1c1c]/95">
                                {sortBtn('patient', 'Patient name')}
                            </th>
                            <th className="bg-gray-50/95 px-2 py-1.5 align-middle dark:bg-[#1c1c1c]/95">
                                {sortBtn('location', 'Location')}
                            </th>
                            <th className="bg-gray-50/95 px-2 py-1.5 align-middle dark:bg-[#1c1c1c]/95">
                                {sortBtn('admission', 'Admission time')}
                            </th>
                            <th className="bg-gray-50/95 px-2 py-1.5 align-middle dark:bg-[#1c1c1c]/95">
                                {sortBtn('status', 'Status')}
                            </th>
                            <th className="bg-gray-50/95 px-2 py-1.5 text-right align-middle dark:bg-[#1c1c1c]/95">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/70 dark:divide-white/[0.04]">
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <tr key={i} className="h-9">
                                    <td colSpan={5} className="px-2 py-1.5 align-middle">
                                        <div className="h-3 animate-pulse rounded-sm bg-gray-200/90 dark:bg-gray-700/80" />
                                    </td>
                                </tr>
                            ))
                        ) : total === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-2 py-5 text-center text-[13px] text-gray-500 dark:text-gray-400">
                                    No admitted patients with an active encounter for the current bed board filters.
                                </td>
                            </tr>
                        ) : (
                            pageSlice.map((r) => {
                                const encId = r.encounter?.id ?? r.bed.id;
                                const pid = patientIdForActions(r);
                                const adm = rowAdmissionRaw(r);
                                return (
                                    <tr
                                        key={encId}
                                        className="h-9 transition-colors duration-150 ease-out hover:bg-gray-50/85 dark:hover:bg-white/[0.035]"
                                    >
                                        <td className="max-w-[14rem] truncate px-2 py-1 align-middle font-medium text-gray-900 dark:text-white">
                                            {rowPatientName(r)}
                                        </td>
                                        <td className="min-w-[10rem] max-w-[18rem] truncate px-2 py-1 align-middle text-gray-600 dark:text-gray-300">
                                            {rowLocation(r)}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1 align-middle text-gray-600 dark:text-gray-300">
                                            {formatAdmissionRelative(adm)}
                                        </td>
                                        <td className="px-2 py-1 align-middle text-[13px] text-gray-700 dark:text-gray-200">
                                            {formatEncounterStatus(r.encounter?.status)}
                                        </td>
                                        <td className="px-2 py-1 text-right align-middle">
                                            {pid ? (
                                                <div className="inline-flex flex-nowrap items-center justify-end gap-0.5">
                                                    <Link
                                                        to={`/app/facesheet/${encodeURIComponent(pid)}`}
                                                        className="inline-flex h-6 shrink-0 items-center justify-center rounded border border-gray-200/70 bg-white px-1.5 text-[11px] font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-50/90 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.06]"
                                                    >
                                                        Chart
                                                    </Link>
                                                    <Link
                                                        to={`/app/facesheet/${encodeURIComponent(pid)}/adt`}
                                                        className="inline-flex h-6 shrink-0 items-center justify-center rounded bg-primary px-1.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-primary/90"
                                                    >
                                                        ADT
                                                    </Link>
                                                </div>
                                            ) : (
                                                <span className="text-[12px] text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {!loading && total > 0 ? (
                <div className="flex shrink-0 flex-col gap-1.5 border-t border-gray-200/45 px-2 py-1.5 dark:border-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        {showAll ? (
                            <>
                                Showing all{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span> encounters
                            </>
                        ) : (
                            <>
                                Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                                <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
                            </>
                        )}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                            <span>Rows</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-7 rounded border border-gray-200/70 bg-white px-1.5 text-[11px] dark:border-white/[0.08] dark:bg-[#1a1816]"
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                        {pageSizeLabel(n)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {totalPages > 1 ? (
                            <div className="flex items-center gap-0.5">
                                <button
                                    type="button"
                                    title="Previous page"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-gray-200/70 bg-white text-gray-700 transition-colors duration-150 hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="min-w-[4rem] text-center text-[11px] tabular-nums text-gray-600 dark:text-gray-400">
                                    {safePage}/{totalPages}
                                </span>
                                <button
                                    type="button"
                                    title="Next page"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-gray-200/70 bg-white text-gray-700 transition-colors duration-150 hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
