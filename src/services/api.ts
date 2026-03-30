// api.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export const BASE_URL = 'https://devapi.mdcareproviders.com'
// http://101.53.133.39:4000
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    // CSRF disabled because JWT-based authentication is used
    // const csrfToken = localStorage.getItem('csrfToken');
    // if (csrfToken) {
    //   config.headers.set('X-CSRF-Token', csrfToken);
    // }
    
    // Add tenant ID header if available
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.tenant?.id) {
          config.headers.set('X-Tenant-ID', userData.tenant.id.toString());
        }
      } catch (error) {
        console.warn('Failed to parse user data for tenant ID:', error);
      }
    }
    
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor to handle authentication errors
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Check if this is a refresh token request to avoid infinite loops
      if (error.config?.url?.includes('/refresh-token')) {
        // Refresh token failed, clear all data and redirect
        localStorage.removeItem('token');
        // CSRF disabled because JWT-based authentication is used
        // localStorage.removeItem('csrfToken');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        delete axios.defaults.headers.common['Authorization'];
        // window.location.href = '/';
        return Promise.reject(new Error('Authentication failed - redirecting to login'));
      }

      // Try to refresh the token
      // try {
      //   // const refreshResponse = await userAPI.refreshToken();
      //   // if (refreshResponse.data.token) {
      //   //   // Update token in localStorage and axios headers
      //   //   localStorage.setItem('token', refreshResponse.data.token);
      //   //   axios.defaults.headers.common['Authorization'] = `Bearer ${refreshResponse.data.token}`;
          
      //   //   // Retry the original request
      //   //   const originalRequest = error.config;
      //   //   if (originalRequest) {
      //   //     originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
      //   //     return axios(originalRequest);
      //   //   }
      //   // }
      // } catch (refreshError) {
      //   // Refresh failed, clear all data and redirect
      //   localStorage.removeItem('token');
      // CSRF disabled because JWT-based authentication is used
      //   localStorage.removeItem('csrfToken');
      //   localStorage.removeItem('user');
      //   localStorage.removeItem('role');
      //   delete axios.defaults.headers.common['Authorization'];
      //   // window.location.href = '/';
      //   return Promise.reject(new Error('Token refresh failed - redirecting to login'));
      // }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: { username: string; password: string; tenant_id?: string }) =>
    api.post('/login', credentials, {
      headers: { 'Content-Type': 'application/json' },
    }),
  
  register: (userData: Record<string, any>) =>
    api.post('/auth/register', userData),
  
  registerUser: (userData: Record<string, any>) =>
    api.post('/auth/register-user', userData),
  
  forgotPassword: (email: string) =>
    api.post('/forgotPassword', { email }),
  
  resetPassword: (data: { token: string; newPassword: string; confirmPassword: string }) =>
    api.post('/auth/reset-password', data),
  
  refreshToken: () =>
    api.post('/auth/refresh-token'),
};

// User API
export const userAPI = {
  // Profile management
  // getProfile: () => 
  //   api.get('/auth/profile'),
  
  updateProfile: (data: Record<string, any>) => 
    api.put('/auth/profile', data),
  
  updatePreferences: (preferences: Record<string, any>) =>
    api.put('/auth/profile', { preferences }),
  
  // Token refresh
  refreshToken: () => 
    api.post('/auth/refresh-token'),
  
  // User management (for admins)
  registerUser: (userData: Record<string, any>) => {
    // Ensure we're sending the request to the correct endpoint
    return api.post('/auth/register-user', userData);
  },
  
  getUsers: () => 
    api.get('/tenants/users'),
  
  getTenantUsers: () => 
    api.get('/subscription/users'),
  
  updateUser: (userId: string, data: Record<string, any>) => 
    api.put(`/auth/users/${userId}`, data),
  
  updateTenantUser: (userId: string, data: Record<string, any>) => 
    api.put(`/tenant/users/${userId}`, data),
  
  deleteUser: (userId: string) => 
    api.delete(`/auth/users/${userId}`),
  
  // Tenant management
  getTenantSettings: () => 
    api.get('/tenants/current'),
  
  updateTenantSettings: (data: Record<string, any>) => 
    api.put('/tenants/current', data),
};

