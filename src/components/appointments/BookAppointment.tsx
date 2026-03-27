import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { appointmentAPI } from '../../services/api';
import { format, parse, isValid, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays } from 'date-fns';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface Patient {
  _id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  emailAddress?: string;
  homePhone?: string;
  dOB?: string;
  sex?: string;
  patientId?: string;
  patientName?: string;
}

interface Provider {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  suffix?: string;
  status?: boolean;
  role?: string[];
}

interface VisitReason {
  _id: string;
  visitReasonName: string;
  VisitTypeName?: string;
  visitReasonColorInCalender?: string;
}

interface ServiceLocation {
  _id: string;
  name: string;
  displayName: string;
}

interface RoomNumber {
  id: string;
  roomNumber: string;
}

interface VisitReasonDropdown {
  id: string | number;
  reason: string;
}

interface AppointmentFormData {
  Patient: Patient | null;
  Provider: Provider | null;
  VisitReason: VisitReason | null;
  visitReasonName: string;
  otherReason: string;
  RoomNumber: RoomNumber | null;
  StartDate: string;
  StartTime: string;
  Duration: number | string;
  ServiceLocation: ServiceLocation | null;
  AppointmentMode: string;
  copayAmount: string;
  Note: string;
  Email: string;
  Phone: string;
  preferredContactMethod: string;
  isTelehealth: boolean;
}

