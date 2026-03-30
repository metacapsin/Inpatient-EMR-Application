import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { DateRangePicker } from '../../components/patients/DateRangePicker';
import { FilterSelect } from '../../components/patients/FilterSelect';
import { SearchInput } from '../../components/patients/SearchInput';
import PatientTable from '../../components/patients/PatientTable';
import {
    getPatientsList,
    parsePatientListSortField,
    type PatientListItem,
    type PatientListSortField,
} from '../../services/patient.service';

const LIMIT_OPTIONS = [10, 25, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

const SEX_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'U', label: 'Unknown / other' },
];

const AGE_OPTIONS = [
    { value: 'all', label: 'All ages' },
    { value: '0-17', label: '0–17' },
    { value: '18-64', label: '18–64' },
    { value: '65+', label: '65+' },
];

const RECENT_OPTIONS = [
    { value: 'all', label: 'All patients' },
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
];

type StatusValue = 'all' | 'active' | 'inactive';

interface ListQueryState {
    page: number;
    limit: number;
    status: StatusValue;
    sex: string;
    ageRange: string;
    recent: string;
    fromDate: string;
    toDate: string;
    sortBy: PatientListSortField;
    sortOrder: 'asc' | 'desc';
    search: string;
}

function readListQuery(sp: URLSearchParams): ListQueryState {
    const lim = Number(sp.get('limit') || 10);
    return {
        page: Math.max(1, Number(sp.get('page') || 1)),
        limit: (LIMIT_OPTIONS as readonly number[]).includes(lim) ? lim : 10,
        status: (() => {
            const s = sp.get('status');
            if (s === 'active' || s === 'inactive' || s === 'all') return s;
            return 'all';
        })(),
        sex: sp.get('sex') || 'all',
        ageRange: sp.get('ageRange') || 'all',
        recent: sp.get('recent') || 'all',
        fromDate: sp.get('fromDate') || '',
        toDate: sp.get('toDate') || '',
        sortBy: parsePatientListSortField(sp.get('sortBy')) ?? 'patient',
        sortOrder: sp.get('sortOrder') === 'desc' ? 'desc' : 'asc',
        search: sp.get('search') || '',
    };
}

function serializeListQuery(q: ListQueryState): URLSearchParams {
    const p = new URLSearchParams();
    p.set('page', String(q.page));
    p.set('limit', String(q.limit));
    if (q.search.trim()) p.set('search', q.search.trim());
    if (q.status !== 'all') p.set('status', q.status);
    if (q.sex !== 'all') p.set('sex', q.sex);
    if (q.ageRange !== 'all') p.set('ageRange', q.ageRange);
    if (q.recent !== 'all') p.set('recent', q.recent);
    if (q.fromDate) p.set('fromDate', q.fromDate);
    if (q.toDate) p.set('toDate', q.toDate);
    p.set('sortBy', q.sortBy);
    p.set('sortOrder', q.sortOrder);
    return p;
}

