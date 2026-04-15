import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Pencil, Search } from 'lucide-react';
import { appointmentAPI } from '../../services/api';
import NewDropdown from '@/components/ui/NewDropdown';
import { ActionIconTooltip } from '@/components/ui/ActionIconTooltip';
import { DateRangePicker } from '@/components/patients/DateRangePicker';

type AppointmentRow = {
  _id?: string;
  id?: string;
  patientId?: string;
  patientName?: string;
  startDate?: string;
  startTime?: string;
  providerName?: string;
  visitReasonmsg?: string;
  visitReasonName?: string;
  appointmentStatus?: string;
};

type AppointmentListApiShape = {
  rows: AppointmentRow[];
  total: number;
};

type FilterState = {
  status: string;
  providerId: string;
  dateFrom: string;
  dateTo: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function rowId(row: AppointmentRow): string {
  return String(row?._id ?? row?.id ?? '').trim();
}

function renderDateTime(row: AppointmentRow): string {
  const date = String(row.startDate ?? '').trim();
  const time = String(row.startTime ?? '').trim();
  if (!date && !time) return '—';
  if (!date) return time || '—';
  const parsed = new Date(date);
  const displayDate = Number.isNaN(parsed.getTime()) ? date : format(parsed, 'MM/dd/yyyy');
  return time ? `${displayDate} ${time}` : displayDate;
}

function mapAppointmentRow(raw: any): AppointmentRow {
  if (!raw || typeof raw !== 'object') return {};

  return {
    _id: typeof raw?._id === 'string' ? raw._id : undefined,
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    patientId: typeof raw?.patientId === 'string' ? raw.patientId : undefined,
    patientName: typeof raw?.patientName === 'string' ? raw.patientName : undefined,
    startDate: typeof raw?.startDate === 'string' ? raw.startDate : undefined,
    startTime: typeof raw?.startTime === 'string' ? raw.startTime : undefined,
    providerName: typeof raw?.providerName === 'string' ? raw.providerName : undefined,
    visitReasonmsg: typeof raw?.visitReasonmsg === 'string' ? raw.visitReasonmsg : undefined,
    visitReasonName: typeof raw?.visitReasonName === 'string' ? raw.visitReasonName : undefined,
    appointmentStatus: typeof raw?.appointmentStatus === 'string' ? raw.appointmentStatus : undefined,
  };
}

function normalizeAppointmentListResponse(raw: any): AppointmentListApiShape {
  const root = raw?.data ?? raw ?? {};
  const payload = root?.data ?? root?.result ?? root;

  const items =
    (Array.isArray(payload) && payload) ||
    payload?.items ||
    payload?.rows ||
    payload?.appointments ||
    payload?.list ||
    payload?.data ||
    payload?.results ||
    payload?.records ||
    payload?.appointmentList ||
    payload?.appointmentDetails ||
    payload?.pagination?.items ||
    payload?.pagination?.rows ||
    [];

  const pagination = payload?.pagination ?? payload?.pageInfo ?? root?.pagination ?? root?.pageInfo ?? {};
  const resolvedRows = Array.isArray(items) ? items.map(mapAppointmentRow) : [];
  const resolvedTotal =
    Number(
      pagination?.total ??
        pagination?.totalCount ??
        pagination?.totalRecords ??
        payload?.total ??
        payload?.totalCount ??
        payload?.totalRecords ??
        root?.total ??
        root?.totalCount ??
        root?.totalRecords
    ) || resolvedRows.length;

  return { rows: resolvedRows, total: resolvedTotal };
}

function appointmentStatusPillClass(status: string | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  if (!s) {
    return 'border border-gray-200/80 bg-gray-50/90 text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-400';
  }
  if (s.includes('cancel')) {
    return 'border border-rose-100/90 bg-rose-50/90 text-rose-900/80 dark:border-rose-900/40 dark:bg-rose-950/35 dark:text-rose-100/90';
  }
  if (s.includes('confirm') || s.includes('schedul')) {
    return 'border border-emerald-100/90 bg-emerald-50/90 text-emerald-900/80 dark:border-emerald-900/35 dark:bg-emerald-950/30 dark:text-emerald-100/90';
  }
  if (s.includes('complet')) {
    return 'border border-primary-100/90 bg-primary-50/90 text-primary-900/85 dark:border-primary-800/50 dark:bg-primary-900/25 dark:text-primary-100/90';
  }
  if (s.includes('no show') || s.includes('noshow')) {
    return 'border border-stone-200/90 bg-stone-100/90 text-stone-700 dark:border-white/[0.08] dark:bg-stone-900/40 dark:text-stone-200';
  }
  return 'border border-gray-200/80 bg-gray-50/90 text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300';
}

function AppointmentStatusPill({ status }: { status: string | undefined }) {
  const label = (status ?? '').trim() || '—';
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize leading-tight ${appointmentStatusPillClass(status)}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          <td className="px-2.5 py-2" colSpan={6}>
            <div className="h-3.5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </td>
        </tr>
      ))}
    </>
  );
}

