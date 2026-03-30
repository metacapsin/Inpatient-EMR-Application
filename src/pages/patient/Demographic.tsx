import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { patientDataAPI } from '../../services/api';
import { usePatientId } from '../../hooks/usePatientId';
import { format } from 'date-fns';
import { FaUser, FaCalendarCheck, FaHistory, FaShieldAlt } from 'react-icons/fa';

interface DemographicData {
  demographics?: any;
  additionalInformation?: any;
  pastAppointments?: any[];
  futureAppointments?: any[];
  insuranceDetails?: any;
  secondaryInsuranceDetails?: any;
}

function getLegacyPatientId(): string {
  const currentUser = localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {};
  return currentUser.patientId || currentUser.rcopiaID || '';
}

const Demographic: React.FC = () => {
  const [demographicData, setDemographicData] = useState<DemographicData>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const routePatientId = usePatientId();

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const getPatientDemographics = useCallback(async () => {
    const patientId = routePatientId || getLegacyPatientId();
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getPatientDemographics(patientId);
      if (response.data?.data) {
        const data = response.data.data;
        setDemographicData({
          demographics: data.demographics || {},
          additionalInformation: data.additionalInformation || {},
          pastAppointments: data.pastAppointments || [],
          futureAppointments: data.futureAppointments || [],
        
          insuranceDetails: {
            ...data.demographics?.insurance,
            insuranceType:
              data.demographics?.insurance?.insuranceType ||
              data.demographics?.insurance?.insuranceCompany ||
              'Primary',
          },
        
          secondaryInsuranceDetails: {
            ...data.demographics?.secondaryInsurance,
            insuranceType:
              data.demographics?.secondaryInsurance?.insuranceType ||
              data.demographics?.secondaryInsurance?.insuranceCompany ||
              null,
          },
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch demographic data');
    } finally {
      setLoading(false);
    }
  }, [routePatientId]);

  useEffect(() => {
    getPatientDemographics();
  }, [getPatientDemographics]);

  const getStatusMessage = (status: string, isPast: boolean = false): string => {
    if (isPast) {
      const statusMessages: Record<string, string> = {
        'Completed': 'Completed the patient visit at',
        'Confirmation Pending': 'has confirmation pending appointment for patient visit at',
        'Confirmed': 'Completed the patient visit at',
        'Cancelled': 'Cancelled appointment at',
        'No Show': 'Missed appointment at',
        'No Confirmation': 'Had a patient visit at',
        'Rescheduled': 'Rescheduled appointment at',
        'Checked In': 'Completed the patient visit at',
        'Room Allotted': 'Completed the patient visit at',
        'Reminder Sent': 'Had a patient visit at',
      };
      return statusMessages[status] || 'Had a patient visit at';
    } else {
      const statusMessages: Record<string, string> = {
        'Confirmation Pending': 'has confirmation pending appointment for patient visit at',
        'Confirmed': 'Confirmed appointment at',
        'Reminder Sent': 'Scheduled for patient visit at',
        'Checked In': 'Patient checked in at',
        'Room Allotted': 'Room allotted for patient visit at',
        'Rescheduled': 'Rescheduled appointment at',
        'No Confirmation': 'Scheduled for patient visit at',
      };
      return statusMessages[status] || 'Scheduled for patient visit at';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading demographic data...</p>
        </div>
      </div>
    );
  }

  const demographics = demographicData.demographics || {};
  const { address1, address2, city, state, zipCode } = demographics.mailingAddress || {};
  const mailingAddress = [address1, address2, city, state, zipCode]
    .filter(Boolean)
    .join(', ');

  const homeAddress = [
    demographics.address1,
    demographics.address2,
    demographics.city,
    demographics.state,
    demographics.zip
  ]
    .filter(Boolean)
    .join(', ');

  const fullName = demographics.fullName || 
    `${demographics.firstName || ''} ${demographics.middleName || ''} ${demographics.lastName || ''}`.trim();

  const formattedName = [
    demographics.prefix,
    fullName,
    demographics.suffix
  ]
    .filter(Boolean)
    .join(' ');

  const sexDisplay = demographics.sex?.toLowerCase() === 'f' 
    ? 'Female' 
    : demographics.sex?.toLowerCase() === 'm' 
    ? 'Male' 
    : 'Unknown';

  return (
    <div>
      <div className="panel h-[calc(100vh-120px)] overflow-y-auto">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li>
              <Link to="/app/patients/list" className="text-primary hover:underline">
                Patient List
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Demographic</li>
          </ul>
        </div>

        {/* Tabs */}
        <div className="mb-5">
  <ul className="flex overflow-x-auto whitespace-nowrap border-b border-white-light dark:border-[#191e3a] scrollbar-hide">

    {/* Profile */}
    <li>
      <button
        type="button"
        onClick={() => setActiveTab('profile')}
        className={`${
          activeTab === 'profile' ? '!border-primary text-primary' : ''
        } flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary shrink-0`}
      >
        <FaUser className="w-4 h-4" />
        Profile
      </button>
    </li>

    {/* Upcoming */}
    <li>
      <button
        type="button"
        onClick={() => setActiveTab('upcoming')}
        className={`${
          activeTab === 'upcoming' ? '!border-primary text-primary' : ''
        } flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary shrink-0`}
      >
        <FaCalendarCheck className="w-4 h-4" />
        Upcoming Appointments
      </button>
    </li>

    {/* Past */}
    <li>
      <button
        type="button"
        onClick={() => setActiveTab('past')}
        className={`${
          activeTab === 'past' ? '!border-primary text-primary' : ''
        } flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary shrink-0`}
      >
        <FaHistory className="w-4 h-4" />
        Past Appointments
      </button>
    </li>

    {/* Insurance */}
    <li>
      <button
        type="button"
        onClick={() => setActiveTab('insurance')}
        className={`${
          activeTab === 'insurance' ? '!border-primary text-primary' : ''
        } flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary shrink-0`}
      >
        <FaShieldAlt className="w-4 h-4" />
        Insurance Details
      </button>
    </li>

  </ul>
</div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            {demographics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">MRN:</h4>
                    <span className="inline-block px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded text-sm font-medium">
                      {demographics.mrn || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status:</h4>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                      demographics.status 
                        ? 'bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-200' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}>
                      {demographics.status ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name:</h4>
                    <span className="text-gray-900 dark:text-white">{formattedName || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Previous Name:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.previousFullName || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">DOB:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.dOB ? formatDate(demographics.dOB) : '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sex:</h4>
                    <span className="text-gray-900 dark:text-white">{sexDisplay}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Marital Status:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.maritalStatus || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Language:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.preferredLanguage || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Pharmacy Name:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.pharmacyList?.[0]?.name || '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Visit Date:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.lastVisitDate ? formatDate(demographics.lastVisitDate) : '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Personal Email:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.emailAddress || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Country of Birth:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.countryOfBirth || '--'}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Home Address:</h4>
                    <span className="text-gray-900 dark:text-white">{homeAddress || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Ethnicities:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.ethnicity || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Race:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.race || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Home Phone:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.homePhone || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Phone:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.mobilePhone || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Work Phone:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.workPhone || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Other Phone:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.otherPhone || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Work Email:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.workEmail || '--'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p className="text-gray-600 dark:text-gray-400">No demographic information found</p>
              </div>
            )}

            {/* Additional Information Section */}
            {demographics && (
              <div className="mt-8">
                <h5 className="mb-4 font-semibold text-gray-900 dark:text-white">Additional Information</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mailing Address:</h4>
                    <span className="text-gray-900 dark:text-white">{mailingAddress || '--'}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Advanced Health Care Directive:</h4>
                    <span className="text-gray-900 dark:text-white">{demographics.advancedHealthCareDirective || '--'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Contact Section */}
            {demographics && (
              <div className="mt-8">
                <h5 className="mb-4 font-semibold text-gray-900 dark:text-white">Emergency Contact</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Contact Name:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.emergencyContact?.contactName || '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Contact Phone:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.emergencyContact?.contactPhone || '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Relationship to Patient:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {demographics.emergencyContact?.relationshipToPatient || '--'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Address:</h4>
                    <span className="text-gray-900 dark:text-white">
                      {[
                        demographics.emergencyContact?.street,
                        demographics.emergencyContact?.emergencyCity,
                        demographics.emergencyContact?.emergencyState,
                        demographics.emergencyContact?.emergencyZipCode
                      ]
                        .filter(Boolean)
                        .join(', ') || '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upcoming Appointments Tab */}
        {activeTab === 'upcoming' && (
          <div>
            {demographicData.futureAppointments && demographicData.futureAppointments.length > 0 ? (
              <div className="space-y-4">
                {demographicData.futureAppointments.map((appointment: any, index: number) => (
                  <div key={index} className="panel p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <img
                          alt="Patient"
                          src="https://www.pngarts.com/files/10/Default-Profile-Picture-Download-PNG-Image.png"
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="mb-0 text-gray-900 dark:text-white">
                            {formatDateShort(appointment.startDate)}
                          </h4>
                          <span className="text-gray-500 dark:text-gray-400 text-sm">{appointment.startTime}</span>
                        </div>
                        <h3 className="mb-1 text-gray-900 dark:text-white">
                          {appointment.providerName || appointment.patientName}
                          <span className="text-gray-500 dark:text-gray-400 ms-2">
                            {getStatusMessage(appointment.appointmentStatus, false)}{' '}
                            {appointment.serviceLocationName}
                          </span>
                        </h3>
                        <p className="mb-1 text-gray-600 dark:text-gray-400">
                          {appointment.visitReasonName || 'Visit'}
                          {appointment.visitReasonmsg && ` - ${appointment.visitReasonmsg}`}
                        </p>
                        {appointment.note && (
                          <p className="mb-0 text-sm text-gray-500 dark:text-gray-400">
                            <small>{appointment.note}</small>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p className="text-gray-600 dark:text-gray-400">No upcoming appointments found</p>
              </div>
            )}
          </div>
        )}

        {/* Past Appointments Tab */}
        {activeTab === 'past' && (
          <div>
            {demographicData.pastAppointments && demographicData.pastAppointments.length > 0 ? (
              <div className="space-y-4">
                {demographicData.pastAppointments.map((appointment: any, index: number) => (
                  <div key={index} className="panel p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <img
                          alt="Patient"
                          src="https://www.pngarts.com/files/10/Default-Profile-Picture-Download-PNG-Image.png"
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="mb-0 text-gray-900 dark:text-white">
                            {formatDateShort(appointment.startDate)}
                          </h4>
                          <span className="text-gray-500 dark:text-gray-400 text-sm">{appointment.startTime}</span>
                        </div>
                        <h3 className="mb-1 text-gray-900 dark:text-white">
                          {appointment.providerName || appointment.patientName}
                          <span className="text-gray-500 dark:text-gray-400 ms-2">
                            {getStatusMessage(appointment.appointmentStatus, true)}{' '}
                            {appointment.serviceLocationName}
                          </span>
                        </h3>
                        <p className="mb-1 text-gray-600 dark:text-gray-400">
                          {appointment.visitReasonName || 'Visit'}
                          {appointment.visitReasonmsg && ` - ${appointment.visitReasonmsg}`}
                        </p>
                        {appointment.note && (
                          <p className="mb-0 text-sm text-gray-500 dark:text-gray-400">
                            <small>{appointment.note}</small>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p className="text-gray-600 dark:text-gray-400">No past appointments found</p>
              </div>
            )}
          </div>
        )}

        {/* Insurance Details Tab */}
        {activeTab === 'insurance' && (
          <div>
            {demographicData.insuranceDetails?.insuranceType ? (
              <div className="space-y-6">
                {/* Primary Insurance */}
                <div>
                  <div className="border-b border-white-light dark:border-[#191e3a] pb-2 mb-4">
                    <h5 className="text-gray-700 dark:text-gray-300 font-semibold">
                      Primary Insurance Information
                      {demographicData.insuranceDetails?.insuranceStatus && (
                        <small className="text-gray-500 dark:text-gray-400 ms-2">
                          ({demographicData.insuranceDetails.insuranceStatus})
                        </small>
                      )}
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Type:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.insuranceType || '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Company:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.insuranceCompany || '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Phone Number:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.phoneNumber || '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Subscriber ID:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.subscriberId || '--'}
                        </span>
                      </div>
                      {/* <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Plan:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.insurancePlan || '--'}
                        </span>
                      </div> */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Medical Group / IPA:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.medicalGroup || '--'}
                        </span>
                      </div>
                      {demographicData.insuranceDetails?.guarantor === 'Self' && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.insuranceDetails?.guarantor || '--'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Group Number:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.groupNumber || '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Co-Pay Amount:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.coPayAmount != null
                            ? `$${demographicData.insuranceDetails.coPayAmount}`
                            : '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Coverage Start Date:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.coverageStartDate
                            ? formatDate(demographicData.insuranceDetails.coverageStartDate)
                            : '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Termination Date:</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.terminationDate
                            ? formatDate(demographicData.insuranceDetails.terminationDate)
                            : '--'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Primary Care Physician (PCP):</h4>
                        <span className="text-gray-900 dark:text-white">
                          {demographicData.insuranceDetails?.pcp || '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Guarantor Information */}
                  {demographicData.insuranceDetails?.guarantor &&
                    demographicData.insuranceDetails.guarantor !== 'Self' && (
                      <div className="mt-6 pt-6 border-t border-white-light dark:border-[#191e3a]">
                        <div className="border-b border-white-light dark:border-[#191e3a] pb-2 mb-4">
                          <h5 className="text-gray-700 dark:text-gray-300 font-semibold">
                            Primary Insurance Guarantor Information
                          </h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor:</h4>
                              <span className="text-gray-900 dark:text-white">
                                {demographicData.insuranceDetails?.guarantor || '--'}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Name:</h4>
                              <span className="text-gray-900 dark:text-white">
                                {demographicData.insuranceDetails?.guarantorName || '--'}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Date of Birth:</h4>
                              <span className="text-gray-900 dark:text-white">
                                {demographicData.insuranceDetails?.guarantorDOB
                                  ? formatDate(demographicData.insuranceDetails.guarantorDOB)
                                  : '--'}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Address:</h4>
                              <span className="text-gray-900 dark:text-white">
                                {demographicData.insuranceDetails?.guarantorAddress || '--'}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Guarantor Subscriber/Member ID:
                              </h4>
                              <span className="text-gray-900 dark:text-white">
                                {demographicData.insuranceDetails?.guarantorSubscriberId || '--'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {/* Secondary Insurance */}
                {demographicData.secondaryInsuranceDetails?.insuranceType && (
                  <div className="mt-6 pt-6 border-t border-white-light dark:border-[#191e3a]">
                    <div className="border-b border-white-light dark:border-[#191e3a] pb-2 mb-4">
                      <h5 className="text-gray-700 dark:text-gray-300 font-semibold">
                        Secondary Insurance Information
                        {demographicData.secondaryInsuranceDetails?.insuranceStatus && (
                          <small className="text-gray-500 dark:text-gray-400 ms-2">
                            ({demographicData.secondaryInsuranceDetails.insuranceStatus})
                          </small>
                        )}
                      </h5>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Type:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.insuranceType || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Company:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.insuranceCompany || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Phone Number:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.phoneNumber || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Subscriber ID:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.subscriberId || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Plan:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.insurancePlan || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Medical Group / IPA:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.medicalGroup || '--'}
                          </span>
                        </div>
                        {demographicData.secondaryInsuranceDetails?.guarantor === 'Self' && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor:</h4>
                            <span className="text-gray-900 dark:text-white">
                              {demographicData.secondaryInsuranceDetails?.guarantor || '--'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Group Number:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.groupNumber || '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Co-Pay Amount:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.coPayAmount != null
                              ? `$${demographicData.secondaryInsuranceDetails.coPayAmount}`
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Insurance Coverage Start Date:
                          </h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.coverageStartDate
                              ? formatDate(demographicData.secondaryInsuranceDetails.coverageStartDate)
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Insurance Termination Date:</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.terminationDate
                              ? formatDate(demographicData.secondaryInsuranceDetails.terminationDate)
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Primary Care Physician (PCP):</h4>
                          <span className="text-gray-900 dark:text-white">
                            {demographicData.secondaryInsuranceDetails?.pcp || '--'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Guarantor Information */}
                    {demographicData.secondaryInsuranceDetails?.guarantor &&
                      demographicData.secondaryInsuranceDetails.guarantor !== 'Self' && (
                        <div className="mt-6 pt-6 border-t border-white-light dark:border-[#191e3a]">
                          <div className="border-b border-white-light dark:border-[#191e3a] pb-2 mb-4">
                            <h5 className="text-gray-700 dark:text-gray-300 font-semibold">
                              Secondary Insurance Guarantor Information
                            </h5>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor:</h4>
                                <span className="text-gray-900 dark:text-white">
                                  {demographicData.secondaryInsuranceDetails?.guarantor || '--'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Name:</h4>
                                <span className="text-gray-900 dark:text-white">
                                  {demographicData.secondaryInsuranceDetails?.guarantorName || '--'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Date of Birth:</h4>
                                <span className="text-gray-900 dark:text-white">
                                  {demographicData.secondaryInsuranceDetails?.guarantorDOB
                                    ? formatDate(demographicData.secondaryInsuranceDetails.guarantorDOB)
                                    : '--'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Guarantor Address:</h4>
                                <span className="text-gray-900 dark:text-white">
                                  {demographicData.secondaryInsuranceDetails?.guarantorAddress || '--'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                  Guarantor Subscriber/Member ID:
                                </h4>
                                <span className="text-gray-900 dark:text-white">
                                  {demographicData.secondaryInsuranceDetails?.guarantorSubscriberId || '--'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p className="text-gray-600 dark:text-gray-400">No Insurance found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Demographic;
