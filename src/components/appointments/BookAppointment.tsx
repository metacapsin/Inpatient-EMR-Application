import React, { useEffect, useMemo, useState, useRef } from 'react';
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

// Custom Dropdown Component
interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      
      {/* Selected Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full px-4 py-3
          border border-[#3b2d1f]
          rounded-lg
          flex items-center justify-between
          cursor-pointer
          transition-all duration-200
          bg-[#111111]
          hover:border-[#6b4d2e]
          ${
            disabled
              ? "opacity-50 cursor-not-allowed"
              : ""
          }
        `}
      >
        <span
          className={`
            text-sm md:text-base
            ${
              selectedOption
                ? "text-[#94a3b8]"
                : "text-gray-500"
            }
          `}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {/* Dropdown Options */}
      {isOpen && !disabled && (
        <div
          className="
            absolute z-50 w-full mt-2
            bg-[#111111]
            border border-[#3b2d1f]
            rounded-lg
            shadow-xl
            overflow-y-auto
          "
          style={{ maxHeight: "250px" }}
        >
          {loading ? (
            <div className="px-4 py-3 text-gray-400">
              Loading...
            </div>
          ) : options.length === 0 ? (
            <div className="px-4 py-3 text-gray-400">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <div
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`
                  px-4 py-3
                  cursor-pointer
                  transition-all duration-200
                  text-sm md:text-base
                  ${
                    value === option.id
                      ? "bg-blue-600 text-white"
                      : "text-[#94a3b8] hover:bg-[#1e1e1e]"
                  }
                `}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="text-danger text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
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
      patientEmail: email || prev.patientEmail,
      patientPhone: phone || prev.patientPhone,
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

  // Convert time slots to options format
  const timeSlotOptions: Option[] = timeSlots.map(slot => ({ id: slot, label: slot }));

  if (loading) return <div className="panel">Loading appointment form...</div>;

  return (
    <div className="panel">
      <style>{`
        /* Remove any default select styling that might cause double arrows */
        select.form-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: none !important;
        }
        
        /* Ensure custom dropdown doesn't inherit any select styles */
        .relative > div:first-child {
          background-image: none !important;
        }
        
        /* Responsive styles for custom dropdown */
        @media (max-width: 768px) {
          .relative > div:first-child {
            font-size: 14px;
          }
        }
        
        @media (max-width: 640px) {
          .relative > div:first-child {
            font-size: 13px;
          }
        }
        
        /* Custom scrollbar for dropdown */
        .overflow-auto::-webkit-scrollbar {
          width: 8px;
        }
        
        .overflow-auto::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        
        .overflow-auto::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        
        /* Animation for dropdown */
        .absolute {
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Make all input fields consistent size */
        .form-input, .form-textarea, .custom-dropdown {
          width: 100%;
          box-sizing: border-box;
        }

        /* Ensure consistent height for all form controls */
        input, .custom-dropdown > div:first-child, textarea {
          width: 100%;
        }
      `}</style>
      
      <h2 className="text-xl font-semibold mb-4">{isEditMode ? 'Edit Appointment' : 'Create Appointment'}</h2>
      {topErrorMessage && (
        <div className="mb-4 flex justify-center">
          <p className="text-danger text-sm text-center">{topErrorMessage}</p>
        </div>
      )}
      
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Patient - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Patient *</label>
          <CustomDropdown
            value={form.patientId}
            onChange={(value) => {
              setForm((p) => ({ ...p, patientId: value, patientEmail: '', patientPhone: '' }));
              if (errors.patientId) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.patientId;
                  return next;
                });
              }
            }}
            options={patients}
            placeholder="Select patient"
            error={errors.patientId}
          />
        </div>

        {/* Email - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Email</label>
          <input 
            type="email" 
            className="w-full px-4 py-3 border border-[#3b2d1f] rounded-lg bg-[#111111] text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ minHeight: '50px' }}
            value={form.patientEmail} 
            onChange={(e) => setForm((p) => ({ ...p, patientEmail: e.target.value }))}
            placeholder={selectedPatient ? "Auto-filled if available, or type email" : "Select patient first"}
          />
          <p className="text-gray-500 text-xs mt-1">Auto-fills from patient record if available, but you can edit manually.</p>
        </div>

        {/* Phone - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Phone</label>
          <input 
            type="tel" 
            className="w-full px-4 py-3 border border-[#3b2d1f] rounded-lg bg-[#111111] text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ minHeight: '50px' }}
            value={form.patientPhone} 
            onChange={(e) => setForm((p) => ({ ...p, patientPhone: e.target.value }))}
            placeholder={selectedPatient ? "Auto-filled if available, or type phone" : "Select patient first"}
          />
          <p className="text-gray-500 text-xs mt-1">Auto-fills from patient record if available, but you can edit manually.</p>
        </div>

        {/* Provider - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Provider *</label>
          <CustomDropdown
            value={form.providerId}
            onChange={(value) => setForm((p) => ({ ...p, providerId: value, time: '' }))}
            options={providers}
            placeholder="Select provider"
            error={errors.providerId}
          />
        </div>

        {/* Visit Reason Type - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Visit Reason Type *</label>
          <CustomDropdown
            value={form.visitReasonId}
            onChange={(value) => setForm((p) => ({ ...p, visitReasonId: value }))}
            options={visitReasonTypes}
            placeholder="Select visit reason type"
            error={errors.visitReasonId}
          />
        </div>

        {/* Service Location - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Service Location *</label>
          <CustomDropdown
            value={form.serviceLocationId}
            onChange={(value) => setForm((p) => ({ ...p, serviceLocationId: value, time: '' }))}
            options={serviceLocations}
            placeholder="Select service location"
            error={errors.serviceLocationId}
          />
        </div>

        {/* Date - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Date *</label>
          <input 
            type="date" 
            className="w-full px-4 py-3 border border-[#3b2d1f] rounded-lg bg-[#111111] text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ minHeight: '50px' }}
            value={form.date} 
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, time: '' }))} 
          />
          {errors.date && <p className="text-danger text-xs mt-1">{errors.date}</p>}
        </div>

        {/* Time - Takes 6 columns on mobile, 3 columns on md and above */}
        <div className="col-span-6 md:col-span-3 lg:col-span-3">
          <label className="form-label block mb-2">Time *</label>
          <CustomDropdown
            value={form.time}
            onChange={(value) => setForm((p) => ({ ...p, time: value }))}
            options={timeSlotOptions}
            placeholder={
              !form.providerId || !form.date || !form.serviceLocationId
                ? 'Select provider, location and date first'
                : loadingSlots
                  ? 'Loading time slots...'
                  : timeSlots.length
                    ? 'Select time slot'
                    : 'No available time slots'
            }
            error={errors.time}
            disabled={!form.providerId || !form.date || !form.serviceLocationId || loadingSlots}
            loading={loadingSlots}
          />
        </div>

        {/* Visit Reason - Takes full width */}
        <div className="col-span-6">
          <label className="form-label block mb-2">Visit Reason *</label>
          <CustomDropdown
            value={form.visitReason}
            onChange={(value) => setForm((p) => ({ ...p, visitReason: value }))}
            options={visitReasons}
            placeholder="Select visit reason"
            error={errors.visitReason}
          />
        </div>

        {/* Notes - Takes full width */}
        <div className="col-span-6">
          <label className="form-label block mb-2">Notes</label>
          <textarea 
            rows={3} 
            className="w-full px-4 py-3 border border-[#3b2d1f] rounded-lg bg-[#111111] text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ minHeight: '80px' }}
            value={form.notes} 
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} 
          />
        </div>

        {/* Buttons - Takes full width */}
        <div className="col-span-6 flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary px-6 py-2 rounded-lg" onClick={() => navigate('/app/appointments')}>Cancel</button>
          <button type="submit" className="btn btn-primary px-6 py-2 rounded-lg" disabled={submitting}>{submitting ? 'Saving...' : isEditMode ? 'Update Appointment' : 'Create Appointment'}</button>
        </div>
      </form>
    </div>
  );
}