// Resources API
export const resourcesAPI = {
   syncResources: (data: Record<string, any> = {}) =>
    api.post('/resources/sync-resources', data),

  syncActivityWithToken: (data: Record<string, any> = {}) =>
    api.post('/resources/sync-activity-token', data),

  getAllResources: (params: Record<string, any> = {}) =>
    api.get(`/resources/resources?${new URLSearchParams(params)}`),

  exportResources: (params: Record<string, any> = {}) =>
    api.get(`/resources/resources/export?${new URLSearchParams(params)}`, {
      responseType: 'blob',
    }),

  getResourceActivity: (params: Record<string, any> = {}) =>
    api.get(`/resources/resources/activity?${new URLSearchParams(params)}`),

  syncResourceActivity: (data: Record<string, any> = {}) =>
    api.post('/resources/sync', data),

  exportActivities: (params: Record<string, any> = {}) =>
    api.get(`/resources/activities/export?${new URLSearchParams(params)}`, {
      responseType: 'blob',
    }),
};

// Costs API
export const costsAPI = {
  getCosts: (params: Record<string, any> = {}) =>
    api.get(`/costs/costs?${new URLSearchParams(params)}`),

  exportCosts: (params: Record<string, any> = {}) =>
    api.get(`/costs/costs/export?${new URLSearchParams(params)}`, {
      responseType: 'blob',
    }),

  exportTreeCosts: (data: Record<string, any> = {}) =>
    api.post('/costs/costs/tree/export', data, {
      responseType: 'blob',
    }),

  syncCosts: (data: Record<string, any> = {}) =>
    api.post('/costs/sync', data),

  syncCostsAdvanced: (data: Record<string, any> = {}) =>
    api.post('/costs/sync/advanced', data),

  syncCostsWithToken: (data: Record<string, any> = {}) =>
    api.post('/costs/sync/token', data),

  getCostSummary: (data: Record<string, any> = {}) =>
    api.post('/costs/summary', data),

  getCostsTree: (data: Record<string, any> = {}) =>
    api.post('/costs/costs/tree', data),

  getUsageTrends: (params: Record<string, any> = {}) =>
    api.get(`/costs/usage-trends?${new URLSearchParams(params)}`),

  getDropdownValues: (data: Record<string, any> = {}) =>
    api.post('/costs/costs/dropdown-values', data),
};

export const awsCostsAPI = {
  syncCosts: (data: Record<string, any> = {}) => api.post('/aws/costs/sync', data),
  getCostSummary: (params: Record<string, any> = {}) =>
    api.get(`/aws/costs/summary?${new URLSearchParams(params)}`),
  getCosts: (params: Record<string, any> = {}) =>
    api.get(`/aws/costs/cost?${new URLSearchParams(params)}`),
  exportCosts: (params: Record<string, any> = {}) =>
    api.get(`/aws/costs/export?${new URLSearchParams(params)}`, {
      responseType: 'blob',
    }),
};
 
export const awsResourcesAPI = {
  syncResources: () => api.post('/aws/resources/sync'),
  // ................**********************************...............................//
  syncActivities: () => api.post('/aws/resources/activities/sync'),

  
  getAwsResourceActivity: (params: Record<string, any> = {}) =>
    api.get(`/aws/resources/activities?${new URLSearchParams(params)}`),

    exportAwsResources: (params: Record<string, any> = {}) =>
    api.get(`/aws/resources/export?${new URLSearchParams(params)}`, {
      responseType: 'blob',
    }),
};

