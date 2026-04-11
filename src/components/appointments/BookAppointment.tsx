import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { Loader2 } from 'lucide-react';
import { appointmentAPI } from '../../services/api';
import { cn } from '../../lib/utils';

type DropdownOption = {
  id: string;
  label: string;
  raw?: any;
};

type FormState = {
  patientId: string;
  providerId: string;
  visitTypeId: string;
  visitReason: string;
  otherReason: string;
  serviceLocationId: string;
  visitMode: string;
  appointmentDate: string;
  timeSlot: string;
  notes: string;
  patientEmail: string;
  patientPhone: string;
};

const EMPTY_FORM: FormState = {
  patientId: '',
  providerId: '',
  visitTypeId: '',
  visitReason: '',
  otherReason: '',
  serviceLocationId: '',
  visitMode: 'Office Visit',
  appointmentDate: format(new Date(), 'MM/dd/yyyy'),
  timeSlot: '',
  notes: '',
  patientEmail: '',
  patientPhone: '',
};

function toPatientOptions(rows: any[]): DropdownOption[] {
  return rows
    .map((row) => {
      const id = String(row?._id ?? row?.id ?? row?.patientId ?? '').trim();
      const label =
        String(
          row?.fullName ??
            row?.patientName ??
            [row?.firstName, row?.middleName, row?.lastName].filter(Boolean).join(' ')
        ).trim() || '-';
      return { id, label, raw: row };
    })
    .filter((option) => !!option.id);
}

function pickPatientEmail(raw: any): string {
  return String(raw?.emailAddress ?? raw?.email ?? raw?.patientEmail ?? '').trim();
}

function pickPatientPhone(raw: any): string {
  return String(raw?.mobilePhone ?? raw?.homePhone ?? raw?.phone ?? raw?.patientPhone ?? '').trim();
}

function parseSlots(payload: unknown): string[] {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((slot: any) => {
      if (typeof slot === 'string') return slot.trim();
      return String(slot?.startTime ?? slot?.time ?? slot?.slot ?? '').trim();
    })
    .filter(Boolean);
}

