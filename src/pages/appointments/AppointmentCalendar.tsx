import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { appointmentAPI } from '../../services/api';
import { format, parseISO, isValid } from 'date-fns';
import {
  FaCalendar,
  FaList,
  FaPlus,
  FaUser,
  FaMapMarkerAlt,
  FaBriefcase,
  FaDollarSign,
  FaHistory,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';

export interface CalendarAppointment {
  _id: string;
  patientName: string;
  patientId: string;
  providerName: string;
  serviceLocationName: string;
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

interface AppointmentCalendarProps {
  onListView: () => void;
  onAddAppointment: () => void;
}

const VISIBLE_IN_DAY_CELL = 1;

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  onListView,
  onAddAppointment,
}) => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('dayGridMonth');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filters
  const [providerSearch, setProviderSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Small modal for "+X more" (list of appointments for that day)
  const [moreModalDate, setMoreModalDate] = useState<Date | null>(null);

  // Appointment details modal
  const [detailsAppointment, setDetailsAppointment] = useState<CalendarAppointment | null>(null);

  const calendarRef = useRef<FullCalendar>(null);

  const parseAppointmentDateTime = (appt: CalendarAppointment): { start: Date; end: Date } => {
    let start: Date;
    const dateStr = appt.startDate;
    const timeStr = appt.startTime || '00:00';

    if (!dateStr) {
      start = new Date();
    } else {
      try {
        const d = typeof dateStr === 'string' && dateStr.includes('T') ? parseISO(dateStr) : new Date(dateStr);
        if (!isValid(d)) start = new Date();
        else start = new Date(d);
      } catch {
        start = new Date(dateStr);
      }
    }

    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = (match[3] || '').toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        start.setHours(h, m, 0, 0);
      }
    }

    const durationMins = appt.duration ?? 15;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    return { start, end };
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const userDetails = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const response = await appointmentAPI.getAppointments(userDetails.patientId || userDetails.rcopiaID);
      if (response.data?.data) {
        setAppointments(response.data.data);
      } else {
        setAppointments([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load appointments');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    let list = [...appointments];
    if (selectedProvider) {
      list = list.filter((a) => a.providerName === selectedProvider);
    }
    if (selectedLocation) {
      list = list.filter((a) => a.serviceLocationName === selectedLocation);
    }
    return list;
  }, [appointments, selectedProvider, selectedLocation]);

  const providers = useMemo(() => {
    const set = new Set(appointments.map((a) => a.providerName).filter(Boolean));
    return Array.from(set).sort();
  }, [appointments]);

  const locations = useMemo(() => {
    const set = new Set(appointments.map((a) => a.serviceLocationName).filter(Boolean));
    return Array.from(set).sort();
  }, [appointments]);

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return providers;
    const q = providerSearch.toLowerCase();
    return providers.filter((p) => p.toLowerCase().includes(q));
  }, [providers, providerSearch]);

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const q = locationSearch.toLowerCase();
    return locations.filter((l) => l.toLowerCase().includes(q));
  }, [locations, locationSearch]);

  const activeFiltersCount = (selectedProvider ? 1 : 0) + (selectedLocation ? 1 : 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7 = new Date(today);
  next7.setDate(next7.getDate() + 7);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);

  const stats = useMemo(() => {
    const list = filteredAppointments;
    const todayCount = list.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start.toDateString() === today.toDateString();
    }).length;
    const next7Count = list.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start >= today && start <= next7;
    }).length;
    const last7Count = list.filter((a) => {
      const { start } = parseAppointmentDateTime(a);
      return start >= last7 && start < today;
    }).length;
    const uniqueProviders = new Set(list.map((a) => a.providerName)).size;
    const uniqueLocations = new Set(list.map((a) => a.serviceLocationName)).size;
    return { todayCount, next7Count, last7Count, uniqueProviders, uniqueLocations };
  }, [filteredAppointments, today, next7, last7]);

  const calendarEvents = useMemo(() => {
    return filteredAppointments.map((appt) => {
      const { start, end } = parseAppointmentDateTime(appt);
      return {
        id: appt._id,
        title: appt.patientName || 'Appointment',
        start: start.toISOString(),
        end: end.toISOString(),
        extendedProps: { appointment: appt },
      };
    });
  }, [filteredAppointments]);

  const handleMoreLinkClick = (info: { date: Date }) => {
    setMoreModalDate(info.date);
    return 'dayGridMonth';
  };

  const appointmentsForMoreModal = useMemo(() => {
    if (!moreModalDate) return [];
    const dayStart = new Date(moreModalDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return filteredAppointments
      .filter((a) => {
        const { start } = parseAppointmentDateTime(a);
        return start >= dayStart && start < dayEnd;
      })
      .sort((a, b) => {
        const { start: sa } = parseAppointmentDateTime(a);
        const { start: sb } = parseAppointmentDateTime(b);
        return sa.getTime() - sb.getTime();
      });
  }, [moreModalDate, filteredAppointments]);

  const closeMoreModal = () => setMoreModalDate(null);

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    const appointment = info.event.extendedProps?.appointment as CalendarAppointment | undefined;
    if (appointment) setDetailsAppointment(appointment);
  };

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-danger mb-4">{error}</p>
        <button onClick={fetchAppointments} className="btn btn-outline-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
      {/* Left sidebar - Filters */}
      {!sidebarCollapsed && (
        <div
          className={`flex-shrink-0 w-full lg:w-72 rounded-xl sm:rounded-2xl border border-primary/10 dark:border-primary/20 bg-gradient-to-b from-white to-gray-50/80 dark:from-[#0e1726] dark:to-[#1b2e4b] p-3 sm:p-4 shadow-lg transition-all ${
            filtersCollapsed ? 'overflow-hidden' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="flex items-center gap-2 text-sm sm:text-base text-gray-800 dark:text-gray-200 font-semibold"
            >
              <FaChevronDown className={`w-4 h-4 transition-transform ${filtersCollapsed ? '-rotate-90' : ''}`} />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg hover:bg-white-light dark:hover:bg-[#191e3a] lg:hidden"
              aria-label="Hide filters"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Stack providers & service locations to tailor the calendar.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4 text-center text-xs sm:text-sm">
            <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 p-2">
              <div className="font-bold text-primary">{providers.length}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Total Providers</div>
            </div>
            <div className="rounded-xl bg-success/5 dark:bg-success/10 border border-success/10 p-2">
              <div className="font-bold text-success">{locations.length}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Locations</div>
            </div>
            <div className="rounded-xl bg-info/5 dark:bg-info/10 border border-info/10 p-2">
              <div className="font-bold text-info">{activeFiltersCount}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">Active</div>
            </div>
          </div>
          {!filtersCollapsed && (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
                  Providers
                </h4>
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
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="provider"
                      checked={selectedProvider === null}
                      onChange={() => setSelectedProvider(null)}
                      className="form-radio text-primary"
                    />
                    <span className="text-gray-700 dark:text-gray-300">All providers</span>
                  </label>
                  {filteredProviders.map((name) => (
                    <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="provider"
                        checked={selectedProvider === name}
                        onChange={() => setSelectedProvider(name)}
                        className="form-radio text-primary"
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">
                  Service Locations
                </h4>
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
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="location"
                      checked={selectedLocation === null}
                      onChange={() => setSelectedLocation(null)}
                      className="form-radio text-primary"
                    />
                    <span className="text-gray-700 dark:text-gray-300">All locations</span>
                  </label>
                  {filteredLocations.map((name) => (
                    <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="location"
                        checked={selectedLocation === name}
                        onChange={() => setSelectedLocation(name)}
                        className="form-radio text-primary"
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProvider(null);
                  setSelectedLocation(null);
                }}
                className="btn btn-outline-primary w-full btn-sm"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      )}
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="flex-shrink-0 self-start p-2 rounded-lg panel hover:bg-white-light dark:hover:bg-[#191e3a] lg:hidden"
          aria-label="Show filters"
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main calendar */}
      <div className="flex-1 min-w-0 rounded-xl sm:rounded-2xl border border-primary/10 dark:border-primary/20 bg-white dark:bg-[#0e1726] p-3 sm:p-4 lg:p-5 shadow-lg">
        <div className="mb-4 sm:mb-5">
          <ul className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm mb-2 flex-wrap">
            <li>
              <a href="/app/appointments" className="text-primary hover:underline">Appointments</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Appointment Calendar</li>
          </ul>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Appointment Calendar</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Monitor provider coverage, visit mix, and location utilization in real time.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 mb-3 sm:mb-4">
          <button
            type="button"
            onClick={onListView}
            className="btn btn-outline-primary rounded-xl border-2 hover:bg-primary/10 font-semibold text-sm w-full sm:w-auto justify-center"
          >
            <FaList className="mr-2" />
            <span className="hidden sm:inline">List View</span>
            <span className="sm:hidden">List</span>
          </button>
          <button type="button" onClick={onAddAppointment} className="btn btn-primary rounded-xl shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 font-semibold text-sm w-full sm:w-auto justify-center">
            <FaPlus className="mr-2" />
            <span className="hidden sm:inline">New Appointment</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">Loading...</div>
        ) : (
          <>
            <div className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Schedule Overview
            </div>
            <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
              Showing times in {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>

            <div className="appointment-calendar-responsive">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                viewDidMount={(view) => setCalendarView(view.view.type as any)}
                datesSet={(arg) => setCurrentDate(arg.start)}
                events={calendarEvents}
                eventClick={handleEventClick}
                dayMaxEvents={VISIBLE_IN_DAY_CELL}
                moreLinkClick={handleMoreLinkClick}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: sidebarCollapsed
                    ? 'dayGridMonth,timeGridWeek,timeGridDay showFilters'
                    : 'dayGridMonth,timeGridWeek,timeGridDay hideFilters',
                }}
                buttonText={{
                  today: 'Today',
                  month: 'Month',
                  week: 'Week',
                  day: 'Day',
                }}
                customButtons={{
                  hideFilters: {
                    text: 'Hide Filters',
                    click: () => setSidebarCollapsed(true),
                  },
                  showFilters: {
                    text: 'Show Filters',
                    click: () => setSidebarCollapsed(false),
                  },
                }}
                height="auto"
                eventContent={(arg) => {
                  const appt = arg.event.extendedProps.appointment as CalendarAppointment;
                  const { start } = parseAppointmentDateTime(appt);
                  const timeStr = format(start, 'h:mm a');
                  return (
                    <div className="fc-event-main-frame cursor-pointer rounded border-l-2 sm:border-l-4 border-primary bg-primary/10 dark:bg-primary/20 p-1 sm:p-1.5 shadow-sm min-h-0 overflow-hidden">
                      <div className="text-[10px] sm:text-xs font-semibold text-primary leading-tight">{timeStr}</div>
                      <div className="text-[10px] sm:text-xs font-semibold text-gray-800 dark:text-white truncate leading-tight">{appt.patientName}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate leading-tight hidden sm:block">{appt.providerName}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate leading-tight hidden sm:block">{appt.visitReasonName}</div>
                    </div>
                  );
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Right sidebar - Summary cards */}
      <div className="flex-shrink-0 w-full lg:w-52 grid grid-cols-2 lg:grid-cols-1 gap-3 lg:space-y-0">
        <div className="rounded-xl sm:rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-3 sm:p-4 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-primary/20 flex items-center justify-center shadow-inner shrink-0">
              <FaCalendar className="text-primary text-base sm:text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide truncate">Today</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.todayCount}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-success/15 bg-gradient-to-br from-success/5 to-success/10 dark:from-success/10 dark:to-success/5 p-3 sm:p-4 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-success/20 flex items-center justify-center shadow-inner shrink-0">
              <FaCalendar className="text-success text-base sm:text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-success uppercase tracking-wide truncate">Next 7 Days</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.next7Count}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-info/15 bg-gradient-to-br from-info/5 to-info/10 dark:from-info/10 dark:to-info/5 p-3 sm:p-4 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-info/20 flex items-center justify-center shadow-inner shrink-0">
              <FaCalendar className="text-info text-base sm:text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-info uppercase tracking-wide truncate">Last 7 Days</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.last7Count}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-warning/15 bg-gradient-to-br from-warning/5 to-warning/10 dark:from-warning/10 dark:to-warning/5 p-3 sm:p-4 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-warning/20 flex items-center justify-center shadow-inner shrink-0">
              <FaUser className="text-warning text-base sm:text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-warning uppercase tracking-wide truncate">Active Providers</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.uniqueProviders}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-danger/15 bg-gradient-to-br from-danger/5 to-danger/10 dark:from-danger/10 dark:to-danger/5 p-3 sm:p-4 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-danger/20 flex items-center justify-center shadow-inner shrink-0">
              <FaMapMarkerAlt className="text-danger text-base sm:text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-danger uppercase tracking-wide truncate">Active Locations</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.uniqueLocations}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Small modal for "+X more" - list of appointments for that day */}
      {moreModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeMoreModal}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1b2e4b] shadow-2xl border border-primary/20 dark:border-primary/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
              <h3 className="font-semibold">{format(moreModalDate, 'MMMM d, yyyy')}</h3>
              <button
                type="button"
                onClick={closeMoreModal}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-3 space-y-2">
              {appointmentsForMoreModal.map((appt) => {
                const { start } = parseAppointmentDateTime(appt);
                const timeStr = format(start, 'h:mm a');
                return (
                  <button
                    key={appt._id}
                    type="button"
                    onClick={() => {
                      setDetailsAppointment(appt);
                      closeMoreModal();
                    }}
                    className="w-full text-left rounded-lg sm:rounded-xl p-2 sm:p-3 bg-gray-50 dark:bg-[#191e3a] hover:bg-primary/10 dark:hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all duration-200"
                  >
                    <div className="text-xs sm:text-sm font-medium text-primary">{timeStr}</div>
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{appt.patientName}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{appt.providerName}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{appt.visitReasonName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {detailsAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailsAppointment(null)}>
          <div className="max-w-md w-full rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-white dark:bg-[#1b2e4b]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Appointment Details</h3>
              <button type="button" className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white" onClick={() => setDetailsAppointment(null)}>
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaUser className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Patient</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{detailsAppointment.patientName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaUser className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Provider</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{detailsAppointment.providerName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaCalendar className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">
                    {format(parseAppointmentDateTime(detailsAppointment).start, 'EEEE, MMMM d, yyyy')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaCalendar className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    {format(parseAppointmentDateTime(detailsAppointment).start, 'h:mm a')} -{' '}
                    {format(parseAppointmentDateTime(detailsAppointment).end, 'h:mm a')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaMapMarkerAlt className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Location</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{detailsAppointment.serviceLocationName}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FaBriefcase className="text-primary text-sm sm:text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Visit Types</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{detailsAppointment.visitReasonName}</div>
                </div>
              </div>
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
    </div>
  );
};

export default AppointmentCalendar;