const PatientList = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const lastSyncedSearchParams = useRef<string | null>(null);
    const isFirstDebounce = useRef(true);

    const initial = readListQuery(searchParams);

    const [page, setPage] = useState(initial.page);
    const [limit, setLimit] = useState(initial.limit);
    const [status, setStatus] = useState<StatusValue>(initial.status);
    const [sex, setSex] = useState(initial.sex);
    const [ageRange, setAgeRange] = useState(initial.ageRange);
    const [recent, setRecent] = useState(initial.recent);
    const [fromDate, setFromDate] = useState(initial.fromDate);
    const [toDate, setToDate] = useState(initial.toDate);
    const [sortBy, setSortBy] = useState<PatientListSortField>(initial.sortBy);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initial.sortOrder);
    const [searchInput, setSearchInput] = useState(initial.search);
    const [debouncedSearch, setDebouncedSearch] = useState(initial.search);

    const [items, setItems] = useState<PatientListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        if (isFirstDebounce.current) {
            isFirstDebounce.current = false;
            return;
        }
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        const cur = searchParams.toString();
        if (lastSyncedSearchParams.current !== null && cur === lastSyncedSearchParams.current) {
            return;
        }

        const r = readListQuery(searchParams);
        setPage(r.page);
        setLimit(r.limit);
        setStatus(r.status);
        setSex(r.sex);
        setAgeRange(r.ageRange);
        setRecent(r.recent);
        setFromDate(r.fromDate);
        setToDate(r.toDate);
        setSortBy(r.sortBy);
        setSortOrder(r.sortOrder);

        if (typeof document !== 'undefined' && document.activeElement !== searchInputRef.current) {
            setSearchInput(r.search);
            setDebouncedSearch(r.search);
        }

        lastSyncedSearchParams.current = cur;
    }, [searchParams]);

    useEffect(() => {
        const next = serializeListQuery({
            page,
            limit,
            status,
            sex,
            ageRange,
            recent,
            fromDate,
            toDate,
            sortBy,
            sortOrder,
            search: debouncedSearch,
        }).toString();

        if (next === searchParams.toString()) return;

        lastSyncedSearchParams.current = next;
        setSearchParams(new URLSearchParams(next), { replace: true });
    }, [
        page,
        limit,
        status,
        sex,
        ageRange,
        recent,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
        debouncedSearch,
        searchParams,
        setSearchParams,
    ]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getPatientsList({
                page,
                limit,
                status,
                sex,
                ageRange,
                recent,
                fromDate,
                toDate,
                search: debouncedSearch,
                sortBy,
                sortOrder,
            });
            setItems(res.items);
            setTotal(res.total);
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Failed to load patients';
            setError(msg);
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [page, limit, status, sex, ageRange, recent, fromDate, toDate, debouncedSearch, sortBy, sortOrder]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSort = (field: PatientListSortField) => {
        if (sortBy === field) {
            setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(1);
    };

    const clearFilters = () => {
        setStatus('all');
        setSex('all');
        setAgeRange('all');
        setRecent('all');
        setFromDate('');
        setToDate('');
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="panel">
            <div className="mb-5">
                <ul className="flex flex-wrap items-center gap-2 text-sm">
                    <li>
                        <NavLink to="/app/patients/list" className="text-primary hover:underline">
                            Patients
                        </NavLink>
                    </li>
                    <li className="text-gray-400">/</li>
                    <li className="font-medium text-gray-900 dark:text-white">Patient List</li>
                </ul>
            </div>

            <div className="mt-4">
                <div className="mb-6 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white sm:text-xl">Patient List</h3>
                    <SearchInput
                        className="w-full sm:max-w-md lg:max-w-lg"
                        inputRef={searchInputRef}
                        value={searchInput}
                        onChange={setSearchInput}
                        placeholder="Search by name, MRN, or phone"
                    />
                </div>
            </div>

            <div className="mt-6 border-t border-white-light pt-5 dark:border-[#191e3a]">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 lg:gap-4">
                        <FilterSelect label="Status" value={status} onChange={(v) => {
                            setStatus(v as StatusValue);
                            setPage(1);
                        }} options={STATUS_OPTIONS} />
                        <FilterSelect label="Sex" value={sex} onChange={(v) => {
                            setSex(v);
                            setPage(1);
                        }} options={SEX_OPTIONS} />
                        <FilterSelect label="Age range" value={ageRange} onChange={(v) => {
                            setAgeRange(v);
                            setPage(1);
                        }} options={AGE_OPTIONS} />
                        <FilterSelect label="Recent patients" value={recent} onChange={(v) => {
                            setRecent(v);
                            setPage(1);
                        }} options={RECENT_OPTIONS} />
                        <DateRangePicker
                            label="Reg date"
                            from={fromDate}
                            to={toDate}
                            onFromChange={(v) => {
                                setFromDate(v);
                                setPage(1);
                            }}
                            onToChange={(v) => {
                                setToDate(v);
                                setPage(1);
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="btn btn-outline-primary inline-flex h-[38px] shrink-0 items-center px-4 py-0 text-sm"
                    >
                        Clear all filters
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                        {error}
                    </div>
                )}

                <PatientTable
                    patients={items}
                    loading={loading}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    sortDisabled={loading}
                />

                {!loading && !error && (
                    <div className="mt-6 flex flex-col gap-4 border-t border-white-light pt-5 dark:border-[#191e3a] sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {total === 0 ? (
                                <>0 patients</>
                            ) : (
                                <>
                                    Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>
                                    –
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
                                </>
                            )}
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span>Rows</span>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="form-input cursor-pointer py-1.5 pl-3 pr-8 text-sm"
                                >
                                    {LIMIT_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    title="Previous page"
                                    disabled={page <= 1 || loading}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="min-w-[5.5rem] text-center text-sm text-gray-600 dark:text-gray-400">
                                    Page {page} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    title="Next page"
                                    disabled={page >= totalPages || loading || total === 0}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientList;