export default function BookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId')?.trim() ?? '';
  const patientIdParam = searchParams.get('patientId')?.trim() ?? '';
  const isEditMode = Boolean(appointmentId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [patients, setPatients] = useState<DropdownOption[]>([]);
  const [providers, setProviders] = useState<DropdownOption[]>([]);
  const [visitTypes, setVisitTypes] = useState<DropdownOption[]>([]);
  const [visitReasons, setVisitReasons] = useState<DropdownOption[]>([]);
  const [serviceLocations, setServiceLocations] = useState<DropdownOption[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(today.getFullYear() + 1);
    setMinDate(today);
    setMaxDate(oneYearFromToday);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setApiError('');

      try {
        const [patientRes, userRes, visitTypeRes, dropdownVisitTypeRes, locationRes] = await Promise.all([
          appointmentAPI.getDropdownListData({ listName: 'patient-details', sortBy: 'fullName' }),
          appointmentAPI.getDropdownListData({ listName: 'users', sortBy: 'firstName' }),
          appointmentAPI.getDropdownListData({ listName: 'visit-reason', sortBy: 'visitReasonName' }),
          appointmentAPI.getVisitTypesList(),
          appointmentAPI.getDropdownListData({ listName: 'service-location', sortBy: 'name' }),
        ]);

        const patientOptions = toPatientOptions(Array.isArray(patientRes?.data?.data) ? patientRes.data.data : []);
        setPatients(patientOptions);

        const providerOptions = (Array.isArray(userRes?.data?.data) ? userRes.data.data : [])
          .filter((item: any) => item?.status === true && item?.role?.some((role: string) => role.toLowerCase() === 'provider'))
          .map((item: any) => ({
            id: String(item?._id ?? item?.id ?? ''),
            label: [item?.prefix, item?.firstName, item?.lastName, item?.suffix].filter(Boolean).join(' ').trim(),
            raw: item,
          }))
          .filter((option: DropdownOption) => !!option.id);
        setProviders(providerOptions);

        const visitTypeOptions = (Array.isArray(visitTypeRes?.data?.data) ? visitTypeRes.data.data : [])
          .map((item: any) => ({
            id: String(item?._id ?? item?.id ?? '').trim(),
            label: String(item?.visitReasonName ?? '').trim(),
            raw: item,
          }))
          .filter((option: DropdownOption) => !!option.id && !!option.label);
        setVisitTypes(visitTypeOptions);

        const dedupedReasons: DropdownOption[] = [];
        const seenReasons = new Set<string>();
        const rawReasons = Array.isArray(dropdownVisitTypeRes?.data?.data) ? dropdownVisitTypeRes.data.data : [];
        for (const item of rawReasons) {
          const label = String(item?.VisitTypeName ?? item?.visitTypeName ?? item?.visitReasonName ?? '').trim();
          if (!label) continue;
          const key = label.toLowerCase();
          if (seenReasons.has(key)) continue;
          seenReasons.add(key);
          dedupedReasons.push({
            id: String(item?._id ?? item?.id ?? label),
            label,
            raw: item,
          });
        }
        dedupedReasons.push({ id: 'other', label: 'Other' });
        setVisitReasons(
          dedupedReasons.length > 1
            ? dedupedReasons
            : [
                { id: 'medicare', label: 'MEDICARE Initial Wellness Exam' },
                { id: 'follow-up', label: 'Follow-up' },
                { id: 'consultation', label: 'Consultation' },
                { id: 'check-up', label: 'Check-up' },
                { id: 'other', label: 'Other' },
              ]
        );

        const serviceLocationOptions = (Array.isArray(locationRes?.data?.data) ? locationRes.data.data : [])
          .map((item: any) => ({
            id: String(item?._id ?? item?.id ?? '').trim(),
            label: String(item?.name ?? item?.displayName ?? '').trim(),
            raw: item,
          }))
          .filter((option: DropdownOption) => !!option.id && !!option.label);
        setServiceLocations(serviceLocationOptions);

        if (patientIdParam && patientOptions.some((option) => option.id === patientIdParam)) {
          setForm((prev) => ({ ...prev, patientId: patientIdParam }));
        }

        if (isEditMode) {
          const res = await appointmentAPI.getAppointmentById(appointmentId);
          const row = res?.data?.data ?? res?.data?.result ?? {};
          if (!row || Object.keys(row).length === 0) {
            toast.error('Appointment not found.');
            navigate('/app/appointments', { replace: true });
            return;
          }

          const rawDate = String(row.startDate ?? '').trim();
          const parsedDate =
            /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate) && isValid(parse(rawDate, 'MM/dd/yyyy', new Date()))
              ? rawDate
              : format(new Date(), 'MM/dd/yyyy');
          const visitReasonValue = String(row.visitReasonmsg ?? row.visitReasonName ?? '').trim();
          const matchedReason = dedupedReasons.find((option) => option.label.toLowerCase() === visitReasonValue.toLowerCase());
          const isOtherReason = !!visitReasonValue && !matchedReason;

          setForm({
            patientId: String(row.patientId ?? patientIdParam ?? ''),
            providerId: String(row.providerId ?? ''),
            visitTypeId: String(row.visitReasonId ?? ''),
            visitReason: isOtherReason ? 'Other' : visitReasonValue,
            otherReason: isOtherReason ? visitReasonValue : '',
            serviceLocationId: String(row.serviceLocationId ?? ''),
            visitMode: String(row.visitMode ?? 'Office Visit'),
            appointmentDate: parsedDate,
            timeSlot: String(row.startTime ?? ''),
            notes: String(row.note ?? ''),
            patientEmail: String(row.patientEmail ?? row.emailAddress ?? row.email ?? ''),
            patientPhone: String(row.patientPhone ?? row.mobilePhone ?? row.homePhone ?? ''),
          });

          const calendarDate = parse(parsedDate, 'MM/dd/yyyy', new Date());
          if (isValid(calendarDate)) {
            setCalendarMonth(calendarDate);
          }
        }
      } catch (error) {
        console.error(error);
        setApiError('Failed to load appointment form.');
        toast.error('Failed to load appointment form.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [appointmentId, isEditMode, navigate, patientIdParam]);

  const selectedPatient = useMemo(() => patients.find((option) => option.id === form.patientId), [patients, form.patientId]);
  const selectedProvider = useMemo(() => providers.find((option) => option.id === form.providerId), [providers, form.providerId]);
  const selectedVisitType = useMemo(() => visitTypes.find((option) => option.id === form.visitTypeId), [visitTypes, form.visitTypeId]);
  const selectedLocation = useMemo(() => serviceLocations.find((option) => option.id === form.serviceLocationId), [serviceLocations, form.serviceLocationId]);

  useEffect(() => {
    if (!selectedPatient?.raw) return;
    const email = pickPatientEmail(selectedPatient.raw);
    const phone = pickPatientPhone(selectedPatient.raw);
    setForm((prev) => ({
      ...prev,
      patientEmail: email || prev.patientEmail,
      patientPhone: phone || prev.patientPhone,
    }));
  }, [selectedPatient]);

  const getProviderAvailableSlots = useCallback(async () => {
    if (!form.providerId || !form.appointmentDate || !form.serviceLocationId) {
      setAppointmentSlots([]);
      return;
    }

    const startDate = parse(form.appointmentDate, 'MM/dd/yyyy', new Date());
    if (!isValid(startDate)) {
      setAppointmentSlots([]);
      return;
    }

    setLoadingSlots(true);
    setApiError('');

    try {
      const weekday = format(startDate, 'EEEE').toLowerCase();
      const res = await appointmentAPI.getProviderAvailableSlots({
        userId: form.providerId,
        providerId: form.providerId,
        serviceLocationId: form.serviceLocationId,
        locationId: form.serviceLocationId,
        day: weekday,
        date: form.appointmentDate,
      });

      const slots = parseSlots(res?.data?.data);
      setAppointmentSlots(slots);
      if (form.timeSlot && !slots.includes(form.timeSlot)) {
        setForm((prev) => ({ ...prev, timeSlot: '' }));
      }
    } catch (error) {
      console.error(error);
      setAppointmentSlots([]);
      setApiError('Unable to load available time slots for the selected provider/date/location.');
    } finally {
      setLoadingSlots(false);
    }
  }, [form.appointmentDate, form.providerId, form.serviceLocationId, form.timeSlot]);

  useEffect(() => {
    getProviderAvailableSlots();
  }, [getProviderAvailableSlots]);

  const selectedDate = useMemo(() => {
    const parsed = parse(form.appointmentDate, 'MM/dd/yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  }, [form.appointmentDate]);

  const calendarStart = startOfMonth(calendarMonth);
  const calendarEnd = endOfMonth(calendarMonth);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const startPadding = calendarStart.getDay();
  const prevMonthEnd = endOfMonth(subMonths(calendarMonth, 1));
  const paddingDays = Array.from({ length: startPadding }, (_, index) => addDays(prevMonthEnd, index - startPadding + 1));

  const showOtherReasonInput = form.visitReason === 'Other';
  const visitReasonMessage = showOtherReasonInput ? form.otherReason.trim() : form.visitReason.trim();

  const availableTodayLabel = selectedDate
    ? `Available ${format(selectedDate, 'EEE')}, ${format(selectedDate, 'MMM d')}`
    : 'Select a date';

  const topErrorMessage = useMemo(() => {
    if (apiError) return apiError;

    const orderedFields = [
      'patientId',
      'providerId',
      'visitTypeId',
      'visitReason',
      'otherReason',
      'serviceLocationId',
      'appointmentDate',
      'timeSlot',
    ] as const;

    for (const field of orderedFields) {
      if (errors[field]) return errors[field];
    }

    return '';
  }, [apiError, errors]);

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!form.patientId) next.patientId = 'Patient is required.';
    if (!form.providerId) next.providerId = 'Provider is required.';
    if (!form.visitTypeId) next.visitTypeId = 'Visit type is required.';
    if (!form.visitReason) next.visitReason = 'Visit reason is required.';
    if (form.visitReason === 'Other' && !form.otherReason.trim()) next.otherReason = 'Other reason is required.';
    if (!form.serviceLocationId) next.serviceLocationId = 'Service location is required.';
    if (!form.appointmentDate) next.appointmentDate = 'Appointment date is required.';
    if (!form.timeSlot) next.timeSlot = 'Time slot is required.';
    if (form.timeSlot && appointmentSlots.length > 0 && !appointmentSlots.includes(form.timeSlot)) {
      next.timeSlot = 'Please choose an available time slot.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = format(date, 'MM/dd/yyyy');
    setForm((prev) => ({ ...prev, appointmentDate: formattedDate, timeSlot: '' }));
    setCalendarMonth(date);
    clearError('appointmentDate');
    clearError('timeSlot');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    if (isEditMode && !appointmentId) {
      toast.error('Missing appointment ID.');
      return;
    }

    const duration = Number(selectedVisitType?.raw?.duration ?? selectedVisitType?.raw?.slotDuration ?? 30) || 30;
    const payload = {
      _id: appointmentId || undefined,
      id: appointmentId || undefined,
      appointmentId: appointmentId || undefined,
      patientId: form.patientId,
      patientName: selectedPatient?.label ?? '',
      patientEmail: form.patientEmail || undefined,
      patientPhone: form.patientPhone || undefined,
      emailAddress: form.patientEmail || undefined,
      mobilePhone: form.patientPhone || undefined,
      providerId: form.providerId,
      providerName: selectedProvider?.label ?? '',
      visitReasonId: form.visitTypeId,
      visitReasonName: selectedVisitType?.label ?? '',
      visitReasonmsg: visitReasonMessage,
      serviceLocationId: form.serviceLocationId,
      serviceLocationName: selectedLocation?.label ?? '',
      startDate: form.appointmentDate,
      startTime: form.timeSlot,
      duration,
      visitMode: form.visitMode,
      note: form.notes.trim(),
    };

    try {
      setSubmitting(true);
      setApiError('');
      const res = isEditMode
        ? await appointmentAPI.updateAppointment(payload)
        : await appointmentAPI.createAppointment(payload);

      if (res?.data?.status !== 'success') {
        const message = res?.data?.message || 'Failed to save appointment.';
        setApiError(message);
        toast.error(message);
        return;
      }

      await appointmentAPI.getAppointmentListPaginated({ page: 1, limit: 10 });
      toast.success(isEditMode ? 'Appointment updated.' : 'Appointment created.');
      navigate('/app/appointments', { replace: true, state: { refreshAppointments: true } });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to save appointment.';
      setApiError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading appointment form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      {topErrorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {topErrorMessage}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 animate-in slide-in-from-right-4 duration-300 fade-in">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 border-b border-gray-200 pb-3 text-lg font-semibold text-gray-800">
            {isEditMode ? 'Edit Appointment' : 'Book Your Appointment'}
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            Select your patient, provider, visit type, date and time for the appointment.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Patient <span className="text-primary-600">*</span>
              </label>
              <select
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5 transition-colors',
                  errors.patientId ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.patientId}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    patientId: event.target.value,
                    patientEmail: '',
                    patientPhone: '',
                  }));
                  clearError('patientId');
                }}
              >
                <option value="">Select Patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.label}
                  </option>
                ))}
              </select>
              {errors.patientId && <p className="mt-1 text-xs text-primary-600">{errors.patientId}</p>}
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2.5 focus:border-primary"
                value={form.patientEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, patientEmail: event.target.value }))}
                placeholder={selectedPatient ? 'Auto-filled if available, or type email' : 'Select patient first'}
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2.5 focus:border-primary"
                value={form.patientPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, patientPhone: event.target.value }))}
                placeholder={selectedPatient ? 'Auto-filled if available, or type phone' : 'Select patient first'}
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Provider <span className="text-primary-600">*</span>
              </label>
              <select
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5 transition-colors',
                  errors.providerId ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.providerId}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    providerId: event.target.value,
                    serviceLocationId: '',
                    timeSlot: '',
                  }));
                  clearError('providerId');
                  clearError('serviceLocationId');
                  clearError('timeSlot');
                }}
              >
                <option value="">Select Provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
              {errors.providerId && <p className="mt-1 text-xs text-primary-600">{errors.providerId}</p>}
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Visit Type <span className="text-primary-600">*</span>
              </label>
              <select
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5 transition-colors',
                  errors.visitTypeId ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.visitTypeId}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, visitTypeId: event.target.value }));
                  clearError('visitTypeId');
                }}
              >
                <option value="">Select Visit Type</option>
                {visitTypes.map((visitType) => (
                  <option key={visitType.id} value={visitType.id}>
                    {visitType.label}
                  </option>
                ))}
              </select>
              {errors.visitTypeId && <p className="mt-1 text-xs text-primary-600">{errors.visitTypeId}</p>}
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Visit Reason <span className="text-primary-600">*</span>
              </label>
              <select
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5 transition-colors',
                  errors.visitReason ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.visitReason}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    visitReason: value,
                    otherReason: value === 'Other' ? prev.otherReason : '',
                  }));
                  clearError('visitReason');
                  clearError('otherReason');
                }}
              >
                <option value="">Select Visit Reason</option>
                {visitReasons.map((reason) => (
                  <option key={reason.id} value={reason.label}>
                    {reason.label}
                  </option>
                ))}
              </select>
              {errors.visitReason && <p className="mt-1 text-xs text-primary-600">{errors.visitReason}</p>}
            </div>

            <div className="flex flex-col space-y-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Service Location <span className="text-primary-600">*</span>
              </label>
              <select
                disabled={!form.providerId}
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5 transition-colors disabled:opacity-60',
                  errors.serviceLocationId ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.serviceLocationId}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    serviceLocationId: event.target.value,
                    timeSlot: '',
                  }));
                  clearError('serviceLocationId');
                  clearError('timeSlot');
                }}
              >
                <option value="">{form.providerId ? 'Select Location' : 'Select Provider first'}</option>
                {serviceLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
              {errors.serviceLocationId && <p className="mt-1 text-xs text-primary-600">{errors.serviceLocationId}</p>}
            </div>
          </div>

          {showOtherReasonInput && (
            <div className="mt-5 max-w-md">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Other Reason <span className="text-primary-600">*</span>
              </label>
              <input
                type="text"
                className={cn(
                  'w-full rounded-lg border-2 bg-gray-50 px-4 py-2.5',
                  errors.otherReason ? 'border-primary-600' : 'border-gray-200 focus:border-primary'
                )}
                value={form.otherReason}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, otherReason: event.target.value }));
                  clearError('otherReason');
                }}
                placeholder="Specify reason"
                maxLength={100}
              />
              {errors.otherReason && <p className="mt-1 text-xs text-primary-600">{errors.otherReason}</p>}
            </div>
          )}

          <div className="mt-6">
            <label className="mb-3 block text-sm font-medium text-gray-700">Visit Mode</label>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name="visitMode"
                  checked={form.visitMode === 'Office Visit'}
                  onChange={() => setForm((prev) => ({ ...prev, visitMode: 'Office Visit' }))}
                  className="h-4 w-4 rounded-full border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">Office Visit</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name="visitMode"
                  checked={form.visitMode === 'Telehealth'}
                  onChange={() => setForm((prev) => ({ ...prev, visitMode: 'Telehealth' }))}
                  className="h-4 w-4 rounded-full border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">Telehealth</span>
              </label>
            </div>
          </div>

          {form.providerId && form.serviceLocationId && (
            <>
              <hr className="my-6 border-gray-200" />
              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                <div className="flex min-h-0 flex-col">
                  <h4 className="mb-2 text-base font-semibold text-gray-800">Appointment Date</h4>
                  <div className="h-[220px] rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((month) => subMonths(month, 1))}
                        className="rounded-lg p-1 hover:bg-gray-200"
                        aria-label="Previous month"
                      >
                        ←
                      </button>
                      <span className="font-semibold text-gray-800">{format(calendarMonth, 'MMMM yyyy')}</span>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
                        className="rounded-lg p-1 hover:bg-gray-200"
                        aria-label="Next month"
                      >
                        →
                      </button>
                    </div>

                    <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-500">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day}>{day}</div>
                      ))}
                    </div>

                    <div className="grid flex-1 grid-cols-7 gap-0.5">
                      {paddingDays.map((_, index) => (
                        <div key={`pad-${index}`} className="min-h-0 rounded-md text-xs text-gray-400" />
                      ))}
                      {days.map((day) => {
                        const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, calendarMonth);
                        const isDisabled = !!((minDate && day < minDate) || (maxDate && day > maxDate));

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => !isDisabled && handleDateSelect(day)}
                            disabled={isDisabled}
                            className={cn(
                              'min-h-0 rounded-lg text-xs font-medium',
                              isDisabled && 'cursor-not-allowed text-gray-300',
                              !isDisabled && isSelected && 'bg-primary text-white',
                              !isDisabled && !isSelected && isCurrentMonth && 'text-gray-700 hover:bg-primary/10',
                              !isDisabled && !isSelected && !isCurrentMonth && 'text-gray-400'
                            )}
                          >
                            {format(day, 'd')}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-1.5 text-xs text-gray-500">{availableTodayLabel}</p>
                    {errors.appointmentDate && <p className="mt-1 text-xs text-primary-600">{errors.appointmentDate}</p>}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <h4 className="mb-2 text-base font-semibold text-gray-800">
                    Available Time Slots
                    {selectedDate && (
                      <span className="mt-0.5 block text-xs font-normal text-gray-500">
                        {format(selectedDate, 'EEEE, MMM d, yyyy')}
                      </span>
                    )}
                  </h4>
                  <div className="h-[220px] overflow-y-auto rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                    {loadingSlots ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-gray-500">Loading available times...</p>
                      </div>
                    ) : appointmentSlots.length === 0 ? (
                      selectedDate ? (
                        <p className="flex h-full items-center text-sm text-gray-500">No available times for this date</p>
                      ) : (
                        <p className="flex h-full items-center text-sm text-gray-500">Select a date to see available times</p>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {appointmentSlots.map((slot) => {
                          const isSelected = form.timeSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, timeSlot: slot }));
                                clearError('timeSlot');
                              }}
                              className={cn(
                                'rounded-lg px-2 py-1.5 text-sm font-medium',
                                isSelected
                                  ? 'bg-primary text-white'
                                  : 'border border-gray-200 bg-white hover:border-primary hover:bg-primary/5'
                              )}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {errors.timeSlot && <p className="mt-1 text-xs text-primary-600">{errors.timeSlot}</p>}
                </div>
              </div>
            </>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">Notes (Optional)</label>
            <textarea
              className="min-h-0 w-full resize-y rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2 focus:border-primary"
              placeholder="Add any notes for the doctor (optional)"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              maxLength={500}
              rows={2}
            />
            <p className="mt-1 text-xs text-gray-500">{500 - (form.notes?.length || 0)} characters remaining</p>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-gray-700 transition hover:bg-gray-50"
              onClick={() => navigate('/app/appointments')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : isEditMode ? 'Update Appointment' : 'Create Appointment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
