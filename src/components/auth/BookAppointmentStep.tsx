import React, { useState, useEffect, useCallback } from 'react';
import { appointmentAPI } from '@/services/api';
import { format, parse, isValid, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppointmentProvider {
  _id: string;
  name: string;
}

export interface AppointmentVisitType {
  _id: string;
  visitReasonName: string;
}

export interface AppointmentServiceLocation {
  _id: string;
  name: string;
  displayName?: string;
}

export interface AppointmentData {
  provider: AppointmentProvider | null;
  providerId: string;
  visitType: AppointmentVisitType | null;
  visitTypeId: string;
  visitReason: string;
  otherReason: string;
  serviceLocation: AppointmentServiceLocation | null;
  serviceLocationId: string;
  visitMode: string;
  appointmentDate: string;
  timeSlot: string;
  notes: string;
}

const DEFAULT_APPOINTMENT: AppointmentData = {
  provider: null,
  providerId: '',
  visitType: null,
  visitTypeId: '',
  visitReason: '',
  otherReason: '',
  serviceLocation: null,
  serviceLocationId: '',
  visitMode: 'Office Visit',
  appointmentDate: format(new Date(), 'MM/dd/yyyy'),
  timeSlot: '',
  notes: '',
};

interface VisitReasonDropdown {
  id: string | number;
  reason: string;
}

interface BookAppointmentStepProps {
  value: AppointmentData;
  onChange: (value: AppointmentData) => void;
  errors?: Record<string, string>;
}

export function BookAppointmentStep({ value, onChange, errors = {} }: BookAppointmentStepProps) {
  const [providerList, setProviderList] = useState<AppointmentProvider[]>([]);
  const [visitReasonList, setVisitReasonList] = useState<AppointmentVisitType[]>([]);
  const [visitReasonsDropdown, setVisitReasonsDropdown] = useState<VisitReasonDropdown[]>([]);
  const [serviceLocationOptions, setServiceLocationOptions] = useState<AppointmentServiceLocation[]>([]);
  const [allServiceLocations, setAllServiceLocations] = useState<AppointmentServiceLocation[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);

  const data = { ...DEFAULT_APPOINTMENT, ...value };

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(today.getFullYear() + 1);
    setMinDate(today);
    setMaxDate(oneYearFromToday);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, visitTypesRes, dropdownRes] = await Promise.all([
          appointmentAPI.getGeneralCalendarSetting(),
          appointmentAPI.getVisitTypesList(),
          appointmentAPI.getDropdownListData({ listName: 'users', sortBy: 'firstName' }),
        ]);

        if (dropdownRes.data?.status === 'success') {
          const providers = (dropdownRes.data.data || [])
            .filter((item: any) => item.status === true && item.role?.some((r: string) => r.toLowerCase() === 'provider'))
            .map((item: any) => ({
              _id: item._id,
              name: (item?.prefix ? item.prefix + ' ' : '') + item.firstName + ' ' + item.lastName + (item?.suffix ? ' ' + item.suffix : ''),
            }));
          setProviderList(providers);

          const vrPayload = { listName: 'visit-reason', sortBy: 'visitReasonName' };
          const vrRes = await appointmentAPI.getDropdownListData(vrPayload);
          if (vrRes.data?.status === 'success') {
            setVisitReasonList(vrRes.data.data || []);
          }

          const slPayload = { listName: 'service-location', sortBy: 'name' };
          const slRes = await appointmentAPI.getDropdownListData(slPayload);
          if (slRes.data?.status === 'success') {
            const locs = (slRes.data.data || []).map((loc: any) => ({
              _id: loc._id,
              name: loc.name,
              displayName: loc.name || loc.displayName || '',
            }));
            setAllServiceLocations(locs);
            setServiceLocationOptions(locs);
          }
        }

        const rawVisitTypes = Array.isArray(visitTypesRes.data?.data) ? visitTypesRes.data.data : [];
        if (visitTypesRes.data?.status === 'success' && rawVisitTypes.length > 0) {
          const seen = new Set<string>();
          const reasons: VisitReasonDropdown[] = rawVisitTypes
            .map((vt: any) => ({
              id: vt?._id ?? vt?.id ?? String(Math.random()),
              reason: (vt?.VisitTypeName ?? vt?.visitTypeName ?? vt?.visitReasonName ?? '').toString().trim(),
            }))
            .filter((x: VisitReasonDropdown) => {
              if (!x.reason) return false;
              const key = x.reason.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          reasons.push({ id: 'other', reason: 'Other' });
          setVisitReasonsDropdown(reasons);
        } else {
          setVisitReasonsDropdown([
            { id: 'medicare', reason: 'MEDICARE Initial Wellness Exam' },
            { id: 'follow-up', reason: 'Follow-up' },
            { id: 'consultation', reason: 'Consultation' },
            { id: 'check-up', reason: 'Check-up' },
            { id: 'other', reason: 'Other' },
          ]);
        }
      } catch (err) {
        console.error('Error initializing BookAppointmentStep:', err);
      }
    })();
  }, []);

  const getProviderAvailableSlots = useCallback(async () => {
    const provider = data.provider;
    const appointmentDate = data.appointmentDate;
    if (!provider || !appointmentDate) return;

    const startDate = parse(appointmentDate, 'MM/dd/yyyy', new Date());
    if (!isValid(startDate)) return;

    const weekday = format(startDate, 'EEEE').toLowerCase();
    try {
      const res = await appointmentAPI.getProviderAvailableSlots({
        userId: provider._id,
        day: weekday,
        date: appointmentDate,
      });

      if (res.data?.data && Array.isArray(res.data.data)) {
        setAppointmentSlots(res.data.data);
      } else {
        setAppointmentSlots([]);
      }
    } catch (_) {
      setAppointmentSlots([]);
    }
  }, [data.provider, data.appointmentDate]);

  useEffect(() => {
    if (data.provider && data.appointmentDate) {
      getProviderAvailableSlots();
    } else {
      setAppointmentSlots([]);
    }
  }, [data.provider, data.appointmentDate, getProviderAvailableSlots]);

  const handleProviderChange = (provider: AppointmentProvider | null) => {
    onChange({
      ...data,
      provider,
      providerId: provider?._id || '',
      serviceLocation: null,
      serviceLocationId: '',
      timeSlot: '',
    });
  };

  const handleVisitTypeChange = (vt: AppointmentVisitType | null) => {
    onChange({
      ...data,
      visitType: vt,
      visitTypeId: vt?._id || '',
    });
  };

  const handleVisitReasonChange = (reason: string) => {
    setShowOtherReasonInput(reason === 'Other');
    onChange({
      ...data,
      visitReason: reason,
      otherReason: reason === 'Other' ? data.otherReason : '',
    });
  };

  const handleServiceLocationChange = (loc: AppointmentServiceLocation | null) => {
    onChange({
      ...data,
      serviceLocation: loc,
      serviceLocationId: loc?._id || '',
    });
  };

  const handleDateSelect = (d: Date) => {
    const formatted = format(d, 'MM/dd/yyyy');
    onChange({
      ...data,
      appointmentDate: formatted,
      timeSlot: '',
    });
    setCalendarMonth(d);
  };

  const handleTimeSelect = (time: string) => {
    onChange({ ...data, timeSlot: time });
  };

  const selectedDate = (() => {
    try {
      const d = parse(data.appointmentDate, 'MM/dd/yyyy', new Date());
      return isValid(d) ? d : null;
    } catch {
      return null;
    }
  })();

  const calendarStart = startOfMonth(calendarMonth);
  const calendarEnd = endOfMonth(calendarMonth);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const startPadding = calendarStart.getDay();
  const prevMonthEnd = endOfMonth(subMonths(calendarMonth, 1));
  const paddingDays = Array.from({ length: startPadding }, (_, i) => addDays(prevMonthEnd, i - startPadding + 1));

  const availableTodayLabel = selectedDate
    ? `Available ${format(selectedDate, 'EEE')}, ${format(selectedDate, 'MMM d')}`
    : 'Select a date';

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">
          Book Your Appointment
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Select your provider, visit type, date and time for your first appointment.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Provider */}
          <div className="flex flex-col space-y-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider <span className="text-primary-600">*</span>
            </label>
            <select
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 bg-gray-50 transition-colors',
                errors.provider ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
              )}
              value={data.providerId}
              onChange={(e) => {
                const p = providerList.find((x) => x._id === e.target.value);
                handleProviderChange(p || null);
              }}
            >
              <option value="">Select Provider</option>
              {providerList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.provider && <p className="text-xs text-primary-600 mt-1">{errors.provider}</p>}
          </div>

          {/* Visit Type */}
          <div className="flex flex-col space-y-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visit Type <span className="text-primary-600">*</span>
            </label>
            <select
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 bg-gray-50 transition-colors',
                errors.visitType ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
              )}
              value={data.visitTypeId}
              onChange={(e) => {
                const vt = visitReasonList.find((x) => x._id === e.target.value);
                handleVisitTypeChange(vt || null);
              }}
            >
              <option value="">Select Visit Type</option>
              {visitReasonList.map((vr) => (
                <option key={vr._id} value={vr._id}>
                  {vr.visitReasonName}
                </option>
              ))}
            </select>
            {errors.visitType && <p className="text-xs text-primary-600 mt-1">{errors.visitType}</p>}
          </div>

          {/* Visit Reason */}
          <div className="flex flex-col space-y-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visit Reason <span className="text-primary-600">*</span>
            </label>
            <select
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 bg-gray-50 transition-colors',
                errors.visitReason ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
              )}
              value={data.visitReason}
              onChange={(e) => handleVisitReasonChange(e.target.value)}
            >
              <option value="">Select Visit Reason</option>
              {visitReasonsDropdown.map((vr) => (
                <option key={String(vr.id)} value={vr.reason}>
                  {vr.reason}
                </option>
              ))}
            </select>
            {errors.visitReason && <p className="text-xs text-primary-600 mt-1">{errors.visitReason}</p>}
          </div>

          {/* Service Location */}
          <div className="flex flex-col space-y-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Location
            </label>
            <select
              disabled={!data.provider}
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 bg-gray-50 transition-colors disabled:opacity-60',
                errors.serviceLocation ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
              )}
              value={data.serviceLocationId}
              onChange={(e) => {
                const loc = serviceLocationOptions.find((l) => l._id === e.target.value);
                handleServiceLocationChange(loc || null);
              }}
            >
              <option value="">{data.provider ? 'Select Location' : 'Select Provider first'}</option>
              {serviceLocationOptions.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.displayName || loc.name}
                </option>
              ))}
            </select>
            {errors.serviceLocation && <p className="text-xs text-primary-600 mt-1">{errors.serviceLocation}</p>}
          </div>
        </div>

        {showOtherReasonInput && (
          <div className="mt-5 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Reason <span className="text-primary-600">*</span>
            </label>
            <input
              type="text"
              className={cn(
                'w-full rounded-lg border-2 px-4 py-2.5 bg-gray-50',
                errors.otherReason ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
              )}
              value={data.otherReason}
              onChange={(e) => onChange({ ...data, otherReason: e.target.value })}
              placeholder="Specify reason"
              maxLength={100}
            />
            {errors.otherReason && <p className="text-xs text-primary-600 mt-1">{errors.otherReason}</p>}
          </div>
        )}

        {/* Visit Mode */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Visit Mode</label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="visitMode"
                checked={data.visitMode === 'Office Visit'}
                onChange={() => onChange({ ...data, visitMode: 'Office Visit' })}
                className="rounded-full w-4 h-4 border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Office Visit</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="visitMode"
                checked={data.visitMode === 'Telehealth'}
                onChange={() => onChange({ ...data, visitMode: 'Telehealth' })}
                className="rounded-full w-4 h-4 border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Telehealth</span>
            </label>
          </div>
        </div>

        {/* Calendar + Time Slots */}
        {data.provider && data.serviceLocation && (
          <>
            <hr className="my-6 border-gray-200" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <div className="flex flex-col min-h-0">
                <h4 className="text-base font-semibold text-gray-800 mb-2">Appointment Date</h4>
                <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4 h-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                      className="p-1 rounded-lg hover:bg-gray-200"
                      aria-label="Previous month"
                    >
                      ←
                    </button>
                    <span className="font-semibold text-gray-800">{format(calendarMonth, 'MMMM yyyy')}</span>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                      className="p-1 rounded-lg hover:bg-gray-200"
                      aria-label="Next month"
                    >
                      →
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-500 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 flex-1">
                    {paddingDays.map((d, i) => (
                      <div key={`pad-${i}`} className="min-h-0 rounded-md text-gray-400 text-xs" />
                    ))}
                    {days.map((d) => {
                      const isSelected = selectedDate && isSameDay(d, selectedDate);
                      const isCurrentMonth = isSameMonth(d, calendarMonth);
                      const isDisabled = (minDate && d < minDate) || (maxDate && d > maxDate);
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => !isDisabled && handleDateSelect(d)}
                          disabled={!!isDisabled}
                          className={cn(
                            'min-h-0 rounded-lg text-xs font-medium',
                            isDisabled && 'text-gray-300 cursor-not-allowed',
                            !isDisabled && isSelected && 'bg-primary text-white',
                            !isDisabled && !isSelected && isCurrentMonth && 'text-gray-700 hover:bg-primary/10',
                            !isDisabled && !isSelected && !isCurrentMonth && 'text-gray-400'
                          )}
                        >
                          {format(d, 'd')}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">{availableTodayLabel}</p>
                  {errors.appointmentDate && <p className="text-xs text-primary-600 mt-1">{errors.appointmentDate}</p>}
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                <h4 className="text-base font-semibold text-gray-800 mb-2">
                  Available Time Slots
                  {selectedDate && (
                    <span className="block text-xs font-normal text-gray-500 mt-0.5">
                      {format(selectedDate, 'EEEE, MMM d, yyyy')}
                    </span>
                  )}
                </h4>
                <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4 h-[220px] overflow-y-auto">
                  {appointmentSlots.length === 0 ? (
                    selectedDate ? (
                      <div className="flex flex-col items-center justify-center gap-2 h-full">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-gray-500">Loading available times...</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 flex items-center h-full">Select a date to see available times</p>
                    )
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {appointmentSlots.map((slot) => {
                        const isSelected = data.timeSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => handleTimeSelect(slot)}
                            className={cn(
                              'px-2 py-1.5 rounded-lg text-sm font-medium',
                              isSelected ? 'bg-primary text-white' : 'bg-white border border-gray-200 hover:border-primary hover:bg-primary/5'
                            )}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {errors.timeSlot && <p className="text-xs text-primary-600 mt-1">{errors.timeSlot}</p>}
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea
            className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2 resize-y focus:border-primary min-h-0"
            placeholder="Add any notes for the doctor (optional)"
            value={data.notes}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
            maxLength={500}
            rows={2}
          />
          <p className="text-xs text-gray-500 mt-1">{500 - (data.notes?.length || 0)} characters remaining</p>
        </div>
      </div>
    </div>
  );
}