const AppointmentList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState<string>('');
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    providerId: '',
    dateFrom: '',
    dateTo: '',
  });

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadProviders = useCallback(async () => {
    try {
      const res = await appointmentAPI.getDropdownListData({ listName: 'users', sortBy: 'firstName' });
      const items = Array.isArray(res?.data?.data) ? res.data.data : [];
      const options = items
        .filter((x: any) => x?.status && Array.isArray(x?.role) && x.role.some((r: string) => r.toLowerCase() === 'provider'))
        .map((x: any) => ({
          id: String(x?._id ?? x?.id ?? ''),
          name: [x?.prefix, x?.firstName, x?.lastName, x?.suffix].filter(Boolean).join(' ').trim(),
        }))
        .filter((x: { id: string; name: string }) => !!x.id);
      setProviders(options);
    } catch (error) {
      console.error('Provider dropdown failed', error);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        fromDate: filters.dateFrom || undefined,
        toDate: filters.dateTo || undefined,
        page,
        limit: pageSize,
        providerIds: filters.providerId ? [filters.providerId] : undefined,
        status: filters.status || undefined,
        sortField: 'startDate',
        sortOrder: 'asc',
      };

      const res = await appointmentAPI.getAppointmentListPaginated(payload);
      const normalized = normalizeAppointmentListResponse(res);
      setRows(normalized.rows);
      setTotal(normalized.total);
    } catch (error) {
      console.error(error);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.providerId, filters.status, page, pageSize]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const state = location.state as { refreshAppointments?: boolean } | null;
    if (!state?.refreshAppointments) return;
    loadRows();
    navigate(location.pathname, { replace: true });
  }, [loadRows, location.pathname, location.state, navigate]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((row) =>
      [row.patientName, row.providerName, row.visitReasonName, row.visitReasonmsg, row.appointmentStatus]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [rows, search]);

  const safePage = Math.min(page, pages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div
      className="font-inter relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[#141210] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)]"
    >
      <div className="shrink-0 space-y-3 p-4 sm:p-5 sm:pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
              <Calendar className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">Appointment List</h1>
              <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-500">Scheduled visits and follow-ups</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full min-w-0 sm:w-60 lg:w-72">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
                <Search className="h-4 w-4" aria-hidden />
              </span>
              <input
                type="search"
                placeholder="Search by name, reason, or status"
                autoComplete="off"
                className="w-full rounded-lg border border-gray-200/80 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary/15 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary-600"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/appointments/add')}
              className="inline-flex h-8 w-full shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-600 hover:shadow-primary sm:w-auto"
            >
              Create Appointment
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200/50 pt-3 dark:border-white/[0.06]">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-nowrap md:items-end md:gap-3">
            <div className="min-w-0 flex-1 md:min-w-0">
              <NewDropdown
                id="appt-list-status"
                label="Status"
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'Scheduled', label: 'Scheduled' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Cancelled', label: 'Cancelled' },
                  { value: 'No Show', label: 'No Show' },
                ]}
                value={filters.status}
                onChange={(v) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, status: v as string }));
                }}
                placeholder="All statuses"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 flex-1 md:min-w-0">
              <NewDropdown
                id="appt-list-provider"
                label="Provider"
                options={[
                  { value: '', label: 'All providers' },
                  ...providers.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ]}
                value={filters.providerId}
                onChange={(v) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, providerId: v as string }));
                }}
                placeholder="All providers"
                className="w-full min-w-0"
              />
            </div>
            <div className="min-w-0 flex-1 md:max-w-[320px]">
              <DateRangePicker
                label="Reg. Date"
                className="w-full min-w-0"
                value={{
                  from: filters.dateFrom || '',
                  to: filters.dateTo || '',
                }}
                onChange={(range) => {
                  setPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    dateFrom: range?.from || '',
                    dateTo: range?.to || '',
                  }));
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFilters({ status: '', providerId: '', dateFrom: '', dateTo: '' });
                setSearch('');
              }}
              className="inline-flex h-8 shrink-0 items-center justify-center self-start rounded-lg border border-transparent px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-100/80 dark:text-gray-400 dark:hover:bg-white/[0.04] md:self-auto"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden border-t border-gray-200/50 px-4 pb-4 pt-3 dark:border-white/[0.06] sm:px-5 sm:pb-5 sm:pt-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:hidden">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pe-1">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No appointments found.</p>
            ) : (
              filteredRows.map((row) => {
                const id = rowId(row);
                return (
                  <article
                    key={id || `${row.patientName}-${row.startDate}`}
                    className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#1a1a1a]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{row.patientName || '—'}</h3>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{renderDateTime(row)}</p>
                      </div>
                      <AppointmentStatusPill status={row.appointmentStatus} />
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex justify-between gap-2">
                        <dt className="font-bold text-dark dark:text-gray-200">Provider</dt>
                        <dd className="max-w-[55%] truncate text-right font-medium text-gray-900 dark:text-white">
                          {row.providerName || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-bold text-dark dark:text-gray-200">Reason</dt>
                        <dd className="max-w-[55%] truncate text-right">{row.visitReasonmsg || row.visitReasonName || '—'}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex justify-end">
                      <ActionIconTooltip label="Edit appointment">
                        <button
                          type="button"
                          disabled={!id}
                          aria-label="Edit appointment"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                          onClick={() => {
                            if (!id) return;
                            navigate(`/app/appointments/add?appointmentId=${encodeURIComponent(id)}`);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </ActionIconTooltip>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          {!loading && total > 0 ? (
            <div className="mt-2 flex shrink-0 flex-col gap-2 border-t border-gray-200/70 pt-2 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span>Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-md border border-gray-200/80 bg-white px-2 text-xs dark:border-white/[0.08] dark:bg-[#1a1816]"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {pages > 1 ? (
                  <div className="flex items-center gap-0.5">
                    <ActionIconTooltip label="Previous page">
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    </ActionIconTooltip>
                    <span className="min-w-[4.75rem] text-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
                      {safePage}/{pages}
                    </span>
                    <ActionIconTooltip label="Next page">
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={safePage >= pages}
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </ActionIconTooltip>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#1a1a1a] dark:shadow-none md:flex md:min-h-[16rem] md:flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-gray-200/80 bg-gray-50/90 text-[10px] font-bold uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#1c1c1c]/95 dark:text-gray-400">
                <tr>
                  <th className="px-2.5 py-2">Patient</th>
                  <th className="px-2.5 py-2">Date / time</th>
                  <th className="px-2.5 py-2">Provider</th>
                  <th className="px-2.5 py-2">Visit reason</th>
                  <th className="px-2.5 py-2">Status</th>
                  <th className="px-2.5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/90 dark:divide-white/[0.05]">
                {loading ? (
                  <TableSkeletonRows />
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2.5 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const id = rowId(row);
                    return (
                      <tr
                        key={id || `${row.patientName}-${row.startDate}`}
                        className="transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.04]"
                      >
                        <td className="px-2.5 py-1.5 font-medium text-gray-900 dark:text-white">{row.patientName || '—'}</td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-gray-600 dark:text-gray-300">{renderDateTime(row)}</td>
                        <td className="max-w-[160px] truncate px-2.5 py-1.5 text-gray-800 dark:text-gray-200">{row.providerName || '—'}</td>
                        <td className="max-w-[200px] truncate px-2.5 py-1.5 text-gray-800 dark:text-gray-200">
                          {row.visitReasonmsg || row.visitReasonName || '—'}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <AppointmentStatusPill status={row.appointmentStatus} />
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <ActionIconTooltip label="Edit appointment">
                            <button
                              type="button"
                              disabled={!id}
                              aria-label="Edit appointment"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]"
                              onClick={() => {
                                if (!id) return;
                                navigate(`/app/appointments/add?appointmentId=${encodeURIComponent(id)}`);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </ActionIconTooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && total > 0 ? (
            <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200/70 px-2.5 py-2 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-gray-100">{from}</span>–
                <span className="font-medium text-gray-900 dark:text-gray-100">{to}</span> of{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span>Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-md border border-gray-200/80 bg-white px-2 text-xs dark:border-white/[0.08] dark:bg-[#1a1816]"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {pages > 1 ? (
                  <div className="flex items-center gap-0.5">
                    <ActionIconTooltip label="Previous page">
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    </ActionIconTooltip>
                    <span className="min-w-[4.75rem] text-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
                      {safePage}/{pages}
                    </span>
                    <ActionIconTooltip label="Next page">
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={safePage >= pages}
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200/80 bg-white text-gray-700 transition hover:bg-gray-50/80 disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </ActionIconTooltip>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AppointmentList;
