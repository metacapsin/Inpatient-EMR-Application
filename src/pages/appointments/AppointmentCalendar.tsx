import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { appointmentAPI } from '../../services/api';
import { format, parseISO, isValid } from 'date-fns';
import {
  FaCalendar,
  FaFilter,
  FaList,
  FaPlus,
  FaUser,
  FaMapMarkerAlt,
  FaBriefcase,
  FaDollarSign,
  FaHistory,
  FaChevronDown,
  FaTimes,
} from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';

export interface CalendarAppointment {
  _id: string;
  patientName: string;
  patientId: string;
  providerName: string;
  providerId?: string;
  serviceLocationName: string;
  serviceLocationId?: string;
  roomNumber?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  duration?: number;
  visitReasonName: string;
  visitReasonmsg?: string;
  appointmentStatus: string;
  emailTo?: string;
  phoneNo?: string;
  dob?: string;
  sex?: string;
  otherReason?: string;
}

interface ProviderOption {
  _id: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  suffix?: string;
  name?: string;
  fullName?: string;
}

interface LocationOption {
  _id: string;
  id?: string;
  name?: string;
  locationName?: string;
  serviceLocationName?: string;
}

interface AppointmentCalendarProps {
  onListView: () => void;
  onAddAppointment: () => void;
}

const VISIBLE_IN_DAY_CELL = 1;

