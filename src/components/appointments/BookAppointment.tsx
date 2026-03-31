import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format, parse } from 'date-fns';
import { appointmentAPI } from '../../services/api';

type Option = { id: string; label: string; raw?: any };
type FormState = {
  patientId: string;
  providerId: string;
  visitReasonId: string;
  serviceLocationId: string;
  visitReason: string;
  date: string;
  time: string;
  notes: string;
  patientEmail: string;
  patientPhone: string;
};

const EMPTY_FORM: FormState = {
  patientId: '',
  providerId: '',
  visitReasonId: '',
  serviceLocationId: '',
  visitReason: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  notes: '',
  patientEmail: '',
  patientPhone: '',
};

function toOptions(rows: any[], key: string): Option[] {
  return rows
    .map((row) => ({
      id: String(row?._id ?? row?.id ?? '').trim(),
      label: String(row?.[key] ?? row?.displayName ?? '').trim() || '—',
      raw: row,
    }))
    .filter((x) => !!x.id);
}

function toPatientOptions(rows: any[]): Option[] {
  return rows
    .map((row) => {
      const id = String(row?._id ?? row?.id ?? row?.patientId ?? '').trim();
      const label = String(
        row?.fullName ??
        row?.patientName ??
        [row?.firstName, row?.middleName, row?.lastName].filter(Boolean).join(' ')
      ).trim() || '—';
      return { id, label, raw: row };
    })
    .filter((x) => !!x.id);
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

function toVisitReasonOptions(rows: any[]): Option[] {
  return rows
    .map((row) => ({
      id: String(row?._id ?? row?.id ?? '').trim(),
      label: String(row?.VisitTypeName ?? row?.visitTypeName ?? row?.visitReasonName ?? '').trim() || '—',
      raw: row,
    }))
    .filter((x) => !!x.id && x.label !== '—');
}

export default function BookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId')?.trim() ?? '';
  const patientIdParam = searchParams.get('patientId')?.trim() ?? '';
  const isEditMode = Boolean(appointmentId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [patients, setPatients] = useState<Option[]>([]);
  const [providers, setProviders] = useState<Option[]>([]);
  const [visitReasonTypes, setVisitReasonTypes] = useState<Option[]>([]);
  const [visitReasons, setVisitReasons] = useState<Option[]>([]);
  const [serviceLocations, setServiceLocations] = useState<Option[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setApiError('');
      try {
        const [patientRes, userRes, visitReasonRes, visitTypeRes, locationRes] = await Promise.all([
          appointmentAPI.getDropdownListData({ listName: 'patient-details', sortBy: 'fullName' }),
          appointmentAPI.getDropdownListData({ listName: 'users', sortBy: 'firstName' }),
          appointmentAPI.getDropdownListData({ listName: 'visit-reason', sortBy: 'visitReasonName' }),
          appointmentAPI.getVisitTypesList(),
          appointmentAPI.getDropdownListData({ listName: 'service-location', sortBy: 'name' }),
        ]);

        const patientOptions = toPatientOptions(Array.isArray(patientRes?.data?.data) ? patientRes.data.data : []);
        setPatients(patientOptions);

        const providerOptions = (Array.isArray(userRes?.data?.data) ? userRes.data.data : [])
          .filter((x: any) => x?.status && Array.isArray(x?.role) && x.role.some((r: string) => r.toLowerCase() === 'provider'))
          .map((x: any) => ({
            id: String(x?._id ?? x?.id ?? ''),
            label: [x?.prefix, x?.firstName, x?.lastName, x?.suffix].filter(Boolean).join(' ').trim(),
            raw: x,
          }))
          .filter((x: Option) => !!x.id);
        setProviders(providerOptions);

        setVisitReasonTypes(toOptions(Array.isArray(visitReasonRes?.data?.data) ? visitReasonRes.data.data : [], 'visitReasonName'));
        setVisitReasons(toVisitReasonOptions(Array.isArray(visitTypeRes?.data?.data) ? visitTypeRes.data.data : []));
        setServiceLocations(toOptions(Array.isArray(locationRes?.data?.data) ? locationRes.data.data : [], 'name'));
        if (patientIdParam && patientOptions.some((x) => x.id === patientIdParam)) {
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
          const normalizedDate = /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)
            ? format(parse(rawDate, 'MM/dd/yyyy', new Date()), 'yyyy-MM-dd')
            : rawDate;
          setForm({
            patientId: String(row.patientId ?? ''),
            providerId: String(row.providerId ?? ''),
            visitReasonId: String(row.visitReasonId ?? ''),
            serviceLocationId: String(row.serviceLocationId ?? ''),
            visitReason: String(row.visitReasonmsg ?? row.visitReasonName ?? ''),
            date: normalizedDate,
            time: String(row.startTime ?? ''),
            notes: String(row.note ?? ''),
            patientEmail: String(row.patientEmail ?? row.emailAddress ?? row.email ?? ''),
            patientPhone: String(row.patientPhone ?? row.mobilePhone ?? row.homePhone ?? ''),
          });
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

  const selectedPatient = useMemo(() => patients.find((x) => x.id === form.patientId), [patients, form.patientId]);
  const selectedProvider = useMemo(() => providers.find((x) => x.id === form.providerId), [providers, form.providerId]);
  const selectedVisitType = useMemo(
    () => visitReasonTypes.find((x) => x.id === form.visitReasonId),
    [visitReasonTypes, form.visitReasonId]
  );
  const selectedLocation = useMemo(() => serviceLocations.find((x) => x.id === form.serviceLocationId), [serviceLocations, form.serviceLocationId]);
  const topErrorMessage = useMemo(() => {
    if (apiError) return apiError;
    const orderedFields = ['patientId', 'providerId', 'date', 'time'] as const;
    for (const field of orderedFields) {
      if (errors[field]) return errors[field];
    }
    return '';
  }, [apiError, errors]);

  useEffect(() => {
    if (!selectedPatient?.raw) return;
    const email = pickPatientEmail(selectedPatient.raw);
    const phone = pickPatientPhone(selectedPatient.raw);
    setForm((prev) => ({
      ...prev,
      patientEmail: email,
      patientPhone: phone,
    }));
  }, [selectedPatient?.id]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!form.providerId || !form.date || !form.serviceLocationId) {
        setTimeSlots([]);
        return;
      }
      setLoadingSlots(true);
      setApiError('');
      try {
        const weekday = format(parse(form.date, 'yyyy-MM-dd', new Date()), 'EEEE').toLowerCase();
        const mmddyyyy = format(parse(form.date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy');
        const res = await appointmentAPI.getProviderAvailableSlots({
          userId: form.providerId,
          providerId: form.providerId,
          serviceLocationId: form.serviceLocationId,
          locationId: form.serviceLocationId,
          day: weekday,
          date: mmddyyyy,
        });
        const slots = parseSlots(res?.data?.data);
        setTimeSlots(slots);
        if (form.time && !slots.includes(form.time)) {
          setForm((prev) => ({ ...prev, time: '' }));
        }
      } catch (error) {
        console.error(error);
        setTimeSlots([]);
        setApiError('Unable to load available time slots for the selected provider/date/location.');
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [form.providerId, form.date, form.serviceLocationId]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.patientId) next.patientId = 'Patient is required.';
    if (!form.providerId) next.providerId = 'Provider is required.';
    if (!form.visitReasonId) next.visitReasonId = 'Visit reason type is required.';
    if (!form.serviceLocationId) next.serviceLocationId = 'Service location is required.';
    if (!form.visitReason.trim()) next.visitReason = 'Visit reason is required.';
    if (!form.date) next.date = 'Date is required.';
    if (!form.time) next.time = 'Time is required.';
    if (form.time && timeSlots.length > 0 && !timeSlots.includes(form.time)) {
      next.time = 'Please choose an available time slot.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEditMode && !appointmentId) {
      toast.error('Missing appointment ID.');
      return;
    }

    const startDate = format(parse(form.date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy');
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
      visitReasonId: form.visitReasonId,
      visitReasonName: selectedVisitType?.label ?? '',
      visitReasonmsg: form.visitReason.trim(),
      serviceLocationId: form.serviceLocationId,
      serviceLocationName: selectedLocation?.label ?? '',
      startDate,
      startTime: form.time,
      duration,
      note: form.notes.trim(),
    };

    try {
      setSubmitting(true);
      setApiError('');
      const res = isEditMode ? await appointmentAPI.updateAppointment(payload) : await appointmentAPI.createAppointment(payload);
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

  if (loading) return <div className="panel">Loading appointment form...</div>;

  return (
    <div className="panel">
      <h2 className="text-xl font-semibold mb-4">{isEditMode ? 'Edit Appointment' : 'Create Appointment'}</h2>
      {topErrorMessage && (
        <div className="mb-4 flex justify-center">
          <p className="text-danger text-sm text-center">{topErrorMessage}</p>
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="form-label">Patient *</label>
          <select
            className="form-select"
            value={form.patientId}
            onChange={(e) => {
              const nextPatientId = e.target.value;
              setForm((p) => ({ ...p, patientId: nextPatientId, patientEmail: '', patientPhone: '' }));
              if (errors.patientId) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.patientId;
                  return next;
                });
              }
            }}
          >
            <option value="">Select patient</option>
            {patients.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {errors.patientId && <p className="text-danger text-xs mt-1">{errors.patientId}</p>}
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="text" className="form-input" value={form.patientEmail} readOnly placeholder="Auto-filled from patient" />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input type="text" className="form-input" value={form.patientPhone} readOnly placeholder="Auto-filled from patient" />
        </div>
        <div>
          <label className="form-label">Provider *</label>
          <select
            className="form-select"
            value={form.providerId}
            onChange={(e) => setForm((p) => ({ ...p, providerId: e.target.value, time: '' }))}
          >
            <option value="">Select provider</option>
            {providers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {errors.providerId && <p className="text-danger text-xs mt-1">{errors.providerId}</p>}
        </div>
        <div>
          <label className="form-label">Visit Reason Type *</label>
          <select className="form-select" value={form.visitReasonId} onChange={(e) => setForm((p) => ({ ...p, visitReasonId: e.target.value }))}>
            <option value="">Select visit reason type</option>
            {visitReasonTypes.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {errors.visitReasonId && <p className="text-danger text-xs mt-1">{errors.visitReasonId}</p>}
        </div>
        <div>
          <label className="form-label">Service Location *</label>
          <select
            className="form-select"
            value={form.serviceLocationId}
            onChange={(e) => setForm((p) => ({ ...p, serviceLocationId: e.target.value, time: '' }))}
          >
            <option value="">Select service location</option>
            {serviceLocations.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {errors.serviceLocationId && <p className="text-danger text-xs mt-1">{errors.serviceLocationId}</p>}
        </div>
        <div>
          <label className="form-label">Date *</label>
          <input type="date" className="form-input" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, time: '' }))} />
          {errors.date && <p className="text-danger text-xs mt-1">{errors.date}</p>}
        </div>
        <div>
          <label className="form-label">Time *</label>
          <select
            className="form-select"
            value={form.time}
            onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            disabled={!form.providerId || !form.date || !form.serviceLocationId || loadingSlots}
          >
            <option value="">
              {!form.providerId || !form.date || !form.serviceLocationId
                ? 'Select provider, location and date first'
                : loadingSlots
                  ? 'Loading time slots...'
                  : timeSlots.length
                    ? 'Select time slot'
                    : 'No available time slots'}
            </option>
            {timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          {errors.time && <p className="text-danger text-xs mt-1">{errors.time}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="form-label">Visit Reason *</label>
          <select className="form-select" value={form.visitReason} onChange={(e) => setForm((p) => ({ ...p, visitReason: e.target.value }))}>
            <option value="">Select visit reason</option>
            {visitReasons.map((x) => <option key={x.id} value={x.label}>{x.label}</option>)}
          </select>
          {errors.visitReason && <p className="text-danger text-xs mt-1">{errors.visitReason}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="form-label">Notes</label>
          <textarea rows={3} className="form-textarea" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/app/appointments')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : isEditMode ? 'Update Appointment' : 'Create Appointment'}</button>
        </div>
      </form>
    </div>
  );
}
