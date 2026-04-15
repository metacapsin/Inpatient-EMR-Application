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
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { appointmentAPI } from '../../services/api';
import { cn } from '../../lib/utils';
import NewDropdown from '../ui/NewDropdown';
import SearchableSelect from '../ui/SearchableSelect';

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

const FORM_FLOAT_LABEL =
  'pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-white px-1 text-[12px] font-medium text-gray-500 dark:bg-[#141210] dark:text-gray-400';

const FORM_FIELD_FRAME =
  'relative rounded-lg border border-gray-200/70 bg-white shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 dark:border-gray-600 dark:bg-[#141210]';

const FORM_FIELD_INPUT =
  'h-10 w-full border-0 bg-transparent px-3 pb-2 pt-[1.125rem] text-[14px] font-medium text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100';

const FORM_TEXTAREA =
  'min-h-[120px] w-full resize-y border-0 bg-transparent px-3 pb-3 pt-7 text-[14px] font-medium text-gray-900 outline-none ring-0 placeholder:text-gray-400 dark:text-gray-100';

function pickAppointmentIdFromSaveResponse(res: any, fallback: string): string {
  const root = res?.data;
  const inner = root?.data ?? root?.result ?? root;
  const fromInner =
    (typeof inner?._id === 'string' && inner._id.trim()) ||
    (typeof inner?.id === 'string' && inner.id.trim()) ||
    (typeof inner?.appointmentId === 'string' && inner.appointmentId.trim()) ||
    '';
  if (fromInner) return fromInner;
  const fromRoot =
    (typeof root?._id === 'string' && root._id.trim()) ||
    (typeof root?.id === 'string' && root.id.trim()) ||
    '';
  return fromRoot || String(fallback ?? '').trim();
}