// Palette for visit-type colour dots in the legend
const LEGEND_COLORS = [
  '#4361ee',
  '#e7515a',
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

function getProviderDisplayName(p: ProviderOption): string {
  if (p.fullName) return p.fullName;
  if (p.name) return p.name;
  return [p.prefix, p.firstName, p.lastName, p.suffix].filter(Boolean).join(' ').trim() || 'Unknown';
}

function getLocationDisplayName(l: LocationOption): string {
  return l.locationName || l.serviceLocationName || l.name || 'Unknown';
}

function extractArray(res: any, keys: string[]): any[] {
  const root = res?.data ?? res ?? {};
  const data = root?.data ?? root?.result ?? root?.results ?? root;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  if (Array.isArray(data)) return data;
  return [];
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  onListView,
  onAddAppointment,
}) => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [serviceLocations, setServiceLocations] = useState<LocationOption[]>([]);
  const [visibleLocations, setVisibleLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile / tablet: drawer overlay for filters
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Filters
  const [providerSearch, setProviderSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Current calendar date range for fetching
  const [dateRange, setDateRange] = useState<{ fromDate: string; toDate: string }>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { fromDate: fmt(from), toDate: fmt(to) };
  });

  // Modals
  const [moreModalDate, setMoreModalDate] = useState<Date | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<CalendarAppointment | null>(null);

  const calendarRef = useRef<FullCalendar>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const parseAppointmentDateTime = (appt: CalendarAppointment): { start: Date; end: Date } => {
    let start: Date;
    const dateStr = appt.startDate;
    const timeStr = appt.startTime || '00:00';

    if (!dateStr) {
      start = new Date();
    } else {
      try {
        const d = typeof dateStr === 'string' && dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr);
        start = isValid(d) ? new Date(d) : new Date();
      } catch {
        start = new Date(dateStr);
      }
    }

    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m2 = parseInt(match[2], 10);
        const ampm = (match[3] || '').toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        start.setHours(h, m2, 0, 0);
      }
    }

    const durationMins = appt.duration ?? 15;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    return { start, end };
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchStaticData = useCallback(async () => {
    try {
      const [provRes, locRes] = await Promise.allSettled([
        appointmentAPI.getProviderList(),
        appointmentAPI.getServiceLocationList(),
      ]);

      if (provRes.status === 'fulfilled') {
        const list = extractArray(provRes.value, ['providers', 'providerList', 'data', 'list', 'results']);
        setProviders(list.filter((p: any) => p?._id || p?.id));
      }
      if (locRes.status === 'fulfilled') {
        const list = extractArray(locRes.value, ['serviceLocations', 'locationList', 'locations', 'data', 'list', 'results']);
        setServiceLocations(list.filter((l: any) => l?._id || l?.id));
        setVisibleLocations(list.filter((l: any) => l?._id || l?.id));
      }
    } catch {
      // non-fatal; calendar still loads
    }
  }, []);

  // Stable fetch — all variable inputs passed as explicit params so useCallback deps stay []
  const fetchAppointments = useCallback(
    async (
      range: { fromDate: string; toDate: string },
      provId: string | null,
      locId: string | null
    ) => {
      setLoading(true);
      setError(null);
      try {
        const payload: Record<string, any> = {
          fromDate: range.fromDate,
          toDate: range.toDate,
          page: 1,
          limit: 500,
          sortField: 'startDate',
          sortOrder: 'asc',
        };
        if (provId) payload.providerIds = [provId];
        if (locId) payload.serviceIds = [locId];

        const res = await appointmentAPI.getAppointmentListPaginated(payload);
        const root = res?.data ?? res ?? {};
        const data = root?.data ?? root?.result ?? root?.results ?? root;
        const items: any[] =
          (Array.isArray(data) && data) ||
          data?.items ||
          data?.rows ||
          data?.appointments ||
          data?.list ||
          data?.appointmentList ||
          data?.appointmentDetails ||
          data?.pagination?.items ||
          [];

        const mapped: CalendarAppointment[] = items.map((r: any) => ({
          _id: String(r?._id ?? r?.id ?? Math.random()),
          patientName: r?.patientName ?? r?.patient?.fullName ?? '',
          patientId: r?.patientId ?? '',
          providerName: r?.providerName ?? '',
          providerId: r?.providerId ?? '',
          serviceLocationName: r?.serviceLocationName ?? '',
          serviceLocationId: r?.serviceLocationId ?? '',
          roomNumber: r?.roomNumber,
          startDate: r?.startDate ?? '',
          startTime: r?.startTime,
          endDate: r?.endDate,
          endTime: r?.endTime,
          duration: r?.duration,
          visitReasonName: r?.visitReasonName ?? r?.visitReasonmsg ?? '',
          visitReasonmsg: r?.visitReasonmsg,
          appointmentStatus: r?.appointmentStatus ?? '',
          emailTo: r?.emailTo,
          phoneNo: r?.phoneNo,
          dob: r?.dob,
          sex: r?.sex,
          otherReason: r?.otherReason,
        }));

        setAppointments(mapped);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load appointments');
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    },
    [] // stable — params are passed at call-site
  );

  // When a provider is selected, also fetch provider-specific locations
  const handleProviderSelect = useCallback(
    async (providerId: string | null) => {
      setSelectedProviderId(providerId);
      setSelectedLocationId(null);
      if (providerId) {
        try {
          const res = await appointmentAPI.getProviderServiceLocations(providerId);
          const list = extractArray(res, ['serviceLocations', 'locationList', 'locations', 'data', 'list', 'results']);
          if (list.length > 0) {
            setVisibleLocations(list.filter((l: any) => l?._id || l?.id));
            return;
          }
        } catch {
          // fall through to show all locations
        }
      }
      setVisibleLocations(serviceLocations);
    },
    [serviceLocations]
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  useEffect(() => {
    fetchAppointments(dateRange, selectedProviderId, selectedLocationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.fromDate, dateRange.toDate, selectedProviderId, selectedLocationId]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    return providers.filter((p) => !q || getProviderDisplayName(p).toLowerCase().includes(q));
  }, [providers, providerSearch]);

  const filteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    return visibleLocations.filter((l) => !q || getLocationDisplayName(l).toLowerCase().includes(q));
  }, [visibleLocations, locationSearch]);

  const activeFiltersCount = (selectedProviderId ? 1 : 0) + (selectedLocationId ? 1 : 0);

  // Stats
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const stats = useMemo(() => {
    const next7 = new Date(today);
    next7.setDate(next7.getDate() + 7);
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 7);

    const todayCount = appointments.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start.toDateString() === today.toDateString();
    }).length;

    const next7Count = appointments.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start >= today && start <= next7;
    }).length;

    const last7Count = appointments.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start >= last7 && start < today;
    }).length;

    return { todayCount, next7Count, last7Count };
  }, [appointments, today]);

  // Visit-type legend
  const visitTypeLegend = useMemo(() => {
    const types = Array.from(new Set(appointments.map((a) => a.visitReasonName).filter(Boolean)));
    return types.slice(0, 8).map((name, i) => ({ name, color: LEGEND_COLORS[i % LEGEND_COLORS.length] }));
  }, [appointments]);

  // Calendar events
  const calendarEvents = useMemo(() => {
    return appointments.map((appt) => {
      const { start, end } = parseAppointmentDateTime(appt);
      const typeIdx = visitTypeLegend.findIndex((v) => v.name === appt.visitReasonName);
      const color = typeIdx >= 0 ? LEGEND_COLORS[typeIdx % LEGEND_COLORS.length] : LEGEND_COLORS[0];
      return {
        id: appt._id,
        title: appt.patientName || 'Appointment',
        start: start.toISOString(),
        end: end.toISOString(),
        color,
        extendedProps: { appointment: appt },
      };
    });
  }, [appointments, visitTypeLegend]);

  // ── More-modal helpers ─────────────────────────────────────────────────────

  const handleMoreLinkClick = (info: { date: Date }) => {
    setMoreModalDate(info.date);
    return 'dayGridMonth' as any;
  };

  const appointmentsForMoreModal = useMemo(() => {
    if (!moreModalDate) return [];
    const dayStart = new Date(moreModalDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return appointments
      .filter((a) => {
        const { start } = parseAppointmentDateTime(a);
        return start >= dayStart && start < dayEnd;
      })
      .sort((a, b) => parseAppointmentDateTime(a).start.getTime() - parseAppointmentDateTime(b).start.getTime());
  }, [moreModalDate, appointments]);

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    const appointment = info.event.extendedProps?.appointment as CalendarAppointment | undefined;
    if (appointment) setDetailsAppointment(appointment);
  };

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(arg.start);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const from = new Date(arg.start);
    from.setDate(from.getDate() - 7);
    const to = new Date(arg.end);
    to.setDate(to.getDate() + 7);
    const newFrom = fmt(from);
    const newTo = fmt(to);
    // Only update state when the strings actually change — prevents FullCalendar
    // re-render from creating a new object reference and triggering an infinite loop.
    setDateRange((prev) =>
      prev.fromDate === newFrom && prev.toDate === newTo
        ? prev
        : { fromDate: newFrom, toDate: newTo }
    );
  }, []);

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-danger mb-4">{error}</p>
        <button onClick={() => fetchAppointments(dateRange, selectedProviderId, selectedLocationId)} className="btn btn-outline-primary">
          Retry
        </button>
      </div>
    );
  }

  // ── Shared filter panel content (used in both drawer and desktop sidebar) ─
  const FilterPanelContent = (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 p-2">
          <div className="font-bold text-primary text-sm">{providers.length}</div>
          <div className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight">Total Providers</div>
        </div>
        <div className="rounded-xl bg-success/5 dark:bg-success/10 border border-success/10 p-2">
          <div className="font-bold text-success text-sm">{serviceLocations.length}</div>
          <div className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight">Locations</div>
        </div>
        <div className="rounded-xl bg-info/5 dark:bg-info/10 border border-info/10 p-2">
          <div className="font-bold text-info text-sm">{activeFiltersCount}</div>
          <div className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight">Active</div>
        </div>
      </div>

      {/* Providers */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Providers</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Highlight specific care teams.</p>
        <div className="relative mb-2">
          <input
            type="text"
            className="form-input pl-9 text-sm"
            placeholder="Search providers"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="w-4 h-4" />
          </span>
        </div>
        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="radio" name="provider-filter" checked={selectedProviderId === null}
              onChange={() => { handleProviderSelect(null); setMobileDrawerOpen(false); }}
              className="form-radio text-primary" />
            <span className="text-gray-700 dark:text-gray-300">All providers</span>
          </label>
          {filteredProviders.map((p) => {
            const id = p._id || p.id || '';
            return (
              <label key={id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="provider-filter" checked={selectedProviderId === id}
                  onChange={() => { handleProviderSelect(id); setMobileDrawerOpen(false); }}
                  className="form-radio text-primary" />
                <span className="text-gray-700 dark:text-gray-300 truncate">{getProviderDisplayName(p)}</span>
              </label>
            );
          })}
          {filteredProviders.length === 0 && providerSearch && (
            <p className="text-xs text-gray-400 px-1">No providers found.</p>
          )}
        </div>
      </div>

      {/* Locations */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Service Locations</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Focus the calendar on specific sites.</p>
        <div className="relative mb-2">
          <input
            type="text"
            className="form-input pl-9 text-sm"
            placeholder="Search locations"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch className="w-4 h-4" />
          </span>
        </div>
        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="radio" name="location-filter" checked={selectedLocationId === null}
              onChange={() => { setSelectedLocationId(null); setMobileDrawerOpen(false); }}
              className="form-radio text-primary" />
            <span className="text-gray-700 dark:text-gray-300">All locations</span>
          </label>
          {filteredLocations.map((l) => {
            const id = l._id || l.id || '';
            return (
              <label key={id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="location-filter" checked={selectedLocationId === id}
                  onChange={() => { setSelectedLocationId(id); setMobileDrawerOpen(false); }}
                  className="form-radio text-primary" />
                <span className="text-gray-700 dark:text-gray-300 truncate">{getLocationDisplayName(l)}</span>
              </label>
            );
          })}
          {filteredLocations.length === 0 && locationSearch && (
            <p className="text-xs text-gray-400 px-1">No locations found.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => { handleProviderSelect(null); setSelectedLocationId(null); }}
        className="btn btn-outline-primary w-full btn-sm"
      >
        Clear all filters
      </button>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile/tablet filter drawer ───────────────────────────────────── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          {/* Drawer panel */}
          <div
            className="absolute left-0 top-0 h-full w-[min(300px,85vw)] overflow-y-auto bg-white dark:bg-[#0e1726] shadow-2xl border-r border-primary/10 dark:border-primary/20 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaFilter className="text-primary w-3.5 h-3.5" />
                <span className="font-semibold text-gray-800 dark:text-white">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Stack providers &amp; service locations to tailor the calendar.
            </p>
            {FilterPanelContent}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:gap-4">

        {/* ── Stats row – always at the top ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {[
            { label: 'Today',           value: stats.todayCount,        icon: <FaCalendar />,    bg: 'bg-primary/10 dark:bg-primary/15',   text: 'text-primary',  border: 'border-primary/15'  },
            { label: 'Next 7 Days',     value: stats.next7Count,        icon: <FaCalendar />,    bg: 'bg-success/10 dark:bg-success/15',   text: 'text-success',  border: 'border-success/15'  },
            { label: 'Last 7 Days',     value: stats.last7Count,        icon: <FaCalendar />,    bg: 'bg-info/10 dark:bg-info/15',         text: 'text-info',     border: 'border-info/15'     },
            { label: 'Active Providers',value: providers.length,        icon: <FaUser />,        bg: 'bg-warning/10 dark:bg-warning/15',   text: 'text-warning',  border: 'border-warning/15'  },
            { label: 'Active Locations',value: serviceLocations.length, icon: <FaMapMarkerAlt />,bg: 'bg-danger/10 dark:bg-danger/15',     text: 'text-danger',   border: 'border-danger/15'   },
          ].map(({ label, value, icon, bg, text, border }, i) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-xl border ${border} bg-white dark:bg-[#0e1726] p-3 shadow-sm
                ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${text} text-base`}>
                {icon}
              </div>
              <div className="min-w-0">
                <div className={`text-[10px] font-semibold uppercase tracking-wide truncate ${text}`}>{label}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main 3-column row ─────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">

          {/* Desktop left sidebar */}
          {!sidebarCollapsed && (
            <div className="hidden lg:block flex-shrink-0 w-72 rounded-2xl border border-primary/10 dark:border-primary/20 bg-gradient-to-b from-white to-gray-50/80 dark:from-[#0e1726] dark:to-[#1b2e4b] p-4 shadow-lg self-start">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                  className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 font-semibold"
                >
                  <FaChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersCollapsed ? '-rotate-90' : ''}`} />
                  Filters
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Stack providers &amp; service locations to tailor the calendar.
              </p>
              {!filtersCollapsed && FilterPanelContent}
            </div>
          )}

          {/* ── Calendar column ──────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 rounded-xl sm:rounded-2xl border border-primary/10 dark:border-primary/20 bg-white dark:bg-[#0e1726] p-3 sm:p-4 lg:p-5 shadow-lg">

            {/* Page header */}
            <div className="mb-3 sm:mb-4">
              <ul className="flex items-center gap-1 text-xs mb-1.5 flex-wrap text-gray-500 dark:text-gray-400">
                <li><a href="/app/appointments" className="text-primary hover:underline">Appointments</a></li>
                <li>/</li>
                <li className="text-gray-700 dark:text-gray-200 font-medium">Appointment Calendar</li>
              </ul>

              {/* ── Title row ── */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    Appointment Calendar
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">
                    Monitor provider coverage, visit mix, and location utilization in real time.
                  </p>
                </div>

                {/* ── Desktop: all three buttons inline ── */}
                <div className="hidden sm:flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={onListView}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/80 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/[0.08] transition">
                    <FaList className="w-3 h-3" />
                    List View
                  </button>
                  <button type="button" onClick={onAddAppointment}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 transition">
                    <FaPlus className="w-3 h-3" />
                    New Appointment
                  </button>
                  <button type="button"
                    onClick={() => setSidebarCollapsed((v) => !v)}
                    className="relative inline-flex items-center gap-1.5 rounded-lg border border-gray-200/80 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/[0.08] transition">
                    <FaFilter className="w-3 h-3" />
                    {sidebarCollapsed ? 'Show Filters' : 'Hide Filters'}
                    {activeFiltersCount > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-primary text-white text-[10px] font-bold px-1 leading-none">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Mobile only: stacked full-width buttons ── */}
              <div className="flex flex-col gap-2 sm:hidden">
                <button type="button" onClick={onListView}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/[0.06] transition active:scale-[0.98]">
                  <FaList className="w-3.5 h-3.5" />
                  List View
                </button>
                <button type="button" onClick={onAddAppointment}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition active:scale-[0.98]">
                  <FaPlus className="w-3.5 h-3.5" />
                  New Appointment
                </button>
              </div>
            </div>

            <div className="mb-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Schedule Overview
            </div>
            <div className="mb-0.5 text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
              Showing times in {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>

            {/* ── Mobile only: Show/Hide Filters button below toolbar ── */}
            <div className="sm:hidden mb-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-white/[0.06] transition active:scale-[0.98]"
              >
                <FaFilter className="w-3.5 h-3.5" />
                {activeFiltersCount > 0 ? `Filters (${activeFiltersCount} active)` : 'Show Filters'}
              </button>
            </div>

            {/* Calendar — horizontal scroll wrapper on small screens */}
            <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0 px-3 sm:px-4 lg:px-0">
              <div className="min-w-[320px] relative">
                {/* Loading overlay — keeps FullCalendar mounted to prevent blink */}
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75 dark:bg-[#0e1726]/75 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Loading appointments…
                    </div>
                  </div>
                )}
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  datesSet={handleDatesSet}
                  events={calendarEvents}
                  eventClick={handleEventClick}
                  dayMaxEvents={VISIBLE_IN_DAY_CELL}
                  moreLinkClick={handleMoreLinkClick}
                  headerToolbar={{
                    left: 'prev today next',
                    center: 'title',
                    right: 'dayGridMonth,listWeek,listDay',
                  }}
                  buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
                  height="auto"
                  listDayFormat={{ weekday: 'long', month: 'long', day: 'numeric' }}
                  listDaySideFormat={false}
                  noEventsText="No appointments"
                  eventContent={(arg) => {
                    const appt = arg.event.extendedProps.appointment as CalendarAppointment;
                    const { start, end } = parseAppointmentDateTime(appt);
                    const color = arg.event.backgroundColor || LEGEND_COLORS[0];
                    const isListView = arg.view.type === 'listWeek' || arg.view.type === 'listDay';

                    if (isListView) {
                      const status = (appt.appointmentStatus || '').trim();
                      const statusColor =
                        status.toLowerCase().includes('confirm') ? '#10b981' :
                        status.toLowerCase().includes('cancel') ? '#e7515a' :
                        status.toLowerCase().includes('complet') ? '#4361ee' :
                        '#9ca3af';
                      return (
                        <div className="py-1 cursor-pointer">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-semibold" style={{ color }}>
                              {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                            {appt.patientName || '—'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
                            {appt.providerName}
                          </div>
                          {appt.serviceLocationName && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                              {appt.serviceLocationName}
                            </div>
                          )}
                          {status && (
                            <div className="text-xs font-medium leading-snug mt-0.5" style={{ color: statusColor }}>
                              {status}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Month / grid view chip
                    const timeStr = format(start, 'h:mm a');
                    return (
                      <div
                        className="fc-event-main-frame cursor-pointer rounded border-l-2 sm:border-l-4 p-0.5 sm:p-1 shadow-sm min-h-0 overflow-hidden"
                        style={{ borderColor: color, backgroundColor: `${color}1a` }}
                      >
                        <div className="text-[9px] sm:text-[10px] font-semibold leading-tight truncate" style={{ color }}>
                          {timeStr}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-semibold text-gray-800 dark:text-white truncate leading-tight">
                          {appt.patientName}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight hidden sm:block">
                          {appt.providerName}
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            </div>

            {/* Visit Type Legend */}
            {visitTypeLegend.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                  Visit Type Legend
                </h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {visitTypeLegend.map(({ name, color }) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[11px] text-gray-600 dark:text-gray-400">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── "+X more" day modal ───────────────────────────────────────────────── */}
      {moreModalDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setMoreModalDate(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1b2e4b] shadow-2xl border border-primary/20 dark:border-primary/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
              <h3 className="font-semibold">{format(moreModalDate, 'MMMM d, yyyy')}</h3>
              <button
                type="button"
                onClick={() => setMoreModalDate(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-3 space-y-2">
              {appointmentsForMoreModal.map((appt) => {
                const { start } = parseAppointmentDateTime(appt);
                return (
                  <button
                    key={appt._id}
                    type="button"
                    onClick={() => {
                      setDetailsAppointment(appt);
                      setMoreModalDate(null);
                    }}
                    className="w-full text-left rounded-lg sm:rounded-xl p-2 sm:p-3 bg-gray-50 dark:bg-[#191e3a] hover:bg-primary/10 dark:hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all duration-200"
                  >
                    <div className="text-xs sm:text-sm font-medium text-primary">{format(start, 'h:mm a')}</div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">
                      {appt.patientName}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{appt.providerName}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{appt.visitReasonName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Appointment details modal ─────────────────────────────────────────── */}
      {detailsAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetailsAppointment(null)}
        >
          <div
            className="max-w-md w-full rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-white dark:bg-[#1b2e4b]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Appointment Details</h3>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
                onClick={() => setDetailsAppointment(null)}
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { icon: <FaUser />, label: 'Patient', value: detailsAppointment.patientName },
                { icon: <FaUser />, label: 'Provider', value: detailsAppointment.providerName },
                {
                  icon: <FaCalendar />,
                  label: 'Date',
                  value: format(parseAppointmentDateTime(detailsAppointment).start, 'EEEE, MMMM d, yyyy'),
                },
                {
                  icon: <FaCalendar />,
                  label: 'Time',
                  value: `${format(parseAppointmentDateTime(detailsAppointment).start, 'h:mm a')} – ${format(
                    parseAppointmentDateTime(detailsAppointment).end,
                    'h:mm a'
                  )}`,
                },
                { icon: <FaMapMarkerAlt />, label: 'Location', value: detailsAppointment.serviceLocationName },
                { icon: <FaBriefcase />, label: 'Visit Type', value: detailsAppointment.visitReasonName },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary text-sm sm:text-base">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">
                      {value || '—'}
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t border-white-light dark:border-[#191e3a] pt-3 sm:pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FaDollarSign className="text-gray-500 dark:text-gray-400 text-sm" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Payment</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm text-xs sm:text-sm w-full sm:w-auto justify-center"
                    onClick={() => navigate(`/app/facesheet?patientId=${detailsAppointment.patientId}`)}
                  >
                    <FaHistory className="mr-1" />
                    <span className="hidden sm:inline">View Payment History</span>
                    <span className="sm:hidden">Payment History</span>
                  </button>
                  <button type="button" className="btn btn-success btn-sm text-xs sm:text-sm w-full sm:w-auto justify-center">
                    <FaPlus className="mr-1" />
                    Create Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppointmentCalendar;
