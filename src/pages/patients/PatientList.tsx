import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { NavLink, useSearchParams } from 'react-router-dom';
import { DateRangePicker } from '../../components/patients/DateRangePicker';
import { FilterSelect } from '../../components/patients/FilterSelect';
import { SearchInput } from '../../components/patients/SearchInput';
import PatientTable from '../../components/patients/PatientTable';
import { AdtPatientWorkflowModal } from '../../components/adt/AdtPatientWorkflowModal';
import type { AdtWorkflowIntent } from '../../components/adt/AdtPatientWorkflowModal';
import {
    activeEncounterRowsToAdtMergePayload,
    listActiveEncounters,
    patientIdSetFromActiveEncounters,
} from '../../services/adt.service';
import { mergeActiveEncountersFromServer } from '../../store/adtEncounterSlice';
import type { AppDispatch } from '../../store';
import { getPatientListRowId } from '../../services/patient.service';
import {
    getPatientsList,
    parsePatientListSortField,
    type PatientListItem,
    type PatientListSortField,
} from '../../services/patient.service';
type DateRange = {
    from: string;
    to: string;
  };
const LIMIT_OPTIONS = [10, 25, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

const GENDER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
];

const AGE_RANGE_URL_VALUES = ['0-18', '19-64', '65+'] as const;

const AGE_OPTIONS = [
    { value: 'all', label: 'All ages' },
    { value: '0-18', label: '0–18' },
    { value: '19-35', label: '19–35' },
    { value: '65+', label: '65+' },
];

function normalizeAgeRangeParam(raw: string | null): string {
    const v = (raw ?? '').trim();
    if (!v || v === 'all') return 'all';
    if ((AGE_RANGE_URL_VALUES as readonly string[]).includes(v)) return v;
    if (v === '0-17') return '0-18';
    if (v === '18-64') return '19-64';
    return 'all';
}

const RECENT_OPTIONS = [
    { value: 'all', label: 'All patients' },
    { value: 'today', label: 'Today' },
    { value: 'thismonth', label: 'This Month' },
    { value: 'last5recent', label: 'Last 5 Recent' },
  ];

type StatusValue = 'all' | 'active' | 'inactive';

interface ListQueryState {
    page: number;
    limit: number;
    status: StatusValue;
    gender: string;
    ageRange: string;
    recent: string;
    startDate: string;
    endDate: string;
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
            return 'active';
        })(),
        gender: sp.get('gender') || 'all',
        ageRange: normalizeAgeRangeParam(sp.get('ageRange')),
        recent: sp.get('recent') || 'all',
        startDate: sp.get('startDate') || sp.get('fromDate') || '',
        endDate: sp.get('endDate') || sp.get('toDate') || '',
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
    if (q.gender !== 'all') p.set('gender', q.gender);
    if (q.ageRange !== 'all') p.set('ageRange', q.ageRange);
    if (q.recent !== 'all') p.set('recent', q.recent);
    if (q.startDate) p.set('startDate', q.startDate);
    if (q.endDate) p.set('endDate', q.endDate);
    p.set('sortBy', q.sortBy);
    p.set('sortOrder', q.sortOrder);
    return p;
}

/** True if two query strings have the same keys and values (order-insensitive). Avoids sync churn when only param ordering differs. */
function patientListQueryStringEqual(a: string, b: string): boolean {
    const pa = new URLSearchParams(a);
    const pb = new URLSearchParams(b);
    const keys = new Set<string>([...pa.keys(), ...pb.keys()]);
    for (const k of keys) {
        if ((pa.get(k) ?? '') !== (pb.get(k) ?? '')) return false;
    }
    return true;
}

