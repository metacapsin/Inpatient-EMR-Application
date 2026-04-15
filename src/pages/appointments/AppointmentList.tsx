import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { appointmentAPI } from '../../services/api';
import AppButton from '@/components/ui/AppButton';
import NewDropdown from '@/components/ui/NewDropdown';
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

const PAGE_SIZE = 10;

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

const AppointmentList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState<string>('');
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    providerId: '',
    dateFrom: '',
    dateTo: '',
  });

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

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
        limit: PAGE_SIZE,
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
  }, [filters.dateFrom, filters.dateTo, filters.providerId, filters.status, page]);

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
    return rows.filter(row =>
      [row.patientName, row.providerName, row.visitReasonName, row.visitReasonmsg, row.appointmentStatus]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [rows, search]);

  return (
<>
    <div className="panel">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
    <h2 className="text-xl font-semibold">Appointment List</h2>
    {/* Search + Button container */}
    <div className="flex items-center gap-3">
      <div className="relative w-60 sm:w-72">
  
  {/* Search Icon */}
  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  </span>

  <input
    type="text"
    placeholder="Search by name, MRN, or phone"
      // className="w-full sm:max-w-md lg:max-w-lg"
    className="w-full rounded-lg border border-gray-100 py-2 pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-md lg:max-w-lg"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

</div>  
        <AppButton onClick={() => navigate('/app/appointments/add')}>
      Create Appointment
      </AppButton>


    </div>
  </div>

      <div className="mb-4 flex shrink-0 flex-col gap-3 border-t border-white-light pt-4 dark:border-[#191e3a] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 pt-1 lg:gap-4">
          <div className="w-40">
            <NewDropdown
              variant="outlined"
              label="Status"
              options={[
                { value: '', label: 'All Status' },
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
              placeholder="All Status"
            />
          </div>
          <div className="w-48 min-w-[11rem] max-w-full sm:w-52">
            <NewDropdown
              variant="outlined"
              label="Provider"
              options={[
                { value: '', label: 'All Providers' },
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
              placeholder="All Providers"
            />
          </div>
          <div className="min-w-[240px] max-w-full sm:min-w-[260px] sm:max-w-[320px]">
            <DateRangePicker
              label="Date"
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
        </div>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setFilters({ status: '', providerId: '', dateFrom: '', dateTo: '' });
            setSearch('');
          }}
          className="btn btn-outline-primary inline-flex h-8 max-h-[32px] shrink-0 items-center px-3 py-0 text-xs"
        >
          Clear Filters
        </button>
      </div>

      <div className="table-responsive">
        <table className="table-hover">
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Date / Time</th>
              <th>Provider</th>
              <th>Visit Reason</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8">Loading appointments...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8">No appointments found.</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={rowId(row) || `${row.patientName}-${row.startDate}`}>
                  <td>{row.patientName || '—'}</td>
                  <td>{renderDateTime(row)}</td>
                  <td>{row.providerName || '—'}</td>
                  <td>{row.visitReasonmsg || row.visitReasonName || '—'}</td>
                  <td>{row.appointmentStatus || '—'}</td>
                  <td>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          const id = rowId(row);
                          if (!id) return;
                          navigate(`/app/appointments/add?appointmentId=${encodeURIComponent(id)}`);
                        }}
                      >
                        Edit  
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">Page {page} of {pages}</p>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
    </>
  );
  
};


export default AppointmentList;