export default function BookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState<AppointmentFormData>({
    Patient: null,
    Provider: null,
    VisitReason: null,
    visitReasonName: '',
    otherReason: '',
    RoomNumber: null,
    StartDate: format(new Date(), 'MM/dd/yyyy'),
    StartTime: '',
    Duration: 15,
    ServiceLocation: null,
    AppointmentMode: 'inOffice',
    copayAmount: '',
    Note: '',
    Email: '',
    Phone: '',
    preferredContactMethod: '',
    isTelehealth: false,
  });

  const [providerList, setProviderList] = useState<Provider[]>([]);
  const [visitReason, setVisitReason] = useState<VisitReason[]>([]);
  const [visitReasonsListDropdown, setVisitReasonsListDropdown] = useState<VisitReasonDropdown[]>([]);
  const [serviceLocationOptions, setServiceLocationOptions] = useState<ServiceLocation[]>([]);
  const [allServiceLocations, setAllServiceLocations] = useState<ServiceLocation[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarIncrement, setCalendarIncrement] = useState(15);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [getAvailableSlotDetails, setGetAvailableSlotDetails] = useState<any>({});
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  const conflictCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const initialFetchDone = useRef(false);

  const formatDateForInput = (dateString: string): string => {
    try {
      const d = parse(dateString, 'MM/dd/yyyy', new Date());
      return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
    } catch {
      return '';
    }
  };

  const formatDateFromInput = (dateString: string): string => {
    try {
      const d = parse(dateString, 'yyyy-MM-dd', new Date());
      return isValid(d) ? format(d, 'MM/dd/yyyy') : dateString;
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userDetails = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const rawPatientData = localStorage.getItem('patientData');
    let patientData: Record<string, any> | null = null;
    try {
      if (rawPatientData) patientData = JSON.parse(rawPatientData);
    } catch (_) {}
    const pd = patientData?.data ?? patientData;
    const patient: Patient | null = userDetails && Object.keys(userDetails).length > 0
      ? {
          ...(pd || {}),
          ...userDetails,
          _id: userDetails._id ?? userDetails.id ?? pd?._id ?? pd?.id,
          patientId: userDetails.patientId ?? userDetails.rcopiaID ?? pd?.patientId ?? pd?.rcopiaID ?? userDetails._id ?? userDetails.id ?? pd?._id ?? pd?.id,
          fullName: userDetails.fullName ?? pd?.fullName ?? (pd?.firstName && pd?.lastName ? `${pd.firstName} ${pd.lastName}`.trim() : undefined) ?? userDetails.patientName ?? userDetails.name,
          patientName: userDetails.patientName ?? pd?.patientName ?? userDetails.fullName ?? pd?.fullName ?? (pd?.firstName && pd?.lastName ? `${pd.firstName} ${pd.lastName}`.trim() : undefined),
          dOB: userDetails.dOB ?? pd?.dOB ?? pd?.dateOfBirth,
          sex: userDetails.sex ?? pd?.sex ?? pd?.gender,
          emailAddress: userDetails.email ?? userDetails.emailAddress ?? pd?.emailAddress ?? pd?.email,
          homePhone: userDetails.homePhone ?? pd?.homePhone ?? userDetails.phone ?? pd?.phone,
        } as Patient
      : (pd ? { ...pd, _id: pd._id ?? pd.id, patientId: pd.patientId ?? pd.rcopiaID ?? pd._id ?? pd.id } as Patient : null);

    let emailFromStorage = '';
    try {
      emailFromStorage = localStorage.getItem('patientEmail')?.trim() ?? '';
      if (!emailFromStorage) {
        const patientLoginResponse = localStorage.getItem('patientLoginResponse');
        if (patientLoginResponse) {
          const data = JSON.parse(patientLoginResponse);
          emailFromStorage =
            data.patientEmail ?? data.data?.patientEmail ?? data.user?.email ?? data.user?.emailAddress ?? '';
        }
      }
      if (!emailFromStorage && patient) {
        emailFromStorage = (patient as any).email ?? (patient as any).emailAddress ?? (patient as any).patientEmail ?? '';
      }
    } catch (_) {}
    if (patient) {
      setFormData(prev => ({ ...prev, Patient: patient, ...(emailFromStorage ? { Email: emailFromStorage } : {}) }));
    } else if (emailFromStorage) {
      setFormData(prev => ({ ...prev, Email: emailFromStorage }));
    }
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(today.getFullYear() + 1);
    setMinDate(today);
    setMaxDate(oneYearFromToday);
  }, []);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    (async () => {
      try {
        const [settingsRes, visitTypesRes, dropdownRes] = await Promise.all([
          appointmentAPI.getGeneralCalendarSetting(),
          appointmentAPI.getVisitTypesList(),
          appointmentAPI.getDropdownListData({ listName: 'users', sortBy: 'firstName' }),
        ]);

        if (settingsRes.data.status === 'success' && settingsRes.data.data?.calendarIncrement) {
          setCalendarIncrement(settingsRes.data.data.calendarIncrement);
          setFormData(prev => ({ ...prev, Duration: settingsRes.data.data.calendarIncrement }));
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
          if (!seen.has('medicare initial wellness exam')) {
            reasons.push({ id: 'medicare-initial', reason: 'MEDICARE Initial Wellness Exam' });
          }
          reasons.push({ id: 'other', reason: 'Other' });
          setVisitReasonsListDropdown(reasons);
        } else {
          setVisitReasonsListDropdown([
            { id: 'medicare', reason: 'MEDICARE Initial Wellness Exam' },
            { id: 'follow-up', reason: 'Follow-up' },
            { id: 'consultation', reason: 'Consultation' },
            { id: 'check-up', reason: 'Check-up' },
            { id: 'other', reason: 'Other' },
          ]);
        }

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
            setVisitReason(vrRes.data.data || []);
          }

          const slPayload = { listName: 'service-location', sortBy: 'name' };
          const slRes = await appointmentAPI.getDropdownListData(slPayload);
          if (slRes.data?.status === 'success') {
            const locs = (slRes.data.data || []).map((loc: any) => ({ ...loc, displayName: loc.name || loc.displayName || '' }));
            setAllServiceLocations(locs);
            setServiceLocationOptions(locs);
          }
        }
      } catch (err) {
        console.error('Error initializing:', err);
      }
    })();

    const slotDate = searchParams.get('slotDate');
    if (slotDate) {
      try {
        const d = new Date(slotDate);
        if (isValid(d)) {
          setFormData(prev => ({
            ...prev,
            StartDate: format(d, 'MM/dd/yyyy'),
            StartTime: format(d, 'hh:mm a'),
          }));
        }
      } catch (_) {}
    }

    return () => {
      if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    };
  }, []);

  const filterServiceLocations = useCallback(async () => {
    setServiceLocationOptions(allServiceLocations);
    if (formData.Provider && formData.ServiceLocation && !allServiceLocations.find(l => l._id === formData.ServiceLocation?._id)) {
      setFormData(prev => ({ ...prev, ServiceLocation: null }));
    }
  }, [allServiceLocations, formData.Provider, formData.ServiceLocation]);

  const handleProviderChange = (provider: Provider | null) => {
    setFormData(prev => ({
      ...prev,
      Provider: provider,
      ServiceLocation: provider ? prev.ServiceLocation : null,
      StartTime: '',
    }));
    setAppointmentSlots([]);
    filterServiceLocations();
    if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
    conflictCheckTimeout.current = setTimeout(performConflictCheck, 300);
  };

  const handleVisitReasonChange = (reason: string) => {
    setFormData(prev => ({ ...prev, visitReasonName: reason }));
    setShowOtherReasonInput(reason === 'Other');
    if (reason !== 'Other') setFormData(prev => ({ ...prev, otherReason: '' }));
  };

  const getProviderAvailableSlots = useCallback(async () => {
    const { Provider, StartDate } = formDataRef.current;
    if (!Provider || !StartDate) return;

    const startDate = parse(StartDate, 'MM/dd/yyyy', new Date());
    if (!isValid(startDate)) return;

    const weekday = format(startDate, 'EEEE').toLowerCase();
    try {
      const res = await appointmentAPI.getProviderAvailableSlots({
        userId: Provider._id,
        day: weekday,
        date: StartDate,
      });

      if (res.data) {
        setGetAvailableSlotDetails(res.data);
        const slots = res.data.data || [];

        if (res.data.status === 'error') {
          if (
            res.data.message?.includes('No working hours') ||
            res.data.message?.includes('No working hours defined')
          ) {
            setHasConflict(true);
            setConflictMessage(
              `No working hours for ${Provider.name} on ${format(startDate, 'MMM dd, yyyy')}`
            );
            setAppointmentSlots([]);
          }
        } else if (res.data.onHoliday) {
          setHasConflict(true);
          setConflictMessage(`Provider is on holiday on ${format(startDate, 'MMM dd, yyyy')}`);
          setAppointmentSlots([]);
        } else if (res.data.message?.includes("You can't book past time slots")) {
          setHasConflict(true);
          setConflictMessage(res.data.message);
          setAppointmentSlots([]);
        } else if (res.data.message === 'No available time slots' && (!slots || slots.length === 0)) {
          setHasConflict(true);
          setConflictMessage(`No available time slots for ${Provider.name} on ${format(startDate, 'MMM dd, yyyy')}`);
          setAppointmentSlots([]);
        } else {
          setAppointmentSlots(slots);
          if (
            !conflictMessage?.includes('conflicts') &&
            !conflictMessage?.includes('time off') &&
            !conflictMessage?.includes('break') &&
            !conflictMessage?.includes('office hours')
          ) {
            setHasConflict(false);
            setConflictMessage('');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  }, []);

  useEffect(() => {
    if (formData.Provider && formData.StartDate) {
      getProviderAvailableSlots();
    } else {
      setAppointmentSlots([]);
    }
  }, [formData.Provider, formData.StartDate, getProviderAvailableSlots]);

  const performConflictCheck = async () => {
    const latest = formDataRef.current;
    getProviderAvailableSlots();

    if (!latest.Provider || !latest.Duration || !latest.StartDate || !latest.StartTime || !latest.ServiceLocation) {
      setConflictMessage('');
      setHasConflict(false);
      return;
    }

    try {
      const res = await appointmentAPI.checkConflict({
        serviceLocationId: latest.ServiceLocation._id,
        providerId: latest.Provider._id,
        duration: latest.Duration,
        startTime: latest.StartTime,
        startDate: latest.StartDate,
      });

      if (res.data.status !== 'success') return;

      const conflicts: string[] = [];
      const data = res.data.data || {};
      if (data.onHoliday) conflicts.push(`Provider is on holiday`);
      if (data.appointments) conflicts.push(`The selected time conflicts with another appointment`);
      if (data.onBreak) conflicts.push(`Provider is on a break at this time`);
      if (data.onTimeOff) conflicts.push(`Provider is on time off`);
      if (data.outsideOfficeHours) conflicts.push(`Outside office hours`);
      if (data.onServiceLocation === false) conflicts.push(`Provider not available at this location`);

      setConflictMessage(conflicts.join('. '));
      setHasConflict(conflicts.length > 0);
    } catch (_) {
      setConflictMessage('Unable to verify availability.');
      setHasConflict(true);
    }
  };

  const validateForm = (d?: AppointmentFormData): boolean => {
    const data = d ?? formDataRef.current;
    const newErrors: Record<string, string> = {};
    const p = data.Patient as any;
    const patientId = p?.patientId ?? p?.rcopiaID ?? p?._id ?? p?.id;
    if (!patientId) newErrors.Patient = 'Please log in again. Patient session expired or missing.';

    if (!data.Provider) newErrors.Provider = 'Provider is required.';
    if (!data.VisitReason) newErrors.VisitReason = 'Visit type is required.';
    if (!data.visitReasonName) newErrors.visitReasonName = 'Visit reason is required.';
    else if (data.visitReasonName.length < 3) newErrors.visitReasonName = 'Minimum 3 characters.';
    else if (data.visitReasonName.length > 100) newErrors.visitReasonName = 'Maximum 100 characters.';

    if (showOtherReasonInput) {
      if (!data.otherReason) newErrors.otherReason = 'Please specify reason.';
      else if (data.otherReason.length < 3) newErrors.otherReason = 'Minimum 3 characters.';
    }

    if (data.Provider && !data.ServiceLocation) newErrors.ServiceLocation = 'Service location is required.';
    if (data.Provider && !data.StartDate) newErrors.StartDate = 'Date is required.';
    if (data.Provider && !data.StartTime) newErrors.StartTime = 'Time is required.';
    if (data.Provider && !data.Duration) newErrors.Duration = 'Duration is required.';

    if (data.Note?.trim()) {
      if (data.Note.length < 5) newErrors.Note = 'Minimum 5 characters.';
      else if (data.Note.length > 500) newErrors.Note = 'Maximum 500 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const latest = formDataRef.current;

    if (!validateForm(latest)) {
      setIsSubmitting(false);
      return;
    }

    const phoneNumber = (latest.Phone || '').replace(/\D/g, '');
    const p = latest.Patient as any;
    const request = {
      patientId: p?.patientId ?? p?.rcopiaID ?? p?._id ?? p?.id,
      patientName: p?.patientName ?? p?.fullName ?? (p?.firstName && p?.lastName ? `${p.firstName} ${p.lastName}`.trim() : undefined) ?? p?.name,
      dob: latest.Patient?.dOB,
      sex: latest.Patient?.sex,
      providerId: latest.Provider?._id,
      providerName: latest.Provider?.name,
      visitReasonId: latest.VisitReason?._id,
      visitReasonName: latest.VisitReason?.visitReasonName ?? '',
      visitReasonColorInCalender: latest.VisitReason?.visitReasonColorInCalender,
      visitReasonmsg: latest.visitReasonName ?? '',
      otherReason: latest.otherReason,
      duration: latest.Duration,
      startTime: latest.StartTime,
      startDate: latest.StartDate,
      endDate: '',
      roomNumber: latest.RoomNumber?.roomNumber,
      roomNumberId: latest.RoomNumber?.id,
      serviceLocationId: latest.ServiceLocation?._id,
      serviceLocationName: latest.ServiceLocation?.name,
      copayAmount: latest.copayAmount,
      note: latest.Note,
      phoneNo: phoneNumber,
      emailTo: latest.Email,
      preferredContactMethod: latest.preferredContactMethod,
      isTelehealth: latest.isTelehealth,
    };

    try {
      const res = await appointmentAPI.createAppointment(request);
      if (res.data?.status === 'success') {
        toast.success(res.data.message || 'Appointment booked successfully');
        setTimeout(() => navigate('/app/appointments'), 800);
      } else {
        toast.error(res.data?.message || 'Failed to book appointment');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateSelect = (d: Date) => {
    const formatted = format(d, 'MM/dd/yyyy');
    setFormData(prev => ({ ...prev, StartDate: formatted, StartTime: '' }));
    setCalendarMonth(d);
  };

  const handleTimeSelect = (time: string) => {
    setFormData(prev => ({ ...prev, StartTime: time }));
  };

  const handleCancel = () => navigate('/app/appointments');

  const selectedDate = (() => {
    try {
      const d = parse(formData.StartDate, 'MM/dd/yyyy', new Date());
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

  const notesLength = formData.Note?.length ?? 0;
  const availableTodayLabel = selectedDate
    ? `Available ${format(selectedDate, 'EEE')}, ${format(selectedDate, 'MMM d')}`
    : 'Select a date';

  return (
    <div>
      <div className="panel overflow-y-auto">
        {/* Breadcrumb */}
        <nav className="mb-5">
          <ol className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <button
                type="button"
                onClick={() => navigate('/app/appointments')}
                className="hover:text-primary dark:hover:text-primary-400 transition-colors"
              >
                Appointment
              </button>
            </li>
            <li>/</li>
            <li className="font-medium text-gray-900 dark:text-white">Book Appointment</li>
          </ol>
        </nav>

        {/* Card content */}
        <div>
            {/* <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Book an Appointment
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Select Provider, Visit Type, Reason, Date & Time
            </p> */}

            {hasConflict && conflictMessage && (
              <div className="mt-4 flex justify-center" role="alert">
                <div className="flex items-center gap-3 w-full max-w-xl rounded-xl border-2 border-danger/50 bg-danger/10 dark:bg-danger/20 px-5 py-4 text-danger">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{conflictMessage}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              {/* Row 1: Provider, Visit Type, Visit Reason, Service Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Provider <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select w-full rounded-xl border-2 px-4 py-2.5 transition-colors bg-white dark:bg-gray-800/50 ${errors.Provider ? 'border-danger focus:border-danger' : 'border-gray-200 dark:border-gray-600 focus:border-primary dark:focus:border-primary'}`}
                    value={formData.Provider?._id || ''}
                    onChange={(e) => {
                      const p = providerList.find(x => x._id === e.target.value);
                      handleProviderChange(p || null);
                    }}
                  >
                    <option value="">Select Provider</option>
                    {providerList.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                  {errors.Provider && <p className="text-danger text-xs mt-1.5">{errors.Provider}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visit Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select w-full rounded-xl border-2 px-4 py-2.5 transition-colors bg-white dark:bg-gray-800/50 ${errors.VisitReason ? 'border-danger focus:border-danger' : 'border-gray-200 dark:border-gray-600 focus:border-primary dark:focus:border-primary'}`}
                    value={formData.VisitReason?._id || ''}
                    onChange={(e) => {
                      const vr = visitReason.find(x => x._id === e.target.value);
                      setFormData(prev => ({ ...prev, VisitReason: vr || null }));
                    }}
                  >
                    <option value="">Select Visit Type</option>
                    {visitReason.map(vr => (
                      <option key={vr._id} value={vr._id}>{vr.visitReasonName}</option>
                    ))}
                  </select>
                  {errors.VisitReason && <p className="text-danger text-xs mt-1.5">{errors.VisitReason}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visit Reason <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select w-full rounded-xl border-2 px-4 py-2.5 transition-colors bg-white dark:bg-gray-800/50 ${errors.visitReasonName ? 'border-danger focus:border-danger' : 'border-gray-200 dark:border-gray-600 focus:border-primary dark:focus:border-primary'}`}
                    value={formData.visitReasonName}
                    onChange={(e) => handleVisitReasonChange(e.target.value)}
                  >
                    <option value="">Select Visit Reason</option>
                    {visitReasonsListDropdown.map(vr => (
                      <option key={String(vr.id)} value={vr.reason}>{vr.reason}</option>
                    ))}
                  </select>
                  {errors.visitReasonName && <p className="text-danger text-xs mt-1.5">{errors.visitReasonName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Service Location <span className="text-danger">*</span>
                  </label>
                  <select
                    disabled={!formData.Provider}
                    className={`form-select w-full rounded-xl border-2 px-4 py-2.5 transition-colors bg-white dark:bg-gray-800/50 disabled:opacity-60 disabled:cursor-not-allowed ${errors.ServiceLocation ? 'border-danger focus:border-danger' : 'border-gray-200 dark:border-gray-600 focus:border-primary dark:focus:border-primary'}`}
                    value={formData.ServiceLocation?._id || ''}
                    onChange={(e) => {
                      const loc = serviceLocationOptions.find(l => l._id === e.target.value);
                      setFormData(prev => ({ ...prev, ServiceLocation: loc || null }));
                      if (conflictCheckTimeout.current) clearTimeout(conflictCheckTimeout.current);
                      conflictCheckTimeout.current = setTimeout(performConflictCheck, 300);
                    }}
                  >
                    <option value="">{formData.Provider ? 'Select Location' : 'Select Provider first'}</option>
                    {serviceLocationOptions.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.displayName}</option>
                    ))}
                  </select>
                  {errors.ServiceLocation && <p className="text-danger text-xs mt-1.5">{errors.ServiceLocation}</p>}
                </div>
              </div>

              {showOtherReasonInput && (
                <div className="mt-5 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Other Reason <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-input w-full rounded-xl border-2 px-4 py-2.5 transition-colors bg-white dark:bg-gray-800/50 ${errors.otherReason ? 'border-danger' : 'border-gray-200 dark:border-gray-600 focus:border-primary'}`}
                    value={formData.otherReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, otherReason: e.target.value }))}
                    placeholder="Specify reason"
                    maxLength={100}
                  />
                  {errors.otherReason && <p className="text-danger text-xs mt-1.5">{errors.otherReason}</p>}
                </div>
              )}

              {/* Visit Mode - Above calendar and time slots */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Visit Mode
                </label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="visitMode"
                      checked={!formData.isTelehealth}
                      onChange={() => setFormData(prev => ({ ...prev, isTelehealth: false }))}
                      className="form-radio rounded-full w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Office Visit</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="visitMode"
                      checked={formData.isTelehealth}
                      onChange={() => setFormData(prev => ({ ...prev, isTelehealth: true }))}
                      className="form-radio rounded-full w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Telehealth</span>
                  </label>
                </div>
              </div>

              <hr className="my-8 border-gray-200 dark:border-gray-600" aria-hidden="true" />

              {/* Calendar (left) + Time Slots (right) */}
              {formData.Provider && formData.ServiceLocation && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
                  {/* Calendar - LEFT SIDE */}
                  <div className="w-full flex flex-col min-h-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Select Date</h3>
                    <div className="rounded-xl border-2 border-gray-200  mt-[18px] dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/30 p-2.5 shadow-sm h-[220px] flex flex-col">                                    <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(m => subMonths(m, 1))}
                          className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-primary-800 transition-colors"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {format(calendarMonth, 'MMMM yyyy')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(m => addMonths(m, 1))}
                          className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-primary-800 transition-colors"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5 flex-1 min-h-0">
                        {paddingDays.map((d, i) => (
                          <button
                            key={`pad-${i}`}
                            type="button"
                            className="min-h-0 rounded-md text-gray-400 dark:text-gray-500 text-xs cursor-default flex items-center justify-center"
                            disabled
                          >
                            {format(d, 'd')}
                          </button>
                        ))}
                        {days.map(d => {
                          const isSelected = selectedDate && isSameDay(d, selectedDate);
                          const isCurrentMonth = isSameMonth(d, calendarMonth);
                          const isDisabled = (minDate && d < minDate) || (maxDate && d > maxDate);
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              onClick={() => !isDisabled && handleDateSelect(d)}
                              disabled={!!isDisabled}
                              className={`min-h-0 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                                isDisabled
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-primary text-white shadow-md ring-2 ring-primary/30'
                                  : isCurrentMonth
                                  ? 'text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20'
                                  : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/50'
                              }`}
                            >
                              {format(d, 'd')}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success dark:text-success shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        {availableTodayLabel}
                      </div>
                    </div>
                  </div>

                  {/* Time Slots - RIGHT SIDE */}
                  <div className="w-full flex flex-col min-h-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                      Available Time Slots
                      {selectedDate && (
                        <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                          {format(selectedDate, 'EEEE, MMM d, yyyy')}
                        </span>
                      )}
                    </h3>
                    {formData.StartTime && selectedDate && (
                      <p className="text-xs font-medium text-primary dark:text-primary-400 mb-2">
                        Selected: {format(selectedDate, 'MMM d')} • {formData.StartTime}
                      </p>
                    )}
<div className="rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/30 p-2.5 shadow-sm max-h-[220px] overflow-y-auto">                      {appointmentSlots.length === 0 ? (
                        selectedDate ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading available times...</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 w-full max-w-sm">
                              {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 flex items-center">
                            Select a date to see available times
                          </p>
                        )
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                          {appointmentSlots.map((slot) => {
                            const isSelected = formData.StartTime === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => handleTimeSelect(slot)}
                                className={`px-1.5 py-1 rounded-lg text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-primary text-white shadow-md ring-2 ring-primary/30'
                                    : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  className="form-textarea w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50 px-4 py-2 resize-y focus:border-primary transition-colors min-h-0"
                  placeholder="Add any notes for the doctor (optional)"
                  value={formData.Note}
                  onChange={(e) => setFormData(prev => ({ ...prev, Note: e.target.value }))}
                  maxLength={500}
                  rows={2}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {500 - notesLength} characters remaining
                </p>
                {errors.Note && <p className="text-danger text-xs mt-1">{errors.Note}</p>}
              </div>

              {/* Buttons */}
<div className="flex justify-end gap-3 mt-4">
  
  {/* Cancel */}
  <button
    type="button"
    onClick={handleCancel}
    className="h-10 px-4 rounded-lg border border-gray-300 dark:border-[#2a2a2a] 
    text-gray-600 dark:text-gray-400 text-sm font-medium 
    hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition"
  >
    Cancel
  </button>

  {/* Book */}
  <button
    type="submit"
    disabled={hasConflict || isSubmitting}
    className="h-10 px-4 rounded-lg bg-[#97704f] text-white text-sm font-medium 
    flex items-center gap-2 justify-center 
    hover:bg-[#7a5a3f] transition 
    disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Book Appointment
    <ArrowRight className="w-4 h-4" />
  </button>

</div>
            </form>
        </div>
      </div>
    </div>
  );
}
