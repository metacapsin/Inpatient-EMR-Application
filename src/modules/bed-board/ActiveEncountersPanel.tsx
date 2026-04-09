import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import type { ActiveEncounterRow } from '../../types/adt';
import { cn } from '../../lib/utils';
import { extractIdString, pickString } from '../../lib/apiPayload';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 0] as const;

function pageSizeLabel(n: number): string {
    return n === 0 ? 'All' : String(n);
}

type SortKey = 'admission' | 'patient' | 'encounter';

function rowPatientId(e: ActiveEncounterRow): string {
    return extractIdString(e.patientId ?? e.patient_id) || pickString(e, 'patientId');
}

function rowAdmissionRaw(e: ActiveEncounterRow): string {
    return pickString(
        e,
        'admissionTimestamp',
        'admissionDate',
        'admittedAt',
        'admissionTime',
        'startDate',
        'createdAt'
    );
}

function rowPatientLabel(e: ActiveEncounterRow): string {
    const name = pickString(e, 'patientName', 'displayName', 'fullName', 'name');
    const pid = rowPatientId(e);
    if (name) return name;
    if (pid) return abbrevId(pid);
    return '—';
}

function abbrevId(id: string): string {
    const t = id.trim();
    if (t.length <= 12) return t;
    return `${t.slice(0, 10)}…`;
}

function formatAdmission(ts: string): string {
    if (!ts.trim()) return '—';
    try {
        const d = parseISO(ts.trim());
        if (!isValid(d)) return ts.trim();
        return format(d, 'MMM d, yyyy HH:mm');
    } catch {
        return ts.trim();
    }
}

interface ActiveEncountersPanelProps {
    rows: ActiveEncounterRow[];
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
            if (sortBy === 'admission') {
                const ta = rowAdmissionRaw(a);
                const tb = rowAdmissionRaw(b);
                const da = ta ? parseISO(ta) : null;
                const db = tb ? parseISO(tb) : null;
                const va = da && isValid(da) ? da.getTime() : 0;
                const vb = db && isValid(db) ? db.getTime() : 0;
                if (va !== vb) return va < vb ? -mult : mult;
                return a.id.localeCompare(b.id) * mult;
            }
            if (sortBy === 'patient') {
                const pa = rowPatientLabel(a).toLowerCase();
                const pb = rowPatientLabel(b).toLowerCase();
                if (pa !== pb) return pa < pb ? -mult : mult;
                return a.id.localeCompare(b.id) * mult;
            }
            return a.id.localeCompare(b.id) * mult;
        });
        return list;
    }, [rows, sortBy, sortOrder]);

    const rowSignature = useMemo(() => (Array.isArray(rows) ? rows : []).map((e) => e.id).join('|'), [rows]);
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
                    '-mx-1 inline-flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-gray-100/80 dark:hover:bg-white/5',
                    active ? 'text-primary dark:text-primary-200' : 'text-gray-500 dark:text-gray-400'
                )}
            >
                <span>{label}</span>
                <span className="text-xs font-normal tabular-nums text-gray-400" aria-hidden>
                    {active ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                </span>
            </button>
        );
    };

    if (errorMessage) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
                {errorMessage}
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a]">
            <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 text-xs font-semibold uppercase tracking-wide text-gray-500 backdrop-blur-sm dark:border-white/10 dark:bg-[#1a1a1a]/95 dark:text-gray-400">
                    <tr>
                        <th className="px-3 py-2.5">{sortBtn('patient', 'Patient')}</th>
                        <th className="px-3 py-2.5 font-mono text-[10px]">Patient id</th>
                        <th className="px-3 py-2.5">{sortBtn('admission', 'Admission')}</th>
                        <th className="px-3 py-2.5">{sortBtn('encounter', 'Encounter')}</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i}>
                                <td colSpan={6} className="px-3 py-2">
                                    <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                </td>
                            </tr>
                        ))
                    ) : total === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                No in-progress admissions for the current filter.
                            </td>
                        </tr>
                    ) : (
                        pageSlice.map((e) => {
                            const pid = rowPatientId(e);
                            const adm = rowAdmissionRaw(e);
                            const st = pickString(e, 'status', 'encounterStatus') || 'in-progress';
                            return (
                                <tr key={e.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                                        {rowPatientLabel(e)}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                        {pid ? abbrevId(pid) : '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600 dark:text-gray-300">
                                        {formatAdmission(adm)}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                        {abbrevId(e.id)}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs capitalize text-gray-700 dark:text-gray-200">{st}</td>
                                    <td className="px-3 py-2.5 text-right">
                                        {pid ? (
                                            <div className="flex flex-wrap justify-end gap-1.5">
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
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
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
                <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200 px-3 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
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
    );
}