// Subscription API
export const subscriptionAPI = {
  createSubscription: (data: { plan: string; users: number }) =>
    api.post('/subscription', data),
  
  getSubscription: () =>
    api.get('/subscription'),
  
  // Tenant subscription endpoints
  getTenantSubscription: () =>
    api.get('/subscription/tenant'),
  
  getTenantSubscriptionHistory: () =>
    api.get('/subscription/tenant/history'),
  
  createTenantSubscription: (data: Record<string, any>) =>
    api.post('/subscription/tenant', data),
  
  activateSubscription: (subscriptionId: string, data: Record<string, any>) =>
    api.put(`/subscription/tenant/${subscriptionId}/activate`, data),
  
  getSubscriptionPlans: () =>
    api.get('/subscription/plans'),
  
  getTenantUsers: () =>
    api.get('/subscription/users'),
  
  checkServiceAccess: () =>
    api.get('/subscription/access'),
};

// Payment API
export const paymentAPI = {
  createOrder: (data: Record<string, any>) =>
    api.post('/payment/create-order', data),
  
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
    users: number;
    duration: string;
    customServices?: string[];
  }) => api.post('/payment/verify', data),
  
  getPaymentHistory: () =>
    api.get('/payment/history'),
};

// Reports API
export const reportsAPI = {
  getComparativeReport: () =>
    api.get('/reports/comparative'),
  
  getDrilldownReport: (params: string) =>
    api.get(`/reports/drilldown?${params}`),
};

// CSRF disabled because JWT-based authentication is used
// export const securityAPI = {
//   getCsrfToken: () =>
//     api.get('/api/csrf-token', { withCredentials: true }),
// };

// Budgets API
export const budgetsAPI = {
  getBudgets: (params: string = '') =>
    api.get(`/azure-budgets?${params}`),
  
  getBudgetById: (id: number) =>
    api.get(`/azure-budgets/${id}`),
  
  updateBudget: (id: number, data: Record<string, any>) =>
    api.put(`/azure-budgets/${id}`, data),
  
  deleteBudget: (id: number) =>
    api.delete(`/azure-budgets/${id}`),
  
  syncBudgets: () =>
    api.post('/azure-budgets/sync'),
};

// Business Units API
export const businessUnitsAPI = {
  getBusinessUnits: () =>
    api.get('/business-units'),
  
  getBusinessUnitById: (id: number) =>
    api.get(`/business-units/${id}`),
  
  createBusinessUnit: (data: Record<string, any>) =>
    api.post('/business-units', data),
  
  updateBusinessUnit: (id: number, data: Record<string, any>) =>
    api.put(`/business-units/${id}`, data),
  
  deleteBusinessUnit: (id: number) =>
    api.delete(`/business-units/${id}`),
  
  getResourceGroups: () =>
    api.get('/business-units/resource-groups'),
};

// Dashboard API
export const dashboardAPI = {
  getDashboardData: (params?: any) => api.get('/reports/dashboard', { params })
};

// Patient / registration API - separate axios instance (no auth interceptor)
// const PATIENT_API_BASE_URL = import.meta.env.VITE_PATIENT_API_BASE_URL || 'https://devapi.mdcareproviders.com';

const patientApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Patient API
export const patientAPI = {
  registerPatient: (patientData: Record<string, any>) =>
    patientApi.post('/Patient-Portal/patientSelfRegistration', patientData),

  patientUserlogin: (credentials: { username: string; password: string }) =>
    patientApi.post('/Patient-Portal/patientUserlogin', credentials),

  forgotPassword: (email: string) =>
    patientApi.post('/forgotPassword', { email }),

  // Reset password for patient
  resetPassword: (data: { patientId: string; newPassword: string }) =>
    patientApi.post('/Patient-Portal/resetPassword', data),

  // Get patient by ID. Pass token when calling right after login. Use cacheBust to force fresh data (e.g. after profile picture update).
  getPatientByID: (id: string, token?: string, cacheBust?: boolean) =>
    api.get(`/patient/getPatientByID/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      params: cacheBust ? { _t: Date.now() } : undefined,
    }),

  // Update profile picture (PUT). formData must contain key "profilePicture" with the image File.
  updateProfilePicture: (patientId: string, formData: FormData) =>
    api.put(`/Patient/updateProfilePicture/${patientId}`, formData),
};

// Appointment API
export const appointmentAPI = {
  getGeneralCalendarSetting: () =>
    api.get("/CalendarSetting/getGeneralCalendarSetting"),

  getVisitTypesList: () =>
    api.get("/VisitType/getVisitTypeList"),

  getRoomList: () =>
    api.get("/Rooms/getRoomList"),
  // Get all appointments with optional filters
  getAppointments: (id?: string) =>
    api.get('/Appointment/getAppointmentListByPatientId/' + id),
  
  // Get appointment by ID
  getAppointmentById: (id: string) =>
    api.get(`/appointments/${id}`),
  
  // Create new appointment
  createAppointment: (data: Record<string, any>) =>
    api.post('/Appointment/createAppointment', data),
  
  // Update existing appointment
  updateAppointment: (id: string, data: Record<string, any>) =>
    api.put(`/Appointment/updateAppointment`, data),
  
  // Delete appointment
  deleteAppointment: (id: string) =>
    api.delete(`/appointments/${id}`),
  
  // Check appointment conflict
  checkConflict: (data: Record<string, any>) =>
    api.post('/Appointment/conflict', data),
  
  // Get provider available slots
  getProviderAvailableSlots: (data: Record<string, any>) =>
    api.post('/Appointment/getProviderAvailableSlots', data),
  
  // Get dashboard statistics
  getDashboardStats: () =>
    api.get('/appointments/dashboard-stats'),
  
  // Get dropdown data for appointments (generic endpoint)
  getDropdownListData: (data: Record<string, any>) =>
    api.post('/setting/getDropdownListData', data),
  
  // Get dropdown data for appointments (specific endpoints - kept for backward compatibility)
  getPatients: () =>
    api.get('/appointments/dropdowns/patients'),
  
  getProviders: () =>
    api.get('/appointments/dropdowns/providers'),
  
  getVisitReasons: () =>
    api.get('/appointments/dropdowns/visit-reasons'),
  
  getServiceLocations: () =>
    api.get('/appointments/dropdowns/service-locations'),
  
  getRooms: () =>
    api.get('/appointments/dropdowns/rooms'),
  
  // Download appointments
  downloadCSV: (params?: Record<string, any>) =>
    api.get('/appointments/export/csv', { params, responseType: 'blob' }),
  
  downloadPDF: (params?: Record<string, any>) =>
    api.get('/appointments/export/pdf', { params, responseType: 'blob' }),
  
  // Update appointment status
  updateAppointmentStatus: (id: string, status: string, data?: Record<string, any>) =>
    api.put(`/appointments/${id}/status`, { status, ...data }),
};

// Common API
export const commonAPI = {
  getStates: (countryCode: string) =>
    api.get(`/Common/getStates/${countryCode}`),
};

// Settings API
export const settingsAPI = {
  getRaceCodes: () =>
    api.get('/setting/getRaceCodes'),

  getEthnicityCodes: () =>
    api.get('/setting/getEthnicityCodes'),

  getPreferredLanguageCodes: () =>
    api.get('/setting/getPreferredLanguageCodes'),
};

// Vitals API
export const vitalsAPI = {
  // Get vitals list for a patient
  getPatientVitalsList: (patientId: string) =>
    api.get(`/PatientVitals/getPatientVitalsList/${patientId}`),
  
  // Create new vitals record
  createPatientVitals: (data: Record<string, any>) =>
    api.post('/PatientVitals/createPatientVitals', data),
  
  // Delete vitals record
  deletePatientVitals: (id: string) =>
    api.delete(`/PatientVitals/deletePatientVitals/${id}`),
};

// Patient Data API (read-only)
export const patientDataAPI = {
  // Allergies
  getAllAllergyList: (rcopiaID: string) =>
    api.get(`/Patient/getAllAllergyList?rcopiaID=${rcopiaID}`),
  
  // Medications
  getAllMedicationList: (rcopiaID: string) =>
    api.get(`/Patient/getAllMedicationList?rcopiaID=${rcopiaID}`),
  
  // Diagnoses/Problems
  getAllDiagnosesList: (rcopiaID: string) =>
    api.get(`/Patient/getAllDiagnosesList?rcopiaID=${rcopiaID}`),
  
  // Prescriptions
  getAllPrescriptionList: (rcopiaID: string) =>
    api.get(`/Patient/getAllPrescriptionList?rcopiaID=${rcopiaID}`),
  getPrescriptionByID: (id: string) =>
    api.get(`/Patient/getPrescriptionByID/${id}`),
  
  // Documents
  getAllDocument: (patientId: string) =>
    api.get(`/Patient/getAllDocument/${patientId}`),
  getDocumentById: (id: string) =>
    api.get(`/Patient/getDocumentById/${id}`),
  downloadDocument: (id: string) =>
    api.get(`/Patient/downloadDocument/${id}`, { responseType: 'blob' }),
  
  // Labs
  getAllLabDocuments: (labId: string) =>
    api.get(`/LabDetails/getAllLabDocuments/${labId}`),
  getLabDocumentById: (id: string) =>
    api.get(`/LabDetails/getLabDocumentById/${id}`),
  downloadLabDocument: (id: string) =>
    api.get(`/LabDetails/downloadLabDocument/${id}`, { responseType: 'blob' }),
  
  // History
  getAllHistoryCategories: () =>
    api.get('/Patient/getAllHistoryCategories'),
  getAllPatientHistory: (patientId: string) =>
    api.get(`/Patient/getAllPatientHistory/${patientId}`),
  getPatientHistoryById: (id: string) =>
    api.get(`/Patient/getPatientHistoryById/${id}`),
  
  // Notes
  getPatientWiseNotesList: (data: Record<string, any>) =>
    api.post('/Patient/getPatientWiseNotesList', data),
  getPatientNoteById: (id: string) =>
    api.get(`/Patient/getPatientNoteById/${id}`),
  getSoapNotesByPatientId: (patientId: string) =>
    api.get(`/Patient/getSoapNotesByPatientId/${patientId}`),
  downloadNotes: (id: string) =>
    api.get(`/Patient/downloadNotes/${id}`, { responseType: 'blob' }),
  
  // Immunizations
  getPatientImmunizationList: (patientId: string) =>
    api.get(`/Patient/getPatientImmunizationList/${patientId}`),
  getPatientImmunizationById: (id: string) =>
    api.get(`/Patient/getPatientImmunizationById/${id}`),
  downloadImmunization: (id: string) =>
    api.get(`/Patient/downloadImmunization/${id}`, { responseType: 'blob' }),
  
  // Invoices
  getInvoicesByPatientId: (patientId: string) =>
    api.get(`/Invoice/getInvoicesByPatientId/${patientId}`),

  // Preventive Screening
  getScreeningsByPatientId: (patientId: string) =>
    api.get(`/screening/getScreeningsByPatientId/${patientId}`),

  // FaceSheet
  getFaceSheet: (patientId: string) =>
    api.get(`/Patient/facesheet/${patientId}`),
  
  // Patient Info
  getPatientById: (id: string) =>
    api.get(`/Patient/getPatientById/${id}`),
  
  // Demographics
  getPatientDemographics: (patientId: string) =>
    api.get(`/Patient/getPatientDemographics/${patientId}`),
  
  // Lab Orders
  getLabOrdersByPatient: (patientId: string, page: number = 1, limit: number = 20) =>
    api.get(`/lab-orders/by-patient/${patientId}`, {
      params: { page, limit },
    }),
  getLabOrderById: (labOrderId: string) =>
    api.get(`/lab-orders/${labOrderId}`),
};

// Premium Subscription API (Stripe-based) - legacy
export const premiumSubscriptionAPI = {
  createCheckoutSession: (data?: Record<string, unknown>) =>
    api.post('/premium-subscription/create-checkout-session', data || {}),
  createPortalSession: (returnUrl?: string) =>
    api.post('/premium-subscription/create-portal-session', { returnUrl }),
  getPremiumStatus: () =>
    api.get('/premium-subscription/status'),
};

// Subscription API (unified subscription data from /Patient-Portal/subscription)
export const patientSubscriptionAPI = {
  getSubscription: (patientId: string) =>
    api.get('/Patient-Portal/subscription', { params: { patientId } }),

  getPlans: () =>
    api.get('/Patient-Portal/subscription/plans'),

  createCheckoutSession: (data: {
    patientId: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    embedded?: boolean;
    successUrl?: string;
    cancelUrl?: string;
  }) => api.post('/Patient-Portal/subscription/create-checkout-session', data),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () =>
    api.get('/notifications'),
  
  markAsRead: (notificationId: string) =>
    api.put(`/notifications/${notificationId}/read`),
  
  deleteNotification: (notificationId: string) =>
    api.delete(`/notifications/${notificationId}`),
};

// AI Health Insights API
export const aiHealthInsightsAPI = {
  getLabAbnormalHighlights: (labOrderId: string) =>
    api.get(`/ai/health-insights/lab-abnormal-highlights/${labOrderId}`),
  explainLabReport: (data: { labId: string; labData?: any }) =>
    api.post('/ai/health-insights/explain-lab-report', data),
  explainVisitSummary: (data: { noteId: string; language?: string }) =>
    api.post('/ai/health-insights/explain-visit-summary', data),
  askAboutVisit: (data: { noteId: string; question: string }) =>
    api.post('/ai/health-insights/ask-about-visit', data),
  getPreventiveSuggestions: (patientId: string) =>
    api.get(`/ai/health-insights/preventive-suggestions/${patientId}`),
  getNextVisitPrep: (patientId: string) =>
    api.get(`/ai/health-insights/next-visit-prep/${patientId}`),
  getCareGaps: (patientId: string) =>
    api.get(`/ai/health-insights/care-gaps/${patientId}`),
  getHealthScore: (patientId: string) =>
    api.get(`/ai/health-insights/health-score/${patientId}`),
  getLabComparison: (patientId: string) =>
    api.get(`/ai/health-insights/lab-comparison/${patientId}`),
  explainPatientDocument: (documentId: string) =>
    api.post('/ai/health-insights/explain-patient-document', { documentId }),
};

// AI Chatbot API – structured payload (same as Provider chatbot)
export interface AiChatbotStructuredPayload {
  systemContent: string;
  query: string;
  maxTokens?: number;
  temperature?: number;
}

export const aiChatbotAPI = {
  /** Send structured AI payload (patient context embedded in query). Same format as Provider chatbot. */
  sendStructuredMessage: (payload: AiChatbotStructuredPayload) =>
    api.post<{ status?: string; message?: { role: string; content: string } }>('/api/ai/chatbot', payload),

  /** Legacy: send only patientId + message (backend may build context). */
  sendMessage: (patientId: string, message: string) =>
    api.post<{ data?: { response?: string; message?: string }; response?: string; message?: string }>('/api/ai/chatbot', {
      patientId,
      message,
    }),
};

// AI Triage – symptom assessment and routing
export interface TriageCompletionPayload {
  userContent: string;
  patientId: string | null;
  sessionId: string | null;
  resetConversation?: boolean;
  /** When true, backend returns final triage guidance (skip remaining questions). */
  forceComplete?: boolean;
}

export interface TriageCompletionData {
  symptomsIdentified?: string[];
  riskLevel?: string;
  guidance?: string;
  followUpQuestion?: string | null;
  disclaimer?: string;
}

export interface TriageCompletionResponse {
  success: boolean;
  data?: TriageCompletionData;
  sessionId?: string;
  conversationLength?: number;
  isNewSession?: boolean;
  model?: string;
  timestamp?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  patientHistoryIncluded?: boolean;
  error?: string;
  message?: string;
}

const TRIAGE_TIMEOUT_MS = 60000;

export const triageAPI = {
  completion: (
    payload: TriageCompletionPayload,
    config?: { signal?: AbortSignal }
  ) =>
    api.post<TriageCompletionResponse>('/triage/completion', payload, {
      timeout: TRIAGE_TIMEOUT_MS,
      ...config,
    }),
};

export default api;

