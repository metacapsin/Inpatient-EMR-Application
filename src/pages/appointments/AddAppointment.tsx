import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { appointmentAPI } from '../../services/api';
import { format, parse, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import BookAppointment from '../../components/appointments/BookAppointment';

// Types/Interfaces
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

const AddAppointment: React.FC = () => {
  const navigate = useNavigate();
  const { apptId, id } = useParams<{ apptId?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const editId = apptId || id;
  const isEditMode = !!editId;

  // Use modern Book Appointment UI for add flow
  if (!editId) {
    return <BookAppointment />;
  }
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AppointmentFormData>({
    Patient: null,
    Provider: null,
    VisitReason: null,
    visitReasonName: '',
    otherReason: '',
    RoomNumber: null,
    StartDate: format(new Date(), 'MM/dd/yyyy'),
    StartTime: '',
    Duration: '',
    ServiceLocation: null,
    AppointmentMode: 'inOffice',
    copayAmount: '',
    Note: '',
    Email: '',
    Phone: '',
    preferredContactMethod: '',
    isTelehealth: false
  });

  // Dropdown data
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [providerList, setProviderList] = useState<Provider[]>([]);
  const [visitReason, setVisitReason] = useState<VisitReason[]>([]);
  const [visitReasonsListDropdown, setVisitReasonsListDropdown] = useState<VisitReasonDropdown[]>([]);
  const [serviceLocationOptions, setServiceLocationOptions] = useState<ServiceLocation[]>([]);
  const [allServiceLocations, setAllServiceLocations] = useState<ServiceLocation[]>([]);
  const [RoomNumberOptions, setRoomNumberOptions] = useState<RoomNumber[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<string[]>([]);

  // UI state
  const [isAppointmentSubmit, setIsAppointmentSubmit] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCalendarIncrement, setSelectedCalendarIncrement] = useState<number>(15);
  const [providerScheduleData, setProviderScheduleData] = useState<any>(null);
  const [getAvailableSlotDetails, setGetAvailableSlotDetails] = useState<any>({});

  // Date restrictions
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  // Options
  const durationOptions = [
    { label: '5 minutes', value: 5 },
    { label: '10 minutes', value: 10 },
    { label: '15 minutes', value: 15 },
    { label: '20 minutes', value: 20 },
    { label: '30 minutes', value: 30 },
    { label: '45 minutes', value: 45 },
    { label: '60 minutes', value: 60 },
    { label: '90 minutes', value: 90 },
    { label: '120 minutes', value: 120 }
  ];

  const preferredContactMethodOptions = [
    { label: 'Email', value: 'Email' },
    { label: 'Phone', value: 'Phone' },
    { label: 'Patient Declined', value: 'Patient Declined' }
  ];

  // Refs for debouncing and latest form data (avoids stale payload on submit)
  const conflictCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const initialFetchDone = useRef(false);

  // Helper function to format date
  const formatDateForInput = (dateString: string): string => {
    try {
      const date = parse(dateString, 'MM/dd/yyyy', new Date());
      if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
      }
    } catch (e) {
      // Invalid date
    }
    return '';
  };

  const formatDateFromInput = (dateString: string): string => {
    try {
      const date = parse(dateString, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        return format(date, 'MM/dd/yyyy');
      }
    } catch (e) {
      // Invalid date
    }
    return dateString;
  };

  // Set date restrictions
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userDetails = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    
    // Get email from localStorage: patientEmail key, patientLoginResponse, or user object
    let emailFromStorage = '';
    try {
      emailFromStorage = localStorage.getItem('patientEmail')?.trim() ?? '';
      if (!emailFromStorage) {
        const patientLoginResponse = localStorage.getItem('patientLoginResponse');
        if (patientLoginResponse) {
          const data = JSON.parse(patientLoginResponse);
          emailFromStorage =
            data.patientEmail ??
            data.data?.patientEmail ??
            data.user?.email ??
            data.user?.emailAddress ??
            data.data?.user?.email ??
            data.data?.user?.emailAddress ??
            '';
        }
      }
      if (!emailFromStorage && userDetails) {
        emailFromStorage =
          (userDetails as any).email ??
          (userDetails as any).emailAddress ??
          (userDetails as any).patientEmail ??
          '';
      }
    } catch (_) {}

    // Set Patient and Email in one update so both appear on UI (single update avoids overwriting)
    if (userDetails) {
      setFormData(prev => ({
        ...prev,
        Patient: userDetails,
        ...(emailFromStorage ? { Email: emailFromStorage } : {}),
      }));
    } else if (emailFromStorage) {
      setFormData(prev => ({ ...prev, Email: emailFromStorage }));
    }
    
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(today.getFullYear() + 1);
    oneYearFromToday.setHours(23, 59, 59, 999);
    
    setMinDate(today);
    setMaxDate(oneYearFromToday);
  }, []);

  // Initialize on mount (ref guard avoids double API calls from React Strict Mode in dev)
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    getGeneralCalendarSetting();
    loadVisitReasonsForDropdown();
    getRoomNumber();
    
    if (!isEditMode) {
      getPatientListDropdownData();
    } else {
      getAppointmentById();
    }

    // Handle slot date from query params
    const slotDate = searchParams.get('slotDate');
    if (slotDate) {
      try {
        const date = new Date(slotDate);
        if (isValid(date)) {
          const formattedDate = format(date, 'MM/dd/yyyy');
          const formattedTime = format(date, 'hh:mm a');
          setFormData(prev => ({
            ...prev,
            StartDate: formattedDate,
            StartTime: formattedTime
          }));
        }
      } catch (e) {
        console.error('Error parsing slot date:', e);
      }
    }

    return () => {
      if (conflictCheckTimeout.current) {
        clearTimeout(conflictCheckTimeout.current);
      }
    };
  }, []);

  // API Calls
  const getGeneralCalendarSetting = async () => {
    try {
      const response = await appointmentAPI.getGeneralCalendarSetting();
      if (response.data.status === 'success') {
        const increment = response.data.data.calendarIncrement || 15;
        setSelectedCalendarIncrement(increment);
        setFormData(prev => ({ ...prev, Duration: increment }));
      }
    } catch (error) {
      console.error('Error fetching calendar settings:', error);
    }
  };

  const loadVisitReasonsForDropdown = async () => {
    const requiredVisitTypeName = 'MEDICARE Initial Wellness Exam';
    try {
      const response = await appointmentAPI.getVisitTypesList();
      const rawList = Array.isArray(response.data?.data) ? response.data.data : [];

      if (response.data?.status === 'success' && rawList.length > 0) {
        const seen = new Set<string>();
        const reasons: VisitReasonDropdown[] = rawList
          .map((visitType: any) => ({
            id: visitType?._id ?? visitType?.id ?? visitType?.VisitTypeId ?? visitType?.visitTypeId ?? String(Math.random()),
            reason: (visitType?.VisitTypeName ?? visitType?.visitTypeName ?? visitType?.visitReasonName ?? '').toString().trim(),
          }))
          .filter((x: VisitReasonDropdown) => {
            if (!x.reason) return false;
            const key = x.reason.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

        if (!seen.has(requiredVisitTypeName.toLowerCase())) {
          reasons.push({ id: 'medicare-initial-wellness-exam', reason: requiredVisitTypeName });
        }

        reasons.push({ id: 'other', reason: 'Other' });
        setVisitReasonsListDropdown(reasons);
        return;
      }

      // Non-success or unexpected payload: fall back to a safe local list.
      setVisitReasonsListDropdown([
        { id: 'medicare-initial-wellness-exam', reason: requiredVisitTypeName },
        { id: 'follow-up', reason: 'Follow-up' },
        { id: 'consultation', reason: 'Consultation' },
        { id: 'check-up', reason: 'Check-up' },
        { id: 'other', reason: 'Other' },
      ]);
    } catch (error) {
      console.error('Error loading visit reasons:', error);
      setVisitReasonsListDropdown([
        { id: 'medicare-initial-wellness-exam', reason: requiredVisitTypeName },
        { id: 'follow-up', reason: 'Follow-up' },
        { id: 'consultation', reason: 'Consultation' },
        { id: 'check-up', reason: 'Check-up' },
        { id: 'other', reason: 'Other' },
      ]);
    }
  };

  const getRoomNumber = async () => {
    try {
      const response = await appointmentAPI.getRoomList();
      if (response.data.status === 'success') {
        const rooms = response.data.data?.map((item: any) => ({
          roomNumber: item.roomNumber,
          id: item._id
        })) || [];
        setRoomNumberOptions(rooms);
      }
    } catch (error) {
      console.error('Error fetching room numbers:', error);
    }
  };

  const getPatientListDropdownData = async () => {
    try {
      const PatientListpayload = {
        listName: "patient-details",
        sortBy: "firstName",
      };

      const ProviderListpayload = {
        listName: "users",
        sortBy: "firstName",
      };

      const VisitReasonListPayload = {
        listName: "visit-reason",
        sortBy: "visitReasonName",
      };

      const ServiceLocationListPayload = {
        listName: "service-location",
        sortBy: "name",
      };

      // Fetch patients
      if (PatientListpayload) {
        const patientsResponse = await appointmentAPI.getDropdownListData(PatientListpayload);
        if (patientsResponse.data.status === 'success') {
          setPatientsList(patientsResponse.data.data || []);
        } else {
          setPatientsList([]);
        }
      }

      // Fetch providers
      if (ProviderListpayload) {
        const providersResponse = await appointmentAPI.getDropdownListData(ProviderListpayload);
        if (providersResponse.data.status === 'success') {
          const providers = providersResponse.data.data
            .filter((item: any) => item.status === true && item.role?.some((r: string) => r.toLowerCase() === 'provider'))
            .map((item: any) => ({
              name: (item?.prefix ? item?.prefix + ' ' : '') +
                item?.firstName + ' ' + item?.lastName +
                (item?.suffix ? ' ' + item?.suffix : ''),
              _id: item?._id,
            }));
          setProviderList(providers || []);
        } else {
          setProviderList([]);
        }
      }

      // Fetch visit reasons
      if (VisitReasonListPayload) {
        const visitReasonsResponse = await appointmentAPI.getDropdownListData(VisitReasonListPayload);
        if (visitReasonsResponse.data.status === 'success') {
          setVisitReason(visitReasonsResponse.data.data || []);
        } else {
          setVisitReason([]);
        }
      }

      // Fetch service locations
      if (ServiceLocationListPayload) {
        const serviceLocationsResponse = await appointmentAPI.getDropdownListData(ServiceLocationListPayload);
        if (serviceLocationsResponse.data.status === 'success') {
          const locations = serviceLocationsResponse.data.data.map((loc: any) => ({
            ...loc,
            displayName: loc.name || loc.displayName || ''
          }));
          setAllServiceLocations(locations);
          setServiceLocationOptions(locations);
        } else {
          setAllServiceLocations([]);
          setServiceLocationOptions([]);
        }
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      setPatientsList([]);
      setProviderList([]);
      setVisitReason([]);
      setAllServiceLocations([]);
      setServiceLocationOptions([]);
    }
  };

  const getAppointmentById = async () => {
    try {
      await getPatientListDropdownData();
      
      const response = await appointmentAPI.getAppointmentById(editId);
      if (response.data.status === 'success') {
        setIsEditing(true);
        const data = response.data.data;

        const loadedVisitReason = visitReason.find(x => x._id === data.visitReasonId);
        setFormData(prev => ({
          ...prev,
          StartDate: formatDateFromInput(data.startDate) || prev.StartDate,
          StartTime: data.startTime || prev.StartTime,
          Provider: providerList.find(x => x._id === data.providerId) || null,
          Patient: patientsList.find(x => x._id === data.patientId) || null,
          VisitReason: loadedVisitReason || null,
          visitReasonName: data.visitReasonmsg ?? data.visitReasonName ?? prev.visitReasonName,
          ServiceLocation: serviceLocationOptions.find(x => x._id === data.serviceLocationId) || null,
          Duration: data.duration || prev.Duration,
          copayAmount: data.copayAmount != null ? String(data.copayAmount) : prev.copayAmount,
          Note: data.note || prev.Note,
          Phone: formatPhoneNumberForForm(data.phoneNo) || prev.Phone,
          Email: data.emailTo || prev.Email,
          isTelehealth: data.isTelehealth || data.telehealth || false,
        }));

        setTimeout(() => {
          filterServiceLocationsByProvider();
          getProviderAvailableSlots();
        }, 300);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Error in getting appointment detail');
    }
  };

  // Form handlers
  const handleSelectPatient = (patient: Patient | null) => {
    setFormData(prev => ({ ...prev, Patient: patient }));
    
    if (patient) {
      const hasEmail = patient.emailAddress && patient.emailAddress.trim();
      const hasPhone = patient.homePhone && patient.homePhone.trim();
      
      let preferredMethod = 'Email';
      if (hasEmail) {
        preferredMethod = 'Email';
      } else if (hasPhone) {
        preferredMethod = 'Phone';
      }

      setFormData(prev => ({
        ...prev,
        Email: patient.emailAddress || '',
        Phone: formatPhoneNumberForForm(patient.homePhone || ''),
        preferredContactMethod: preferredMethod
      }));
    }
  };

  const handleProviderChange = (provider: Provider | null) => {
    setFormData(prev => ({ ...prev, Provider: provider }));
    checkAppointmentConflict();
  };

  const handleVisitReasonChange = (reason: string) => {
    setFormData(prev => ({ ...prev, visitReasonName: reason }));
    const showOther = reason === 'Other';
    setShowOtherReasonInput(showOther);
    
    if (!showOther) {
      setFormData(prev => ({ ...prev, otherReason: '' }));
    }
  };

  const formatPhoneNumberForForm = (phoneNumber: string): string => {
    if (!phoneNumber || phoneNumber.length !== 10) return phoneNumber;
    return `(${phoneNumber.substring(0, 3)}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6, 10)}`;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const rawValue = inputEl.value;
    const digits = rawValue.replace(/\D/g, '').substring(0, 10);
    
    let formatted = '';
    if (digits.length > 0) formatted = `(${digits.substring(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.substring(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.substring(6, 10)}`;

    setFormData(prev => ({ ...prev, Phone: formatted }));
  };

  const filterServiceLocationsByProvider = async () => {
    const selectedProvider = formData.Provider;
    
    if (!selectedProvider || !selectedProvider._id) {
      if (allServiceLocations.length > 0) {
        setServiceLocationOptions(allServiceLocations.map(location => ({
          ...location,
          displayName: location.name || location.displayName || ''
        })));
      }
      return;
    }

    try {
      const ServiceLocationListPayload = {
        listName: "service-location",
        sortBy: "name",
      };
      
      const serviceLocationsResponse = await appointmentAPI.getDropdownListData(ServiceLocationListPayload);

      if (serviceLocationsResponse.data?.status === 'success') {
        const locations = serviceLocationsResponse.data.data.map((loc: any) => ({
          ...loc,
          displayName: loc.name || loc.displayName || ''
        }));
        
        setServiceLocationOptions(locations);

        if (formData.ServiceLocation && !locations.find((loc: any) => loc._id === formData.ServiceLocation?._id)) {
          setFormData(prev => ({ ...prev, ServiceLocation: null }));
        }
      }
    } catch (error) {
      console.error('Error filtering service locations:', error);
      setServiceLocationOptions(allServiceLocations);
    }
  };

  const checkAppointmentConflict = useCallback(() => {
    filterServiceLocationsByProvider();
    
    if (conflictCheckTimeout.current) {
      clearTimeout(conflictCheckTimeout.current);
    }

    conflictCheckTimeout.current = setTimeout(() => {
      performConflictCheck();
    }, 300);
  }, [formData]);

  const performConflictCheck = async () => {
    // Use ref so conflict API always gets the current selected time (avoids previous value in payload)
    const latest = formDataRef.current;
    getProviderAvailableSlots();

    if (!latest.Provider || !latest.Duration || !latest.StartDate ||
        !latest.StartTime || !latest.ServiceLocation) {
      setConflictMessage('');
      setHasConflict(false);
      return;
    }

    const payload = {
      serviceLocationId: latest.ServiceLocation._id,
      providerId: latest.Provider._id,
      duration: latest.Duration,
      startTime: latest.StartTime,
      startDate: latest.StartDate,
    };

    try {
      const response = await appointmentAPI.checkConflict(payload);

      if (response.data.status !== 'success') {
        if (!hasConflict) {
          setConflictMessage('');
          setHasConflict(false);
        }
        return;
      }

      const conflicts: string[] = [];

      if (getAvailableSlotDetails?.status === 'error' &&
          (getAvailableSlotDetails?.message === 'No working hours found for the specified day.' ||
           getAvailableSlotDetails?.message === 'No working hours defined for the specified day.')) {
        const date = parse(latest.StartDate, 'MM/dd/yyyy', new Date());
        conflicts.push(
          `No working hours found for ${latest.Provider.name} on ${isValid(date) ? format(date, 'MMM dd, yyyy') : latest.StartDate}`
        );
      }

      if (response.data.data.onHoliday) {
        const date = parse(latest.StartDate, 'MM/dd/yyyy', new Date());
        conflicts.push(
          `Provider ${latest.Provider.name} is on holiday on ${isValid(date) ? format(date, 'MMM dd, yyyy') : latest.StartDate}`
        );
      }

      if (response.data.data.appointments) {
        conflicts.push(`The selected time slot ${latest.StartTime} conflicts with another appointment`);
      }

      if (response.data.data.onBreak) {
        conflicts.push(`Provider ${latest.Provider.name} is scheduled for a break at this time`);
      }

      if (response.data.data.onTimeOff) {
        conflicts.push(`Provider ${latest.Provider.name} is on time off during this time slot`);
      }

      if (!response.data.data.onServiceLocation) {
        conflicts.push(`Provider ${latest.Provider.name} is not available at ${latest.ServiceLocation.name}`);
      }

      if (response.data.data.outsideOfficeHours) {
        conflicts.push('The selected time is outside office hours');
      }

      setConflictMessage(conflicts.join('. '));
      setHasConflict(conflicts.length > 0);
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setConflictMessage('Unable to verify appointment availability. Please try again.');
      setHasConflict(true);
    }
  };

  const getProviderAvailableSlots = async () => {
    if (!formData.Provider || !formData.StartDate) {
      return;
    }

    const startDate = parse(formData.StartDate, 'MM/dd/yyyy', new Date());
    if (!isValid(startDate)) {
      console.error('Invalid date format.');
      return;
    }

    const weekday = format(startDate, 'EEEE').toLowerCase();

    const payload = {
      userId: formData.Provider._id,
      day: weekday,
      date: formData.StartDate,
    };

    try {
      const response = await appointmentAPI.getProviderAvailableSlots(payload);
      
      if (response.data) {
        setGetAvailableSlotDetails(response.data);
        setAppointmentSlots(response.data.data || []);

        const conflicts: string[] = [];

        if (response.data.status === 'error') {
          if (response.data.message === 'No working hours found for the specified day.' ||
              response.data.message === 'No working hours defined for the specified day.') {
            const date = parse(formData.StartDate, 'MM/dd/yyyy', new Date());
            conflicts.push(
              `No working hours found for ${formData.Provider.name} on ${isValid(date) ? format(date, 'MMM dd, yyyy') : formData.StartDate}`
            );
            setHasConflict(true);
            setConflictMessage(conflicts.join('. '));
          }
        } else if (response.data.onHoliday) {
          const date = parse(formData.StartDate, 'MM/dd/yyyy', new Date());
          conflicts.push(
            `Provider ${formData.Provider.name} is on holiday on ${isValid(date) ? format(date, 'MMM dd, yyyy') : formData.StartDate}`
          );
          setHasConflict(true);
          setConflictMessage(conflicts.join('. '));
        } else if (response.data.status === 'success' && response.data.message?.includes("You can't book past time slots for today")) {
          let pastSlotsMessage = response.data.message;
          if (response.data.nextAvailableTime && response.data.nextAvailableDate) {
            const nextDate = parse(response.data.nextAvailableDate, 'MM/dd/yyyy', new Date());
            pastSlotsMessage = `${response.data.message} Next available slot is ${response.data.nextAvailableTime} on ${isValid(nextDate) ? format(nextDate, 'MM/dd/yyyy') : response.data.nextAvailableDate}`;
          }
          setHasConflict(true);
          setConflictMessage(pastSlotsMessage);
          setAppointmentSlots([]);
        } else if (response.data.status === 'success' && response.data.message === 'No available time slots' && 
                   (!response.data.data || response.data.data.length === 0)) {
          const date = parse(formData.StartDate, 'MM/dd/yyyy', new Date());
          const noSlotsMessage = `${response.data.message || 'No available time slots'} for ${formData.Provider.name} on ${isValid(date) ? format(date, 'MMM dd, yyyy') : formData.StartDate}`;
          setHasConflict(true);
          setConflictMessage(noSlotsMessage);
          setAppointmentSlots([]);
        } else {
          if (conflictMessage && 
              !conflictMessage.includes('conflicts with another appointment') &&
              !conflictMessage.includes('is on time off during this time slot') &&
              !conflictMessage.includes('is scheduled for a break at this time') &&
              !conflictMessage.includes('is outside office hours')) {
            setHasConflict(false);
            setConflictMessage('');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

  // Validation - accepts optional data so submit uses latest form state (avoids stale closure)
  const validateForm = (data?: AppointmentFormData): boolean => {
    const d = data ?? formData;
    const newErrors: Record<string, string> = {};

    // Patient - validation commented as field is hidden
    // if (!d.Patient) {
    //   newErrors.Patient = 'This is required.';
    // }

    if (!d.Provider) {
      newErrors.Provider = 'This is required.';
    }

    if (!d.VisitReason) {
      newErrors.VisitReason = 'This is required.';
    }

    if (!d.visitReasonName) {
      newErrors.visitReasonName = 'This Field is required.';
    } else if (d.visitReasonName.length < 3) {
      newErrors.visitReasonName = 'Minimum 3 characters required.';
    } else if (d.visitReasonName.length > 100) {
      newErrors.visitReasonName = 'Maximum 100 characters allowed.';
    }

    if (showOtherReasonInput) {
      if (!d.otherReason) {
        newErrors.otherReason = 'This is required.';
      } else if (d.otherReason.length < 3) {
        newErrors.otherReason = 'Minimum 3 characters required.';
      } else if (d.otherReason.length > 100) {
        newErrors.otherReason = 'Maximum 100 characters allowed.';
      } else if (!/^[a-zA-Z0-9\s.,'-]+$/.test(d.otherReason)) {
        newErrors.otherReason = 'Only letters, numbers, spaces, and basic punctuation are allowed.';
      }
    }

    if (d.Provider && !d.ServiceLocation) {
      newErrors.ServiceLocation = 'This Field is required.';
    }

    if (d.Provider && !d.StartDate) {
      newErrors.StartDate = 'This is required.';
    }

    if (d.Provider && !d.StartTime) {
      newErrors.StartTime = 'This is required.';
    }

    if (d.Provider && !d.Duration) {
      newErrors.Duration = 'This is required.';
    } else if (d.Duration) {
      const durationNum = Number(d.Duration);
      if (durationNum < 1) {
        newErrors.Duration = 'Duration must be at least 1 minute.';
      } else if (durationNum > 120) {
        newErrors.Duration = 'Duration cannot exceed 120 minutes.';
      }
    }

    // Preferred Contact Method, Email, Phone - validation commented as fields are hidden
    // if (!d.preferredContactMethod) {
    //   newErrors.preferredContactMethod = 'This is required.';
    // }
    // if (d.Email && d.Email.trim()) {
    //   const emailPattern = /^(?!\s)([a-z0-9]+([._%+-]?[a-z0-9]+)*)@[a-z0-9.-]+\.[a-z]{2,}$/i;
    //   if (!emailPattern.test(d.Email)) {
    //     newErrors.Email = 'Please enter a valid email address. No leading/trailing spaces are allowed.';
    //   }
    // }
    // if (d.preferredContactMethod === 'Email' && (!d.Email || !d.Email.trim())) {
    //   newErrors.Email = 'Please provide an email address for email contact.';
    // }
    // if (d.Phone && d.Phone.trim()) {
    //   const phonePattern = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
    //   if (!phonePattern.test(d.Phone)) {
    //     newErrors.Phone = 'Enter a valid phone number';
    //   }
    // }
    // if (d.preferredContactMethod === 'Phone' && (!d.Phone || !d.Phone.trim())) {
    //   newErrors.Phone = 'Please provide a phone number for phone contact.';
    // }

    if (d.Note && d.Note.trim()) {
      if (d.Note.length < 5) {
        newErrors.Note = 'Minimum 5 characters required.';
      } else if (d.Note.length > 500) {
        newErrors.Note = 'Maximum 500 characters allowed.';
      } else if (!/^(?! )(?!.* {2})[A-Za-z0-9\W_ ]+(?<! )$/.test(d.Note)) {
        newErrors.Note = 'Notes is invalid.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Contact method validation skipped when Email/Phone/Preferred Contact fields are hidden
  const validateContactMethod = (data?: AppointmentFormData): boolean => {
    // const d = data ?? formData;
    // const contactMethod = d.preferredContactMethod;
    // const email = d.Email?.trim();
    // const phone = d.Phone?.trim();
    // if (contactMethod === 'Email' && !email) {
    //   toast.error('Please enter an email address for Email contact method.');
    //   return false;
    // }
    // if (contactMethod === 'Phone' && !phone) {
    //   toast.error('Please enter a phone number for Phone contact method.');
    //   return false;
    // }
    return true;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAppointmentSubmit(true);

    // Use ref so validation and payload use current form state (avoids stale values on submit)
    const latest = formDataRef.current;

    if (!validateContactMethod(latest) || !validateForm(latest)) {
      return;
    }
    let phoneNumber = latest.Phone || '';
    phoneNumber = phoneNumber.replace(/\D/g, '');

    const request = {
      patientId: latest.Patient?.patientId || latest.Patient?._id,
      patientName: latest.Patient?.patientName || latest.Patient?.fullName,
      dob: latest.Patient?.dOB,
      sex: latest.Patient?.sex,
      providerId: latest.Provider?._id,
      providerName: latest.Provider?.name,
      // Visit Types dropdown (visit-reason API) → id, name, color
      visitReasonId: latest.VisitReason?._id,
      visitReasonName: latest.VisitReason?.visitReasonName ?? '',
      visitReasonColorInCalender: latest.VisitReason?.visitReasonColorInCalender,
      // Visit Reason dropdown (VisitType API – VisitTypeName) → message/reason text
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
      if (!isEditMode) {
        const response = await appointmentAPI.createAppointment(request);
        const { status, message } = response.data || {};
        if (status === 'success') {
          toast.success(message || 'Appointment added successfully');
          setTimeout(() => {
            navigate('/app/appointments');
          }, 1000);
        } else {
          toast.error(message || 'Failed to create appointment');
        }
      } else {
        await updateAppointment(request);
      }
    } catch (error: any) {
      console.error('Error creating/updating appointment:', error);
      toast.error(error?.response?.data?.message || 'An error occurred. Please try again.');
    }
  };

  const updateAppointment = async (request: any) => {
    try {
      const response = await appointmentAPI.updateAppointment(editId, { ...request, id: editId });
      if (response.data.status === 'success') {
        toast.success('Appointment updated successfully.');
        setTimeout(() => {
          navigate('/app/appointments');
        }, 1500);
      } else {
        toast.error(response.data.message || 'Failed to update appointment');
      }
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      toast.error(error?.response?.data?.message || 'Something went wrong');
    }
  };

  const handleCancel = () => {
    navigate('/app/appointments');
  };

  const notesTextLength = formData.Note?.length || 0;

  return (
    <div>
      <div className="panel">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <button
                type="button"
                onClick={() => navigate('/app/appointments')}
                className="text-primary hover:underline"
              >
                Appointment
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Book Appointment</li>
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <h4 className="text-lg font-semibold">{!isEditing ? 'Create Appointment' : 'Edit Appointment'}</h4>
            {hasConflict && conflictMessage && (
              <div
                className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-danger bg-danger/10 dark:bg-danger/20 px-4 py-3 text-center text-danger"
                role="alert"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{conflictMessage}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Patient - commented out, not deleted */}
            {/* <div className="form-group">
              <label htmlFor="patient">
                Patient <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-input ${errors.Patient && isAppointmentSubmit ? 'border-danger' : ''}`}
                value={formData.Patient?.patientName || formData.Patient?.fullName || ''}
                placeholder="Patient Name"
                readOnly
              />
              {errors.Patient && <div className="text-danger text-sm mt-1">{errors.Patient}</div>}
            </div> */}

            {/* Provider */}
            <div className="form-group">
              <label htmlFor="provider">
                Provider <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${errors.Provider && isAppointmentSubmit ? 'border-danger' : ''}`}
                value={formData.Provider?._id || ''}
                onChange={(e) => {
                  const provider = providerList.find(p => p._id === e.target.value);
                  handleProviderChange(provider || null);
                }}
              >
                <option value="">Select Provider</option>
                {providerList.map(provider => (
                  <option key={provider._id} value={provider._id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              {errors.Provider && <div className="text-danger text-sm mt-1">{errors.Provider}</div>}
            </div>

            {/* Visit Types - after Provider, API ready */}
            <div className="form-group">
              <label htmlFor="visitTypes">
                Visit Types <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${errors.VisitReason && isAppointmentSubmit ? 'border-danger' : ''}`}
                value={formData.VisitReason?._id || ''}
                onChange={(e) => {
                  const visitReasonItem = visitReason.find(v => v._id === e.target.value);
                  setFormData(prev => ({ ...prev, VisitReason: visitReasonItem || null }));
                }}
              >
                <option value="">Select Visit Type</option>
                {visitReason.map(vr => (
                  <option key={vr._id} value={vr._id}>
                    {vr.visitReasonName}
                  </option>
                ))}
              </select>
              {errors.VisitReason && <div className="text-danger text-sm mt-1">{errors.VisitReason}</div>}
            </div>

            {/* Visit Reason */}
            <div className="form-group">
              <label htmlFor="visitReason">
                Visit Reason <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${errors.visitReasonName && isAppointmentSubmit ? 'border-danger' : ''}`}
                value={formData.visitReasonName}
                onChange={(e) => handleVisitReasonChange(e.target.value)}
              >
                <option value="">Select Visit Reason</option>
                {visitReasonsListDropdown.map(vr => (
                  <option key={vr.id} value={vr.reason}>
                    {vr.reason}
                  </option>
                ))}
              </select>
              {errors.visitReasonName && <div className="text-danger text-sm mt-1">{errors.visitReasonName}</div>}
            </div>

            

            {/* Other Reason Input (conditional) */}
            {showOtherReasonInput && (
              <div className="form-group">
                <label htmlFor="otherReason">
                  Other Reason <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${errors.otherReason ? 'border-danger' : ''}`}
                  value={formData.otherReason}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherReason: e.target.value }))}
                  placeholder="Enter other reason"
                  maxLength={100}
                />
                {errors.otherReason && <div className="text-danger text-sm mt-1">{errors.otherReason}</div>}
              </div>
            )}

            {/* Email - commented out, not deleted */}
            {/* {formData.Patient && (
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  className={`form-input ${errors.Email && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.Email}
                  onChange={(e) => setFormData(prev => ({ ...prev, Email: e.target.value }))}
                  placeholder="Email"
                />
                {errors.Email && <div className="text-danger text-sm mt-1">{errors.Email}</div>}
              </div>
            )} */}

            {/* Phone Number - commented out, not deleted */}
            {/* {formData.Patient && (
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="text"
                  className={`form-input ${errors.Phone && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.Phone}
                  onChange={handlePhoneNumberChange}
                  placeholder="(XXX) XXX-XXXX"
                  maxLength={14}
                />
                {errors.Phone && <div className="text-danger text-sm mt-1">{errors.Phone}</div>}
              </div>
            )} */}

            {/* Service Location (conditional) */}
            {formData.Provider && (
              <div className="form-group">
                <label htmlFor="serviceLocation">
                  Service Location <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.ServiceLocation && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.ServiceLocation?._id || ''}
                  onChange={(e) => {
                    const location = serviceLocationOptions.find(l => l._id === e.target.value);
                    setFormData(prev => ({ ...prev, ServiceLocation: location || null }));
                    checkAppointmentConflict();
                  }}
                >
                  <option value="">Select Service Location</option>
                  {serviceLocationOptions.map(loc => (
                    <option key={loc._id} value={loc._id}>
                      {loc.displayName}
                    </option>
                  ))}
                </select>
                {errors.ServiceLocation && <div className="text-danger text-sm mt-1">{errors.ServiceLocation}</div>}
              </div>
            )}

            {/* Room Number - commented out, not deleted */}
            {/* {formData.Provider && (
              <div className="form-group">
                <label htmlFor="roomNumber">Room Number</label>
                <select
                  className="form-select"
                  value={formData.RoomNumber?.id || ''}
                  onChange={(e) => {
                    const room = RoomNumberOptions.find(r => r.id === e.target.value);
                    setFormData(prev => ({ ...prev, RoomNumber: room || null }));
                  }}
                >
                  <option value="">Select Room Number</option>
                  {RoomNumberOptions.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            )} */}

            {/* Date (conditional) */}
            {formData.Provider && (
              <div className="form-group">
                <label htmlFor="date">
                  Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className={`form-input ${errors.StartDate && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formatDateForInput(formData.StartDate)}
                  onChange={(e) => {
                    const date = formatDateFromInput(e.target.value);
                    setFormData(prev => ({ ...prev, StartDate: date }));
                    checkAppointmentConflict();
                  }}
                  min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
                  max={maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined}
                />
                {errors.StartDate && <div className="text-danger text-sm mt-1">{errors.StartDate}</div>}
              </div>
            )}

            {/* Time (conditional) */}
            {formData.Provider && (
              <div className="form-group">
                <label htmlFor="time">
                  Time <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.StartTime && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.StartTime}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, StartTime: e.target.value }));
                    checkAppointmentConflict();
                  }}
                >
                  <option value="">Select Time</option>
                  {appointmentSlots.map((slot, index) => (
                    <option key={index} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                {errors.StartTime && <div className="text-danger text-sm mt-1">{errors.StartTime}</div>}
              </div>
            )}

            {/* Duration (conditional) */}
            {formData.Provider && (
              <div className="form-group">
                <label htmlFor="duration">
                  Duration (in mins) <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.Duration && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.Duration}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, Duration: Number(e.target.value) }));
                    checkAppointmentConflict();
                  }}
                >
                  <option value="">Select Duration</option>
                  {durationOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.Duration && <div className="text-danger text-sm mt-1">{errors.Duration}</div>}
              </div>
            )}

            {/* Preferred Contact Method - commented out, not deleted */}
            {/* {formData.Patient && (
              <div className="form-group">
                <label htmlFor="preferredContactMethod">
                  Preferred Contact Method <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.preferredContactMethod && isAppointmentSubmit ? 'border-danger' : ''}`}
                  value={formData.preferredContactMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredContactMethod: e.target.value }))}
                >
                  <option value="">Select Contact Method</option>
                  {preferredContactMethodOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.preferredContactMethod && <div className="text-danger text-sm mt-1">{errors.preferredContactMethod}</div>}
              </div>
            )} */}

            {/* Visit Type Radio Buttons */}
            <div className="form-group">
              <label className="block mb-2">
                Visit Type <span className="text-danger">*</span>
              </label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="visitType"
                    className="form-radio"
                    checked={!formData.isTelehealth}
                    onChange={() => setFormData(prev => ({ ...prev, isTelehealth: false }))}
                  />
                  <span className="ml-2">Office Visit</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="visitType"
                    className="form-radio"
                    checked={formData.isTelehealth}
                    onChange={() => setFormData(prev => ({ ...prev, isTelehealth: true }))}
                  />
                  <span className="ml-2">Telehealth virtual visit</span>
                </label>
              </div>
            </div>
          </div>

          {/* Co-Pay - commented out, not deleted */}
          {/* <div className="form-group mt-4">
            <label htmlFor="copayAmount">Co-Pay</label>
            <input
              type="text"
              inputMode="numeric"
              id="copayAmount"
              name="copayAmount"
              className="form-input"
              placeholder="Enter co-pay amount"
              value={formData.copayAmount}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setFormData(prev => ({ ...prev, copayAmount: raw }));
              }}
            />
          </div> */}

          {/* Notes */}
          <div className="form-group mt-4">
            <label htmlFor="notes">Notes</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.Note}
              onChange={(e) => setFormData(prev => ({ ...prev, Note: e.target.value }))}
              maxLength={500}
            />
            <div className="text-right mt-1">
              <small className="text-gray-500 dark:text-gray-400">{500 - notesTextLength} characters remaining</small>
            </div>
            {errors.Note && <div className="text-danger text-sm mt-1">{errors.Note}</div>}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={hasConflict}
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAppointment;
