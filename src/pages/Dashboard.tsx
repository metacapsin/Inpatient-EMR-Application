import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { patientDataAPI, aiHealthInsightsAPI } from '../services/api';
import { format } from 'date-fns';
import IconSparkles from '../components/Icon/IconSparkles';
import { 
  FaStethoscope, 
  FaUserShield, 
  FaHeartbeat, 
  FaPills, 
  FaPrescriptionBottle,
  FaHistory,
  FaStickyNote,
  FaFileMedical,
  FaFlask,
  FaUserCheck,
  FaSyringe,
  FaCalendarCheck,
  FaEye,
  FaDownload,
  FaTimes,
  FaChartLine,
  FaExclamationTriangle,
  FaClipboardList,
  FaVial
} from 'react-icons/fa';

interface FaceSheetData {
  vitals?: any[];
  diagnoses?: any[];
  History?: any[];
  medications?: any[];
  prescriptions?: any[];
  allergies?: any[];
  immunizations?: any[];
  documents?: any[];
  labDocuments?: any[];
  notes?: any[];
  screening?: any[];
  futureAppointments?: any[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [faceSheetData, setFaceSheetData] = useState<FaceSheetData>({});
  const [loading, setLoading] = useState(false);

  // AI Health Insights states
  const [healthScore, setHealthScore] = useState<any>(null);
  const [loadingHealthScore, setLoadingHealthScore] = useState(false);
  const [careGaps, setCareGaps] = useState<any>(null);
  const [loadingCareGaps, setLoadingCareGaps] = useState(false);
  const [nextVisitPrep, setNextVisitPrep] = useState<any>(null);
  const [loadingNextVisitPrep, setLoadingNextVisitPrep] = useState(false);
  const [labComparison, setLabComparison] = useState<any>(null);
  const [loadingLabComparison, setLoadingLabComparison] = useState(false);
  const [showNextVisitPrepModal, setShowNextVisitPrepModal] = useState(false);

  const getPatientId = () => {
    const currentUser = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user') || '{}')
      : {};
    return currentUser.patientId || currentUser.rcopiaID || '';
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const convertHeightShort = (feet: number, inches: number): string => {
    if (!feet && !inches) return '';
    const totalInches = feet * 12 + inches;
    const cm = totalInches * 2.54;
    return `${feet}'${inches}" / ${cm.toFixed(1)} cm`;
  };

  const getFaceSheet = async () => {
    const patientId = getPatientId();
    if (!patientId) {
      toast.error('Patient ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await patientDataAPI.getFaceSheet(patientId);
      if (response.data?.status === 'success' && response.data?.data) {
        const data = response.data.data;
        
        // Format vitals with height display
        const formattedVitals = data.vitals?.map((vital: any) => ({
          ...vital,
          heightDisplay: convertHeightShort(
            vital.vitalsHeightInFeet || 0,
            vital.vitalsHeightInInch || 0
          )
        })) || [];

        setFaceSheetData({
          vitals: formattedVitals,
          diagnoses: data.diagnoses || [],
          History: data.History || [],
          medications: data.medications || [],
          prescriptions: data.prescriptions || [],
          allergies: data.allergies || [],
          immunizations: data.immunizations || [],
          documents: data.documents || [],
          labDocuments: data.labDocuments || [],
          notes: data.notes || [],
          screening: data.screening || [],
          futureAppointments: data.futureAppointments || []
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch face sheet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getFaceSheet();
    fetchHealthInsights();
  }, []);

  const fetchHealthInsights = async () => {
    const patientId = getPatientId();
    if (!patientId) return;

    // Fetch all health insights in parallel
    Promise.all([
      fetchHealthScore(patientId),
      fetchCareGaps(patientId),
      fetchNextVisitPrep(patientId),
      fetchLabComparison(patientId),
    ]);
  };

  const fetchHealthScore = async (patientId: string) => {
    setLoadingHealthScore(true);
    try {
      const response = await aiHealthInsightsAPI.getHealthScore(patientId);
      const data = response.data?.data || response.data;
      setHealthScore(data);
    } catch (error: any) {
      console.error('Error fetching health score:', error);
      // Don't show toast for background loading
    } finally {
      setLoadingHealthScore(false);
    }
  };

  const fetchCareGaps = async (patientId: string) => {
    setLoadingCareGaps(true);
    try {
      const response = await aiHealthInsightsAPI.getCareGaps(patientId);
      const data = response.data?.data || response.data;
      setCareGaps(data);
    } catch (error: any) {
      console.error('Error fetching care gaps:', error);
    } finally {
      setLoadingCareGaps(false);
    }
  };

  const fetchNextVisitPrep = async (patientId: string) => {
    setLoadingNextVisitPrep(true);
    try {
      const response = await aiHealthInsightsAPI.getNextVisitPrep(patientId);
      const data = response.data?.data || response.data;
      setNextVisitPrep(data);
    } catch (error: any) {
      console.error('Error fetching next visit prep:', error);
    } finally {
      setLoadingNextVisitPrep(false);
    }
  };

  const fetchLabComparison = async (patientId: string) => {
    setLoadingLabComparison(true);
    try {
      const response = await aiHealthInsightsAPI.getLabComparison(patientId);
      const data = response.data?.data || response.data;
      setLabComparison(data);
    } catch (error: any) {
      console.error('Error fetching lab comparison:', error);
    } finally {
      setLoadingLabComparison(false);
    }
  };

  const changeRoute = (menu: string) => {
    navigate(`/app/${menu}`);
  };

  const downloadDocument = async (id: string) => {
    try {
      const response = await patientDataAPI.downloadDocument(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      toast.error('Failed to download document');
    }
  };

  const downloadNote = async (id: string) => {
    try {
      const response = await patientDataAPI.downloadNotes(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      toast.error('Failed to download note');
    }
  };

  const downloadLab = async (id: string) => {
    try {
      const response = await patientDataAPI.downloadLabDocument(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      toast.error('Failed to download lab result');
    }
  };

  const getNotePreviewText = (note: any): string => {
    if (note?.notesType === 'SOAP Note' || note?.notesType?.toLowerCase().includes('soap')) {
      return note?.subjective || note?.soapContent?.subjective || note?.notesText || '';
    }
    return note?.notesText || '';
  };

  const getScreeningStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Completed':
        return 'bg-success text-white';
      case 'Scheduled':
        return 'bg-info text-white';
      case 'Pending Follow-Up':
        return 'bg-warning text-white';
      case 'Send Reminder':
        return 'bg-primary text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScreeningTypeNames = (screeningTypes: string[]): string => {
    if (!screeningTypes || screeningTypes.length === 0) return 'No Screenings';
    
    const screeningMap: Record<string, string> = {
      'Abdominal_Aneurysm_Screening': 'Abdominal Aneurysm',
      'Breast_Cancer_Screening': 'Breast Cancer',
      'Cervical_Cancer_Screening': 'Cervical Cancer',
      'Colorectal_Cancer_Screening': 'Colorectal Cancer',
      'Diabetic_Screening': 'Diabetic',
      'Dyslipidemia_Screening': 'Dyslipidemia',
      'Folic_Acid_Supplementation': 'Folic Acid',
      'High_Blood_Pressure': 'Blood Pressure',
      'HIV_Risk_Assessment': 'HIV Risk',
      'Lung_Cancer_Screening': 'Lung Cancer',
      'Obesity_Screening': 'Obesity',
      'Osteoporosis_Screening': 'Osteoporosis',
      'STI_Screening': 'STI',
      'Skin_Cancer_Screening': 'Skin Cancer',
      'Vaccines_Immunizations': 'Vaccines'
    };
    
    const names = screeningTypes.map(type => screeningMap[type] || type.replace(/_/g, ' '));
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more` : names.join(', ');
  };

  const stats = {
    diagnoses: faceSheetData.diagnoses?.length ?? 0,
    allergies: faceSheetData.allergies?.length ?? 0,
    medications: faceSheetData.medications?.length ?? 0,
    appointments: faceSheetData.futureAppointments?.length ?? 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-b from-white to-gray-50/50 dark:from-black dark:to-[#0f172a]/30 rounded-xl">
        <div className="text-center">
          <div className="relative mx-auto w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
            <div className="absolute inset-2 rounded-full bg-primary/5 flex items-center justify-center">
              <FaHeartbeat className="text-primary text-lg" />
            </div>
          </div>
          <p className="mt-5 text-gray-600 dark:text-gray-400 font-medium">Loading your dashboard...</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Fetching health summary</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel border border-white-light dark:border-dark overflow-hidden">
        {/* Breadcrumb */}
        <div className="mb-6">
          <ul className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li>
              <a href="#" className="text-primary hover:underline font-medium">Home</a>
            </li>
            <li className="text-gray-400 dark:text-gray-500">/</li>
            <li className="text-gray-900 dark:text-white font-semibold">Dashboard</li>
          </ul>
        </div>

        {/* Welcome & Quick Stats */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
            Health Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Your medical summary at a glance
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => changeRoute('diagnoses')}
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border border-primary/20 dark:border-primary/30 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 dark:bg-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaStethoscope className="text-primary text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.diagnoses}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Diagnoses</p>
              </div>
            </div>
            <div
              onClick={() => changeRoute('allergies')}
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-info/10 to-info/5 dark:from-info/20 dark:to-info/10 border border-info/20 dark:border-info/30 cursor-pointer hover:shadow-md hover:border-info/40 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-info/20 dark:bg-info/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaUserShield className="text-info text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.allergies}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Allergies</p>
              </div>
            </div>
            <div
              onClick={() => changeRoute('medications')}
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 dark:from-success/20 dark:to-success/10 border border-success/20 dark:border-success/30 cursor-pointer hover:shadow-md hover:border-success/40 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-success/20 dark:bg-success/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaPills className="text-success text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.medications}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Medications</p>
              </div>
            </div>
            <div
              onClick={() => navigate('/app/appointments')}
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border border-warning/20 dark:border-warning/30 cursor-pointer hover:shadow-md hover:border-warning/40 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-warning/20 dark:bg-warning/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaCalendarCheck className="text-warning text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.appointments}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Upcoming</p>
              </div>
            </div>
            <div
              onClick={() => navigate('/app/health-summary')}
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border border-primary/20 dark:border-primary/30 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 dark:bg-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FaClipboardList className="text-primary text-xl" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Health Summary</p>
                <p className="text-xs text-primary font-medium mt-0.5">View full overview →</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Health Insights Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <IconSparkles className="text-primary w-6 h-6" />
            AI Health Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health Score Card */}
            <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 dark:bg-success/25 flex items-center justify-center">
                  <FaChartLine className="text-success text-lg" />
                </div>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Health Score</h5>
              </div>
              {loadingHealthScore ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-success"></div>
                </div>
              ) : healthScore ? (
                <div>
                  <div className="text-3xl font-bold text-success mb-1">
                    {healthScore.score || healthScore.healthScore || 'N/A'}
                    {healthScore.score || healthScore.healthScore ? '/100' : ''}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {healthScore.summary || healthScore.description || 'Overall health assessment'}
                  </p>
                  {healthScore.recommendations && (
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      {Array.isArray(healthScore.recommendations) 
                        ? healthScore.recommendations.slice(0, 2).map((rec: string, i: number) => (
                            <div key={i} className="mb-1">• {rec}</div>
                          ))
                        : healthScore.recommendations}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>

            {/* Care Gaps Card */}
            <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-warning/15 dark:bg-warning/25 flex items-center justify-center">
                  <FaExclamationTriangle className="text-warning text-lg" />
                </div>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Care Gaps</h5>
              </div>
              {loadingCareGaps ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-warning"></div>
                </div>
              ) : careGaps ? (
                <div>
                  <div className="text-3xl font-bold text-warning mb-1">
                    {careGaps.gapCount || (Array.isArray(careGaps.gaps) ? careGaps.gaps.length : 0)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {careGaps.summary || 'Missing screenings or tests'}
                  </p>
                  {Array.isArray(careGaps.gaps) && careGaps.gaps.length > 0 && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 max-h-20 overflow-y-auto">
                      {careGaps.gaps.slice(0, 2).map((gap: any, i: number) => (
                        <div key={i} className="mb-1">• {gap.name || gap.type || gap}</div>
                      ))}
                      {careGaps.gaps.length > 2 && (
                        <div className="text-gray-500">+{careGaps.gaps.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>

            {/* Next Visit Prep Card */}
            <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info/15 dark:bg-info/25 flex items-center justify-center">
                    <FaClipboardList className="text-info text-lg" />
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Next Visit Prep</h5>
                </div>
                {nextVisitPrep && !loadingNextVisitPrep && (
                  <button
                    type="button"
                    onClick={() => setShowNextVisitPrepModal(true)}
                    className="text-xs font-medium text-info hover:text-info-dark hover:underline cursor-pointer transition-colors"
                  >
                    View All →
                  </button>
                )}
              </div>
              {loadingNextVisitPrep ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-info"></div>
                </div>
              ) : nextVisitPrep ? (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {nextVisitPrep.summary || nextVisitPrep.prepSummary || 'Preparation checklist'}
                  </p>
                  {nextVisitPrep.items && Array.isArray(nextVisitPrep.items) && nextVisitPrep.items.length > 0 ? (
                    <div className="text-xs text-gray-600 dark:text-gray-300 max-h-20 overflow-y-auto space-y-1">
                      {nextVisitPrep.items.slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="mb-1">
                          <span className="font-semibold text-info">{item.category}:</span> {item.action}
                        </div>
                      ))}
                      {nextVisitPrep.items.length > 2 && (
                        <div className="text-info text-xs font-medium mt-1">+{nextVisitPrep.items.length - 2} more items</div>
                      )}
                    </div>
                  ) : nextVisitPrep.checklist && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 max-h-20 overflow-y-auto">
                      {Array.isArray(nextVisitPrep.checklist) 
                        ? nextVisitPrep.checklist.slice(0, 3).map((item: string, i: number) => (
                            <div key={i} className="mb-1">✓ {item}</div>
                          ))
                        : nextVisitPrep.checklist}
                    </div>
                  )}
                  {nextVisitPrep.questions && Array.isArray(nextVisitPrep.questions) && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                      <div className="font-semibold mb-1">Questions to ask:</div>
                      {nextVisitPrep.questions.slice(0, 2).map((q: string, i: number) => (
                        <div key={i} className="mb-1">• {q}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>

            {/* Lab Comparison Card */}
            <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-danger/15 dark:bg-danger/25 flex items-center justify-center">
                  <FaVial className="text-danger text-lg" />
                </div>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Lab Trends</h5>
              </div>
              {loadingLabComparison ? (
                <div className="flex justify-center items-center h-20">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-danger"></div>
                </div>
              ) : labComparison ? (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {labComparison.summary || 'Lab result trends over time'}
                  </p>
                  {labComparison.trends && Array.isArray(labComparison.trends) && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 max-h-20 overflow-y-auto">
                      {labComparison.trends.slice(0, 3).map((trend: any, i: number) => (
                        <div key={i} className="mb-1">
                          {trend.testName || trend.name}: {trend.trend || trend.status || 'N/A'}
                        </div>
                      ))}
                    </div>
                  )}
                  {labComparison.comparison && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                      {typeof labComparison.comparison === 'string' 
                        ? labComparison.comparison 
                        : JSON.stringify(labComparison.comparison)}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Diagnosis Card */}
          {faceSheetData.diagnoses && faceSheetData.diagnoses.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                  <FaStethoscope className="text-primary text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Diagnosis</h5>
              </div>
              <button
                type="button"
                onClick={() => changeRoute('diagnoses')}
                className="text-sm font-medium text-primary hover:text-primary-dark hover:underline cursor-pointer transition-colors"
              >
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.diagnoses && faceSheetData.diagnoses.length > 0 ? (
                faceSheetData.diagnoses.map((diagnosis: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-primary hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <label className="text-primary font-bold text-sm uppercase tracking-wide">{diagnosis?.code || 'N/A'}</label>
                      <span className="badge bg-primary/90 text-white text-xs shrink-0">Active</span>
                    </div>
                    <p className="mt-1 mb-0 text-gray-700 dark:text-gray-300">{diagnosis?.description || 'N/A'}</p>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Diagnosis Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Allergies Card */}
          {faceSheetData.allergies && faceSheetData.allergies.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/15 dark:bg-info/25 flex items-center justify-center">
                  <FaUserShield className="text-info text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Allergies</h5>
              </div>
              <button
                type="button"
                onClick={() => changeRoute('allergies')}
                className="text-sm font-medium text-info hover:underline cursor-pointer transition-colors"
              >
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.allergies && faceSheetData.allergies.length > 0 ? (
                faceSheetData.allergies.map((allergy: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-info hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    <div className="flex justify-between items-center mb-2 gap-2">
                      <label className="text-info font-bold">{allergy.name || allergy.allergyName || 'N/A'}</label>
                      <span className="badge bg-info/15 text-info dark:bg-info/25 text-xs shrink-0">{allergy.severity || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <FaStickyNote className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                      <p className="mb-0 text-gray-600 dark:text-gray-400 text-sm">{allergy.reaction || 'No reaction data available'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Allergies Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Vitals Card */}
          {faceSheetData.vitals && faceSheetData.vitals.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                  <FaHeartbeat className="text-primary text-lg" />
                </div>
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Vitals</h5>
                  {faceSheetData.vitals && faceSheetData.vitals.length > 0 && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs block mt-0.5">
                      Latest: {formatDate(faceSheetData.vitals[0].vitalsRecordedDate)}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => changeRoute('vitals')} className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {faceSheetData.vitals && faceSheetData.vitals.length > 0 ? (
                faceSheetData.vitals.map((vital: any, index: number) => (
                  <div key={index} className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-primary hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                        <label className="text-primary font-bold text-sm">Blood pressure</label>
                        <p className="mb-0 text-lg">
                          {vital.vitalsSystolicBloodPressure || '--'}/{vital.vitalsDiastolicBloodPressure || '--'}
                          {(vital.vitalsSystolicBloodPressure || vital.vitalsDiastolicBloodPressure) && ' mmHg'}
                        </p>
                      </div>
                      <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-danger hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                        <label className="text-danger font-bold text-sm">Heart rate</label>
                        <p className="mb-0 text-lg">
                          {vital.vitalsHeartRate || '--'} {vital.vitalsHeartRate && ' bpm'}
                        </p>
                      </div>
                      <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-warning hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                        <label className="text-warning font-bold text-sm">Temperature</label>
                        <p className="mb-0 text-lg">
                          {vital.vitalsTemperature || '--'} {vital.vitalsTemperature && ' °F'}
                        </p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">Weight</label>
                        <p className="mb-0">
                          {vital.vitalsWeightLbs ? `${vital.vitalsWeightLbs} lbs` : '--'} {vital.vitalsWeightKg ? `${vital.vitalsWeightKg} Kg` : '--'}
                        </p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">Blood Sugar:</label>
                        <div className="mb-1.5">
                          <label className="text-gray-500 dark:text-gray-400">Fasting</label>
                          <p className="mb-0">{vital.fastingBloodSugar ? `${vital.fastingBloodSugar} mg/dL` : '---'}</p>
                        </div>
                        <div className="mb-1.5">
                          <label className="text-gray-500 dark:text-gray-400">Postprandial</label>
                          <p className="mb-0">{vital.postprandialBloodSugar ? `${vital.postprandialBloodSugar} mg/dL` : '---'}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 p-3 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-info hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                        <label className="text-info font-bold text-sm">SpO₂</label>
                        <p className="mb-0 text-lg">
                          {vital.vitalsSpO2 || '--'} {vital.vitalsSpO2 && ' %'}
                        </p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">Respiratory Rate</label>
                        <p className="mb-0">{vital.vitalsRespiratoryRate ? `${vital.vitalsRespiratoryRate} /min` : '--'}</p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">BMI</label>
                        <p className="mb-0">{vital.vitalsBodyMassIndex || '--'}</p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">Height</label>
                        <p className="mb-0">{vital.heightDisplay || '--'}</p>
                      </div>
                      <div className="mb-3">
                        <label className="text-gray-500 dark:text-gray-400">BSA</label>
                        <p className="mb-0">{vital.vitalsbodyarea ? `${vital.vitalsbodyarea} (m²)` : '---'}</p>
                      </div>
                    </div>
                    {(vital.painScale || vital.painLocation) && (
                      <div className="col-span-2 mb-3 p-3 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-gray-500 hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                        <label className="text-gray-600 dark:text-gray-300 font-bold">Pain Details</label>
                        <div className="mt-1">
                          {vital.painScale && (
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Pain Scale:</span>
                              <span className="font-bold">{vital.painScale}</span>
                            </div>
                          )}
                          {vital.painLocation && (
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Pain Location:</span>
                              <span className="font-bold">{vital.painLocation}</span>
                            </div>
                          )}
                          {vital.painLocationOther && (
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Other Pain Location:</span>
                              <span className="font-bold">{vital.painLocationOther}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Vitals Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Medications Card */}
          {faceSheetData.medications && faceSheetData.medications.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                  <FaPills className="text-primary text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Medications</h5>
              </div>
              <button type="button" onClick={() => changeRoute('medications')} className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.medications && faceSheetData.medications.length > 0 ? (
                faceSheetData.medications.map((medication: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-primary hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    {/* <div className="flex justify-between">
                      <label className="text-primary font-bold">
                        {medication?.drugName?.[0] || medication?.medicationName || '--'}
                      </label>
                      <span className="badge bg-primary text-white">
                        {medication?.quantity?.[0] || 'N/A'}
                      </span>
                    </div> */}
                    <div className="flex justify-between items-start gap-2">
  <label className="text-primary font-bold flex-1 break-words">
    {medication?.drugName?.[0] || medication?.medicationName || '--'}
  </label>

  <span className="badge bg-primary text-white shrink-0 px-2 py-1 text-xs h-fit">
    {medication?.quantity?.[0] || 'N/A'}
  </span>
</div>
                    <p className="mt-1 mb-0 text-gray-700 dark:text-gray-300">{medication?.dosage?.[0] || medication?.dosage || 'N/A'}</p>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Medication Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Prescriptions Card */}
          {faceSheetData.prescriptions && faceSheetData.prescriptions.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                  <FaPrescriptionBottle className="text-primary text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Prescriptions</h5>
              </div>
              <button type="button" onClick={() => changeRoute('prescriptions')} className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.prescriptions && faceSheetData.prescriptions.length > 0 ? (
                faceSheetData.prescriptions.map((prescription: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-primary hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    {/* <div className="flex justify-between">
                      <label className="text-primary font-bold">
                        {prescription?.drugName?.[0] || prescription?.medicationName || 'N/A'}
                      </label>
                      <div className="flex gap-2">
                        {prescription?.status === 'Completed' && (
                          <span className="badge bg-success text-white">Completed</span>
                        )}
                        {prescription?.status === 'Pending' && (
                          <span className="badge bg-warning text-white">Pending</span>
                        )}
                        {prescription?.status === 'Cancelled' && (
                          <span className="badge bg-danger text-white">Cancelled</span>
                        )}
                        <span className="badge bg-primary text-white">
                          {prescription?.quantity?.[0] || 'N/A'}
                        </span>
                      </div>
                    </div> */}
                    <div className="flex justify-between items-start gap-2">
  <label className="text-primary font-bold flex-1 break-words">
    {prescription?.drugName?.[0] || prescription?.medicationName || 'N/A'}
  </label>

  <div className="flex gap-2 shrink-0 flex-wrap">
    {prescription?.status === 'Completed' && (
      <span className="text-[11px] px-2 py-[2px] rounded-md bg-success text-white">
        Completed
      </span>
    )}

    {prescription?.status === 'Pending' && (
      <span className="text-[11px] px-2 py-[2px] rounded-md bg-warning text-white">
        Pending
      </span>
    )}

    {prescription?.status === 'Cancelled' && (
      <span className="text-[11px] px-2 py-[2px] rounded-md bg-danger text-white">
        Cancelled
      </span>
    )}

    <span className="flex items-center justify-center min-w-[24px] h-[24px] text-[11px] font-medium bg-primary text-white rounded-md">
      {prescription?.quantity?.[0] || 'N/A'}
    </span>
  </div>
</div>
                    <div className="mt-2 flex items-start gap-2">
                      <FaStickyNote className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{prescription?.directions?.[0] || prescription?.directions || 'No directions available'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Prescription Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* History Card */}
          {faceSheetData.History && faceSheetData.History.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center">
                  <FaHistory className="text-primary text-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <h5 className="text-lg font-semibold text-gray-900 dark:text-white">History</h5>
                  <span className="badge bg-primary/90 text-white text-xs">
                    {faceSheetData.History?.length || 0} Record(s)
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => changeRoute('history')} className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {faceSheetData.History && faceSheetData.History.length > 0 ? (
                faceSheetData.History.map((history: any, index: number) => (
                  <div key={index} className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-primary hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    {/* <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-primary rounded-full mr-2 shrink-0"></div> */}
                      {/* <div className="flex items-start gap-2 mb-2">
  <div className="w-2.5 h-2.5 bg-primary rounded-full mt-2 shrink-0"></div>
                      <div>
                        <label className="text-gray-500 dark:text-gray-400 font-semibold block">Condition:</label>
                        <h5 className="mb-0 text-primary">{history?.conditions || '--'}</h5>
                      </div>
                    </div> */}
                    <div className="flex items-start gap-2 mb-2">
  <div className="w-2.5 h-2.5 bg-primary rounded-full mt-2 shrink-0"></div>

  <div>
    <span className="text-gray-500 dark:text-gray-400 font-semibold">
      Condition:
    </span>
    <span className="ml-2 text-primary">{history?.conditions || '--'}</span>
  </div>
</div>
                    <div className="ml-5">
                      {/* <div className="mb-1">
                        <FaStickyNote className="text-gray-500 dark:text-gray-400 mr-1 inline" />
                        <label className="text-gray-500 dark:text-gray-400 font-semibold">Category:</label>
                        <span className="ml-1">{history?.category?.name || '--'}</span>
                      </div> */}
                    <div className="flex items-center gap-2 mb-1">
  <FaStickyNote className="text-gray-500 dark:text-gray-400 shrink-0" />

  <span className="text-gray-500 dark:text-gray-400 font-semibold">
    Category:
  </span>

  <span>{history?.category?.name || '--'}</span>
</div>
                      {/* <div className="mb-1">
                        <FaCalendarCheck className="text-gray-500 dark:text-gray-400 mr-1 inline" />
                        <label className="text-gray-500 dark:text-gray-400 font-semibold">Diagnosis Date:</label>
                        <span className="ml-1">
                          {history?.diagonosisDate ? formatDateShort(history.diagonosisDate) : '--'}
                        </span>
                      </div> */}
                   <div className="flex items-center gap-2">
  <FaCalendarCheck className="text-gray-500 dark:text-gray-400 shrink-0" />

  <span className="text-gray-500 dark:text-gray-400 font-semibold">
    Diagnosis Date:
  </span>

  <span>
    {history?.diagonosisDate ? formatDateShort(history.diagonosisDate) : '--'}
  </span>
</div>
                      {history?.notes && (
  <div className="flex items-start gap-2 mt-2">
    <FaStickyNote className="text-gray-500 dark:text-gray-400 mt-1 shrink-0" />

    <div>
      <span className="text-gray-500 dark:text-gray-400 font-semibold">
        Comments:
      </span>

      <p className="text-gray-500 dark:text-gray-400 italic">
        {history.notes}
      </p>
    </div>
  </div>
)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No History Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Notes Card */}
          {faceSheetData.notes && faceSheetData.notes.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/15 dark:bg-info/25 flex items-center justify-center">
                  <FaStickyNote className="text-info text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h5>
              </div>
              <button type="button" onClick={() => changeRoute('notes')} className="text-sm font-medium text-info hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.notes && faceSheetData.notes.length > 0 ? (
                faceSheetData.notes.map((note: any, index: number) => {
                  const previewText = getNotePreviewText(note);
                  return (
                    <div key={index} className="flex justify-between items-center gap-4 p-4 border border-white-light dark:border-dark rounded-xl bg-gray-50 dark:bg-dark hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                      <div>
                        <h5 className="mb-1">
                          {(note?.notesType === 'SOAP Note' || note?.notesType?.toLowerCase().includes('soap')) 
                            ? 'SOAP Note' 
                            : note?.notesType}
                          {previewText && (
                            <span className="text-gray-500 dark:text-gray-400">
                              {' (' + (previewText.length > 50 ? previewText.slice(0, 50) + '...' : previewText) + ')'}
                            </span>
                          )}
                        </h5>
                        <small className="text-gray-500 dark:text-gray-400 ml-2">
                          {note?.assignedProvider?.name || 'N/A'} - Created Date: {note?.date ? formatDate(note.date) : 'N/A'} {note?.time || ''}
                        </small>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm rounded-lg shrink-0"
                          onClick={() => downloadNote(note?._id)}
                        >
                          <FaDownload className="mr-1" /> Download
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Notes Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Documents Card */}
          {faceSheetData.documents && faceSheetData.documents.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/15 dark:bg-warning/25 flex items-center justify-center">
                  <FaFileMedical className="text-warning text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h5>
              </div>
              <button type="button" onClick={() => changeRoute('documents')} className="text-sm font-medium text-warning hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {faceSheetData.documents && faceSheetData.documents.length > 0 ? (
                <div className="table-responsive rounded-xl overflow-hidden">
                  <table className="table-hover">
                    <tbody>
                      {faceSheetData.documents.map((document: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-dark/50 transition-colors">
                          <td className="font-medium">{document.name || document.documentName || 'N/A'}</td>
                          <td className="text-gray-500 dark:text-gray-400">{document.date ? formatDate(document.date) : 'N/A'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-primary p-0 hover:opacity-80"
                              onClick={() => downloadDocument(document._id)}
                              title="View Document"
                            >
                              <FaEye />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Documents Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Test Results (Labs) Card */}
          {faceSheetData.labDocuments && faceSheetData.labDocuments.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger/15 dark:bg-danger/25 flex items-center justify-center">
                  <FaFlask className="text-danger text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Test Results</h5>
              </div>
              <button type="button" onClick={() => changeRoute('labs')} className="text-sm font-medium text-danger hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {faceSheetData.labDocuments && faceSheetData.labDocuments.length > 0 ? (
                <div className="table-responsive rounded-xl overflow-hidden">
                  <table className="table-hover">
                    <tbody>
                      {faceSheetData.labDocuments.map((lab: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-dark/50 transition-colors">
                          <td className="font-medium">{lab.name || lab.labName || 'N/A'}</td>
                          <td className="text-gray-500 dark:text-gray-400">{lab.date ? formatDate(lab.date) : 'N/A'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-primary p-0 hover:opacity-80"
                              onClick={() => downloadLab(lab._id)}
                              title="View Test Result"
                            >
                              <FaEye />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Test Results Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Preventive Screening Card */}
          {faceSheetData.screening && faceSheetData.screening.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200/80 dark:bg-gray-600/30 flex items-center justify-center">
                  <FaUserCheck className="text-gray-600 dark:text-gray-300 text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Preventive Screening</h5>
              </div>
              <button type="button" onClick={() => changeRoute('preventive-screening')} className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.screening && faceSheetData.screening.length > 0 ? (
                faceSheetData.screening.map((screening: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-gray-500 hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-gray-600 dark:text-gray-300 font-bold">
                        {getScreeningTypeNames(screening?.screeningType || [])}
                      </label>
                      <span className={`badge ${getScreeningStatusBadgeClass(screening?.screeningStatus || '')}`}>
                        {screening?.screeningStatus || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <small className="text-gray-500 dark:text-gray-400">
                        {screening?.screeningDate ? formatDate(screening.screeningDate) : '--'}
                      </small>
                      <small className="text-gray-500 dark:text-gray-400">
                        {screening?.screeningProvider?.name || screening?.screeningProvider || '--'}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Preventive Screenings Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Immunizations Card */}
          {faceSheetData.immunizations && faceSheetData.immunizations.length > 0 && (
          <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/15 dark:bg-info/25 flex items-center justify-center">
                  <FaSyringe className="text-info text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Immunizations</h5>
              </div>
              <button type="button" onClick={() => changeRoute('immunizations')} className="text-sm font-medium text-info hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {faceSheetData.immunizations && faceSheetData.immunizations.length > 0 ? (
                faceSheetData.immunizations.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="p-4 rounded-xl bg-gray-50 dark:bg-dark border-l-4 border-info hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Name</label>
                          <p className="mb-0">{item?.vaccineText || '--'}</p>
                        </div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Dose</label>
                          <p className="mb-0">{item?.dose || '--'}</p>
                        </div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Ordered date</label>
                          <p className="mb-0">{item?.orderedDate ? formatDateShort(item.orderedDate) : '--'}</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Type</label>
                          <p className="mb-0">{item?.vaccineType || '--'}</p>
                        </div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Unit</label>
                          <p className="mb-0">{item?.unit || '--'}</p>
                        </div>
                        <div className="mb-2">
                          <label className="text-info font-bold">Provider</label>
                          <p className="mb-0">{item?.providerId?.name || '--'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Immunizations Found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Appointments Card - Full Width */}
          {faceSheetData.futureAppointments && faceSheetData.futureAppointments.length > 0 && (
          <div className="panel col-span-full rounded-xl border border-white-light dark:border-dark shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white-light dark:border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 dark:bg-success/25 flex items-center justify-center">
                  <FaCalendarCheck className="text-success text-lg" />
                </div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Appointments</h5>
              </div>
              <button type="button" onClick={() => navigate('/app/appointments')} className="text-sm font-medium text-success hover:underline cursor-pointer transition-colors">
                View More →
              </button>
            </div>
            <div>
              {faceSheetData.futureAppointments && faceSheetData.futureAppointments.length > 0 ? (
                <ul className="space-y-4">
                  {faceSheetData.futureAppointments.map((appointment: any, index: number) => (
                    <li key={index} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-dark border border-white-light dark:border-dark hover:bg-gray-100/80 dark:hover:bg-dark/80 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-success/15 dark:bg-success/25 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          alt="Patient"
                          src="https://www.pngarts.com/files/10/Default-Profile-Picture-Download-PNG-Image.png"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h4 className="mb-0 font-semibold text-gray-900 dark:text-white">{formatDate(appointment.startDate)}</h4>
                          <span className="badge bg-success/15 text-success text-xs">{appointment.startTime}</span>
                        </div>
                        <h3 className="mb-1 font-medium text-gray-800 dark:text-gray-200">
                          {appointment.patientName}
                          <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">
                            at {appointment.serviceLocationName}
                          </span>
                        </h3>
                        <p className="mb-0 text-sm text-gray-500 dark:text-gray-400">Visit: {appointment.visitReasonName}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex justify-center items-center h-32 rounded-xl bg-gray-50 dark:bg-dark">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No Appointments Found</p>
                </div>
              )}
            </div>
          </div>
          )}

        </div>
      </div>

      {/* Next Visit Prep Modal */}
      {showNextVisitPrepModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowNextVisitPrepModal(false)}
        >
          <div
            className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-info text-white rounded-t-lg shrink-0">
              <h5 className="text-lg font-semibold flex items-center gap-2">
                <FaClipboardList className="w-5 h-5" />
                Next Visit Preparation
              </h5>
              <button
                type="button"
                onClick={() => setShowNextVisitPrepModal(false)}
                className="p-1.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {nextVisitPrep ? (
                <div className="space-y-6">
                  {nextVisitPrep.summary && (
                    <div className="panel p-4 border border-info/20 bg-info/5 dark:bg-info/10">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {nextVisitPrep.summary || nextVisitPrep.prepSummary}
                      </p>
                    </div>
                  )}

                  {/* Items List */}
                  {nextVisitPrep.items && Array.isArray(nextVisitPrep.items) && nextVisitPrep.items.length > 0 ? (
                    <div className="space-y-4">
                      <h6 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FaClipboardList className="text-info" />
                        Preparation Checklist ({nextVisitPrep.items.length} items)
                      </h6>
                      {nextVisitPrep.items.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="panel p-5 border border-white-light dark:border-[#191e3a] hover:border-info/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-info/15 dark:bg-info/25 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-info font-bold text-sm">{index + 1}</span>
                            </div>
                            <div className="flex-1">
                              <h6 className="text-info font-semibold mb-2 text-base">
                                {item.category || 'Preparation Item'}
                              </h6>
                              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                {item.action || item.description || 'No details available'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback to checklist or questions if items array doesn't exist
                    <>
                      {nextVisitPrep.checklist && (
                        <div className="space-y-4">
                          <h6 className="text-base font-semibold text-gray-900 dark:text-white">Checklist</h6>
                          {Array.isArray(nextVisitPrep.checklist) ? (
                            <ul className="space-y-2">
                              {nextVisitPrep.checklist.map((item: string, index: number) => (
                                <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                                  <span className="text-info mt-1">✓</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-700 dark:text-gray-300">{nextVisitPrep.checklist}</p>
                          )}
                        </div>
                      )}

                      {nextVisitPrep.questions && Array.isArray(nextVisitPrep.questions) && (
                        <div className="space-y-4">
                          <h6 className="text-base font-semibold text-gray-900 dark:text-white">Questions to Ask</h6>
                          <ul className="space-y-2">
                            {nextVisitPrep.questions.map((question: string, index: number) => (
                              <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                                <span className="text-info mt-1">•</span>
                                <span>{question}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-gray-500 dark:text-gray-400">No preparation data available</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white-light dark:border-dark p-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowNextVisitPrepModal(false)}
                className="btn btn-info"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