const PatientList = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [searchParams, setSearchParams] = useSearchParams();
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const lastSyncedSearchParams = useRef<string | null>(null);
    const isFirstDebounce = useRef(true);

    const initial = readListQuery(searchParams);

    const [page, setPage] = useState(initial.page);
    const [limit, setLimit] = useState(initial.limit);
    const [status, setStatus] = useState<StatusValue>(initial.status);
    const [gender, setGender] = useState(initial.gender);
    const [ageRange, setAgeRange] = useState(initial.ageRange);
    const [recent, setRecent] = useState(initial.recent);
    const [dateRange, setDateRange] = useState({
        from: initial.startDate,
        to: initial.endDate,
      });
    // const [toDate, setToDate] = useState(initial.toDate);
    const [sortBy, setSortBy] = useState<PatientListSortField>(initial.sortBy);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initial.sortOrder);
    const [searchInput, setSearchInput] = useState(initial.search);
    const [debouncedSearch, setDebouncedSearch] = useState(initial.search);

    const [items, setItems] = useState<PatientListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** Patient ids with an active inpatient encounter from GET /api/admissions/active (aligned with bed board). */
    const [serverActivePatientIds, setServerActivePatientIds] = useState<ReadonlySet<string>>(() => new Set());

    const [adtModal, setAdtModal] = useState<{ patient: PatientListItem; intent: AdtWorkflowIntent } | null>(null);

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
        if (
            lastSyncedSearchParams.current !== null &&
            patientListQueryStringEqual(cur, lastSyncedSearchParams.current)
        ) {
            return;
        }
    
        const r = readListQuery(searchParams);
        setPage(r.page);
        setLimit(r.limit);
        setStatus(r.status);
        setGender(r.gender);
        setAgeRange(r.ageRange);
        setRecent(r.recent);
    
        if (r.startDate !== dateRange.from || r.endDate !== dateRange.to) {
            setDateRange({ from: r.startDate, to: r.endDate });
        }
    
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
            gender,
            ageRange,
            recent,
            startDate: dateRange.from,
            endDate: dateRange.to,
            sortBy,
            sortOrder,
            search: debouncedSearch,
        }).toString();
    
        if (patientListQueryStringEqual(next, searchParams.toString())) return;
    
        lastSyncedSearchParams.current = next;
        setSearchParams(new URLSearchParams(next), { replace: true });
    }, [
        page,
        limit,
        status,
        gender,
        ageRange,
        recent,
        dateRange, // 🔥 FIX
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
            const [listOutcome, encOutcome] = await Promise.allSettled([
                getPatientsList({
                    page,
                    limit,
                    status,
                    gender,
                    ageRange,
                    recent,
                    startDate: dateRange.from,
                    endDate: dateRange.to,
                    search: debouncedSearch,
                    sortBy,
                    sortOrder,
                }),
                listActiveEncounters(),
            ]);

            if (listOutcome.status === 'rejected') {
                throw listOutcome.reason;
            }
            const res = listOutcome.value;
            setItems(res.items);
            setTotal(res.total);

            let nextServerActive = new Set<string>();
            if (encOutcome.status === 'fulfilled' && encOutcome.value.ok) {
                const encRows = encOutcome.value.data;
                nextServerActive = patientIdSetFromActiveEncounters(encRows);
                dispatch(mergeActiveEncountersFromServer(activeEncounterRowsToAdtMergePayload(encRows)));
            }
            setServerActivePatientIds(nextServerActive);
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Failed to load patients';
            setError(msg);
            setItems([]);
            setTotal(0);
            setServerActivePatientIds(new Set());
        } finally {
            setLoading(false);
        }
    }, [page, limit, status, gender, ageRange, recent, dateRange, debouncedSearch, sortBy, sortOrder, dispatch]);
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
        setGender('all');
        setAgeRange('all');
        setRecent('all');
        setDateRange({ from: '', to: '' });
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0">
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

            <div className="mt-3 shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white-light pt-4 dark:border-[#191e3a]">
                <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 lg:gap-4">
                        <FilterSelect label="Status" value={status} onChange={(v) => {
                            setStatus(v as StatusValue);
                            setPage(1);
                        }} options={STATUS_OPTIONS} />
                        <FilterSelect label="Gender" value={gender} onChange={(v) => {
                            setGender(v);
                            setPage(1);
                        }} options={GENDER_OPTIONS} />
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
                            value={dateRange}
                            onChange={(range) => {
                                setDateRange(range);

                                if (range.from && range.to) {
                                    setPage(1);
                                }
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

                {error ? (
                    <div className="mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                        {error}
                    </div>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                        <PatientTable
                            patients={items}
                            loading={loading}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSort={handleSort}
                            sortDisabled={loading}
                            serverActivePatientIds={serverActivePatientIds}
                            onOpenAdt={(patient, intent) => setAdtModal({ patient, intent })}
                        />
                    </div>

                    {!loading && !error ? (
                        <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-white-light pt-3 dark:border-[#191e3a] sm:flex-row sm:items-center sm:justify-between">
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
                    ) : null}
                </div>
            </div>

            {adtModal ? (
                <AdtPatientWorkflowModal
                    open
                    patientId={getPatientListRowId(adtModal.patient)}
                    patientLabel={adtModal.patient.name}
                    intent={adtModal.intent}
                    onClose={() => setAdtModal(null)}
                    onCompleted={() => void load()}
                />
            ) : null}
        </div>
    );
};

export default PatientList;