/** Matched schedule panels: calendar + time slots (fixed height, equal width via grid). */
const SCHEDULE_PANEL =
  'h-[256px] w-full min-h-0 shrink-0 rounded-lg border border-gray-200/70 bg-white dark:border-gray-600 dark:bg-[#141210]';

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
      const focusAppointmentId = pickAppointmentIdFromSaveResponse(res, isEditMode ? appointmentId : '');
      navigate('/app/appointments', {
        replace: true,
        state: { refreshAppointments: true, ...(focusAppointmentId ? { focusAppointmentId } : {}) },
      });
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
        <div className="flex items-center justify-center gap-3 py-10 text-[14px] font-medium text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Loading appointment form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      {topErrorMessage && (
        <div className="mb-6 rounded-lg border border-red-200/80 bg-red-50/90 px-4 py-3 text-[14px] font-medium text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {topErrorMessage}
        </div>
      )}

      <form onSubmit={submit} className="pb-2">
        <div className="mb-8">
          <h1 className="text-[20px] font-semibold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Appointment' : 'Create Appointment'}
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] text-gray-400 dark:text-gray-500">
            Select your patient, provider, visit type, date and time for the appointment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          <div className="min-w-0">
            <SearchableSelect
              fieldSize="md"
              hasError={!!errors.patientId}
              label="Patient *"
              options={[
                { value: '', label: 'Select Patient' },
                ...patients.map((p) => ({
                  value: p.id,
                  label: p.label,
                })),
              ]}
              value={form.patientId}
              placeholder="Select Patient"
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  patientId: String(value),
                  patientEmail: '',
                  patientPhone: '',
                }));
                clearError('patientId');
              }}
            />
            {errors.patientId ? <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.patientId}</p> : null}
          </div>

          <div className="min-w-0">
            <div className={FORM_FIELD_FRAME}>
              <span className={FORM_FLOAT_LABEL}>Phone</span>
              <input
                type="tel"
                className={FORM_FIELD_INPUT}
                value={form.patientPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, patientPhone: event.target.value }))}
                placeholder={selectedPatient ? 'Auto-filled if available, or type phone' : 'Select Phone'}
              />
            </div>
          </div>

          <div className="min-w-0">
            <NewDropdown
              fieldSize="md"
              hasError={!!errors.providerId}
              label="Provider *"
              options={providers.map((provider) => ({
                value: provider.id,
                label: provider.label,
              }))}
              value={form.providerId}
              placeholder="Select Provider"
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  providerId: String(value),
                  serviceLocationId: '',
                  timeSlot: '',
                }));
                clearError('providerId');
                clearError('serviceLocationId');
                clearError('timeSlot');
              }}
            />
            {errors.providerId ? <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.providerId}</p> : null}
          </div>

          <div className="min-w-0">
            <NewDropdown
              fieldSize="md"
              hasError={!!errors.visitTypeId}
              label="Visit Type *"
              options={visitTypes.map((visitType) => ({
                value: visitType.id,
                label: visitType.label,
              }))}
              value={form.visitTypeId}
              placeholder="Select Visit Type"
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  visitTypeId: String(value),
                }));
                clearError('visitTypeId');
              }}
            />
            {errors.visitTypeId ? <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.visitTypeId}</p> : null}
          </div>

          <div className="min-w-0">
            <NewDropdown
              fieldSize="md"
              hasError={!!errors.visitReason}
              label="Visit Reason *"
              options={visitReasons.map((reason) => ({
                value: reason.label,
                label: reason.label,
              }))}
              value={form.visitReason}
              placeholder="Select Visit Reason"
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  visitReason: String(value),
                  otherReason: value === 'Other' ? prev.otherReason : '',
                }));
                clearError('visitReason');
                clearError('otherReason');
              }}
            />
            {errors.visitReason ? <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.visitReason}</p> : null}
          </div>

          <div className="min-w-0">
            <NewDropdown
              fieldSize="md"
              hasError={!!errors.serviceLocationId}
              label="Service Location *"
              disabled={!form.providerId}
              options={serviceLocations.map((loc) => ({
                value: loc.id,
                label: loc.label,
              }))}
              value={form.serviceLocationId}
              placeholder={form.providerId ? 'Select Location' : 'Select Provider first'}
              onChange={(value) => {
                setForm((prev) => ({
                  ...prev,
                  serviceLocationId: String(value),
                  timeSlot: '',
                }));
                clearError('serviceLocationId');
                clearError('timeSlot');
              }}
            />
            {errors.serviceLocationId ? (
              <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.serviceLocationId}</p>
            ) : null}
          </div>
        </div>

        {showOtherReasonInput ? (
          <div className="mt-8 max-w-full md:max-w-xl">
            <div
              className={cn(
                FORM_FIELD_FRAME,
                errors.otherReason && 'border-primary-600 focus-within:border-primary-600 focus-within:ring-primary/20'
              )}
            >
              <span className={FORM_FLOAT_LABEL}>
                Other Reason <span className="text-primary-600">*</span>
              </span>
              <input
                type="text"
                className={FORM_FIELD_INPUT}
                value={form.otherReason}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, otherReason: event.target.value }));
                  clearError('otherReason');
                }}
                placeholder="Specify reason"
                maxLength={100}
              />
            </div>
            {errors.otherReason ? (
              <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.otherReason}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10">
          <div className="mb-3 text-[16px] font-semibold text-gray-900 dark:text-gray-100">Visit Mode</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={form.visitMode === 'Office Visit'}
              onClick={() => setForm((prev) => ({ ...prev, visitMode: 'Office Visit' }))}
              className={cn(
                'h-10 min-w-[9.5rem] rounded-full border px-5 text-[14px] font-medium transition-colors',
                form.visitMode === 'Office Visit'
                  ? 'border-primary/35 bg-primary/15 text-gray-900 shadow-sm dark:text-gray-100'
                  : 'border-gray-200/70 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-[#141210] dark:text-gray-300 dark:hover:border-gray-500'
              )}
            >
              Office Visit
            </button>
            <button
              type="button"
              aria-pressed={form.visitMode === 'Telehealth'}
              onClick={() => setForm((prev) => ({ ...prev, visitMode: 'Telehealth' }))}
              className={cn(
                'h-10 min-w-[9.5rem] rounded-full border px-5 text-[14px] font-medium transition-colors',
                form.visitMode === 'Telehealth'
                  ? 'border-primary/35 bg-primary/15 text-gray-900 shadow-sm dark:text-gray-100'
                  : 'border-gray-200/70 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-[#141210] dark:text-gray-300 dark:hover:border-gray-500'
              )}
            >
              Telehealth
            </button>
          </div>
        </div>

        {form.providerId && form.serviceLocationId ? (
          <div className="mt-10 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-3 shrink-0 text-[16px] font-semibold text-gray-900 dark:text-gray-100">Appointment Date</div>
              <div className={cn(SCHEDULE_PANEL, 'flex flex-col overflow-hidden p-2.5')}>
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((month) => subMonths(month, 1))}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-0 truncate text-center text-[12px] font-semibold text-gray-900 dark:text-gray-100">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mb-1.5 grid shrink-0 grid-cols-7 gap-0.5 text-center text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-0.5">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-0.5">
                  {paddingDays.map((_, index) => (
                    <div key={`pad-${index}`} className="flex items-center justify-center rounded-md text-[12px] text-gray-300" />
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
                          'flex h-full min-h-0 w-full items-center justify-center rounded-md text-[12px] font-medium transition-colors',
                          isDisabled && 'cursor-not-allowed text-gray-300',
                          !isDisabled &&
                            isSelected &&
                            'bg-primary/15 text-gray-900 ring-1 ring-inset ring-primary/25 dark:text-gray-100',
                          !isDisabled &&
                            !isSelected &&
                            isCurrentMonth &&
                            'text-gray-700 hover:bg-primary/10 dark:text-gray-200 dark:hover:bg-primary/20',
                          !isDisabled && !isSelected && !isCurrentMonth && 'text-gray-400 dark:text-gray-500'
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-1.5 shrink-0 truncate text-[12px] text-gray-400 dark:text-gray-500">{availableTodayLabel}</p>
              </div>
              {errors.appointmentDate ? (
                <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.appointmentDate}</p>
              ) : null}
            </div>

            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-3 shrink-0">
                <div className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">Available Time Slots</div>
                {selectedDate ? (
                  <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                    {format(selectedDate, 'EEEE, MMM d, yyyy')}
                  </p>
                ) : null}
              </div>
              <div className={cn(SCHEDULE_PANEL, 'overflow-y-auto overscroll-contain p-3')}>
                {loadingSlots ? (
                  <div className="flex min-h-full flex-col items-center justify-center gap-2 px-2 py-4">
                    <Loader2 className="h-7 w-7 shrink-0 animate-spin text-primary" />
                    <p className="text-[14px] font-medium text-gray-500">Loading available times...</p>
                  </div>
                ) : appointmentSlots.length === 0 ? (
                  <div className="flex min-h-full items-center justify-center px-2 py-4">
                    <p className="text-center text-[14px] font-medium text-gray-500 dark:text-gray-400">
                      {selectedDate ? 'No available times for this date' : 'Select a date to see available times'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                            'inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg border text-[14px] font-medium transition-colors',
                            isSelected
                              ? 'border-primary/30 bg-primary/15 text-gray-900 ring-1 ring-inset ring-primary/20 dark:text-gray-100'
                              : 'border-gray-200/70 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/5 dark:border-gray-600 dark:bg-[#141210] dark:text-gray-200 dark:hover:bg-primary/15'
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.timeSlot ? <p className="mt-1.5 text-[12px] font-medium text-primary-600">{errors.timeSlot}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <div className={FORM_FIELD_FRAME}>
            <span className={FORM_FLOAT_LABEL}>Notes (Optional)</span>
            <textarea
              className={FORM_TEXTAREA}
              placeholder="Add any notes for the doctor (optional)"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              maxLength={500}
              rows={4}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-gray-400 dark:text-gray-500">
            {500 - (form.notes?.length || 0)} characters remaining
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/90 dark:text-gray-200 dark:hover:bg-gray-800/80"
            onClick={() => navigate('/app/appointments')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-50 dark:shadow-primary/20"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isEditMode ? 'Update Appointment' : 'Create Appointment'}
          </button>
        </div>
      </form>
    </div>
  );
}
