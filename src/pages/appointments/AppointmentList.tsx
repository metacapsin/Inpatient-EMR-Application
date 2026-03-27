import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { appointmentAPI } from '../../services/api';
import { format } from 'date-fns';
import { FaCalendar, FaBolt, FaPlus } from 'react-icons/fa';
import IconSearch from '../../components/Icon/IconSearch';
import IconX from '../../components/Icon/IconX';
import NextVisitPrepCard from '../../components/NextVisitPrepCard';

interface Appointment {
  _id: string;
  patientName: string;
  patientId: string;
  providerName: string;
  serviceLocationName: string;
  roomNumber?: string;
  startDate: string;
  startTime?: string;
  visitReasonName: string;
  visitReasonmsg?: string;
  appointmentStatus: string;
  emailTo?: string;
  phoneNo?: string;
  dob?: string;
  sex?: string;
  endDate?: string;
  otherReason?: string;
}

const AppointmentList: React.FC = () => {
  const navigate = useNavigate();
  const [appointmentList, setAppointmentList] = useState<Appointment[]>([]);
  const [filteredData, setFilteredData] = useState<Appointment[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>('');

  // Widget data
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [next7DaysAppointments, setNext7DaysAppointments] = useState(0);
  const [last7DaysAppointments, setLast7DaysAppointments] = useState(0);
  const [activeProviders, setActiveProviders] = useState(0);
  const [activeLocations, setActiveLocations] = useState(0);

  // Dialog states
  const [showQuickView, setShowQuickView] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string, timeString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const dateStr = format(date, 'MM/dd/yyyy');
      if (timeString) {
        return `${dateStr} ${timeString}`;
      }
      return dateStr;
    } catch {
      return dateString;
    }
  };

  // Fetch appointments
  useEffect(() => {
    fetchAppointments();
    fetchDashboardStats();
  }, []);

  // Filter data when search changes
  useEffect(() => {
    if (!searchValue || searchValue.trim() === '') {
      setFilteredData([...appointmentList]);
    } else {
      const filtered = appointmentList.filter((appt) =>
        appt.patientName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        appt.providerName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        appt.serviceLocationName?.toLowerCase().includes(searchValue.toLowerCase()) ||
        appt.visitReasonName?.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [appointmentList, searchValue]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const userDetails = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const userId = userDetails.patientId || userDetails.rcopiaID;
      setPatientId(userId);
      const response = await appointmentAPI.getAppointments(userId);
      
      if (response.data?.data) {
        const appointments = response.data.data.map((appt: any) => ({
          ...appt,
          startDate: formatDateTime(appt.startDate, appt.startTime),
        }));
        setAppointmentList(appointments);
        setFilteredData(appointments);
      } else {
        setAppointmentList([]);
        setFilteredData([]);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Failed to load appointments';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next7Days = new Date(today);
      next7Days.setDate(next7Days.getDate() + 7);
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);

      const todayCount = appointmentList.filter((appt) => {
        const apptDate = new Date(appt.startDate);
        return apptDate.toDateString() === today.toDateString();
      }).length;

      const next7Count = appointmentList.filter((appt) => {
        const apptDate = new Date(appt.startDate);
        return apptDate >= today && apptDate <= next7Days;
      }).length;

      const last7Count = appointmentList.filter((appt) => {
        const apptDate = new Date(appt.startDate);
        return apptDate >= last7Days && apptDate < today;
      }).length;

      const uniqueProviders = new Set(appointmentList.map((appt) => appt.providerName)).size;
      const uniqueLocations = new Set(appointmentList.map((appt) => appt.serviceLocationName)).size;

      setTodayAppointments(todayCount);
      setNext7DaysAppointments(next7Count);
      setLast7DaysAppointments(last7Count);
      setActiveProviders(uniqueProviders);
      setActiveLocations(uniqueLocations);
    } catch (error) {
      console.error('Failed to load dashboard stats', error);
    }
  };

  useEffect(() => {
    if (appointmentList.length > 0) {
      fetchDashboardStats();
    }
  }, [appointmentList]);

  const handleQuickView = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowQuickView(true);
  };

  const getAge = (dob?: string) => {
    if (!dob) return '';
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return '';
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return 'Not Provided';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed')) {
      return 'bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-200';
    } else if (statusLower.includes('cancelled') || statusLower.includes('no show')) {
      return 'bg-primary-200/80 dark:bg-primary-900 text-primary-800 dark:text-primary-100';
    } else if (statusLower.includes('checked in') || statusLower.includes('in progress')) {
      return 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200';
    } else {
      return 'bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300';
    }
  };

  // Error boundary
  if (error && !loading) {
    return (
      <div>
        <div className="panel">
          <div className="text-center py-8">
            <p className="text-danger mb-4">{error}</p>
            <button onClick={fetchAppointments} className="btn btn-outline-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    
      <div className="panel">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <a href="/app/appointments" className="text-primary hover:underline">Appointments</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Appointments</li>
          </ul>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="panel bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                <FaCalendar className="text-primary-600 dark:text-primary-300 text-lg sm:text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">{todayAppointments}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Today's Appointments</p>
              </div>
            </div>
          </div>

          <div className="panel bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                <FaCalendar className="text-primary-600 dark:text-primary-300 text-lg sm:text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">{next7DaysAppointments}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Next 7 Days</p>
              </div>
            </div>
          </div>

          <div className="panel bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-200 dark:bg-primary-800 flex items-center justify-center shrink-0">
                <FaCalendar className="text-primary-700 dark:text-primary-200 text-lg sm:text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">{last7DaysAppointments}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Last 7 Days</p>
              </div>
            </div>
          </div>

          <div className="panel bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                <FaCalendar className="text-primary-600 dark:text-primary-300 text-lg sm:text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">{activeProviders}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Active Providers</p>
              </div>
            </div>
          </div>

          <div className="panel bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                <FaCalendar className="text-primary-600 dark:text-primary-300 text-lg sm:text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">{activeLocations}</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Active Locations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Next Visit Preparation AI Card */}
        {patientId && <NextVisitPrepCard patientId={patientId} />}

        {/* Main Table Card */}
        <div className="mt-4">
          {/* Table Header */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                Appointment List
                {searchValue && (
                  <span className="text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400 ml-1 sm:ml-2 block sm:inline">
                    (Showing {filteredData.length} of {appointmentList.length})
                  </span>
                )}
              </h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <div className="relative flex-1 w-full sm:min-w-[200px]">
                  <input
                    type="text"
                    className="form-input pl-10 w-full"
                    placeholder="Search Patient Name"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <IconSearch className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    className="btn btn-outline-primary w-full sm:w-auto justify-center text-sm"
                    onClick={() => navigate('/app/appointments/calendar')}
                  >
                    <FaCalendar className="mr-2" />
                    <span className="hidden sm:inline">Calendar View</span>
                    <span className="sm:hidden">Calendar</span>
                  </button>
                  <button
                    className="btn btn-primary w-full sm:w-auto justify-center text-sm"
                    onClick={() => navigate('/app/appointments/add')}
                  >
                    <FaPlus className="mr-2" />
                    Add Appointment
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card View */}
          <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-8">No Appointment found.</div>
              ) : (
                filteredData.map((appointment) => (
                  <div
  key={appointment._id}
  className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl p-4 shadow-sm relative"
>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm sm:text-base shrink-0">
                          {appointment.patientName?.charAt(0) || 'P'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <button
                              className="text-primary hover:underline font-semibold cursor-pointer text-left truncate"
                              onClick={() => navigate(`/app/facesheet?patientId=${appointment.patientId}`)}
                            >
                              {appointment.patientName}
                            </button>
                            <span className={`badge ${getStatusBadgeClass(appointment.appointmentStatus)} text-xs shrink-0 self-start sm:self-auto`}>
                              {appointment.appointmentStatus}
                            </span>
                          </div>
                          {appointment.emailTo && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{appointment.emailTo}</p>
                          )}
                          {appointment.dob && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              DOB: {formatDate(appointment.dob)} ({getAge(appointment.dob)} y/o{' '}
                              {appointment.sex === 'M' ? 'Male' : appointment.sex === 'F' ? 'Female' : 'Other'})
                            </p>
                          )}
                          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
  <p>{appointment.startDate}</p>
  <p>{appointment.visitReasonName || 'N/A'}</p>
  <p>{appointment.serviceLocationName || 'N/A'}</p>
  <p>{appointment.providerName}</p>
</div>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
  <button
    className="w-8 h-8 rounded-full bg-[#97704f] text-white flex items-center justify-center shadow-sm active:scale-95"
    onClick={() => handleQuickView(appointment)}
  >
    <FaBolt />
  </button>
</div>
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>

        {/* Quick View Modal */}
        {showQuickView && selectedAppointment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="panel max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Appointment Quick View</h3>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 shrink-0"
                  onClick={() => setShowQuickView(false)}
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-lg sm:text-xl mx-auto mb-2">
                    {selectedAppointment.patientName?.charAt(0) || 'P'}
                  </div>
                  <h4 className="text-primary font-semibold text-sm sm:text-base break-words">{selectedAppointment.patientName}</h4>
                </div>
                <div className="border-t border-white-light dark:border-[#191e3a] pt-4">
                  <h5 className="font-semibold mb-2 text-sm sm:text-base text-gray-900 dark:text-white">Contact Information</h5>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                    📞 {formatPhone(selectedAppointment.phoneNo)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                    ✉️ {selectedAppointment.emailTo || 'Not Provided'}
                  </p>
                </div>
                <div className="border-t border-white-light dark:border-[#191e3a] pt-4">
                  <h5 className="font-semibold mb-2 text-sm sm:text-base text-gray-900 dark:text-white">Appointment Details</h5>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                    Provider: {selectedAppointment.providerName}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                    Location: {selectedAppointment.serviceLocationName}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Room: {selectedAppointment.roomNumber || 'Not Allotted'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Date: {selectedAppointment.startDate}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                    Visit Type: {selectedAppointment.visitReasonName}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                    Visit Reason: {selectedAppointment.visitReasonmsg || 'N/A'}
                  </p>
                  {selectedAppointment.visitReasonmsg === 'Other' && selectedAppointment.otherReason && (
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 break-words">
                      Other Reason: {selectedAppointment.otherReason}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Status: <span className={`badge text-xs ${getStatusBadgeClass(selectedAppointment.appointmentStatus)}`}>
                      {selectedAppointment.appointmentStatus}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    
  );
};

export default AppointmentList;
