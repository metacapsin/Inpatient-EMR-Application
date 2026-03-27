/**
 * Health Monitoring API service.
 * Base path: /api/health/...
 */
import api from './api';

// --- Health Metrics ---
export const healthMetricsAPI = {
  add: (data: Record<string, any>) =>
    api.post('/api/health/metrics/add', data),

  getByPatient: (patientId: string) =>
    api.get(`/api/health/metrics/patient/${patientId}`),

  getTrend: (params?: Record<string, any>) =>
    api.get('/api/health/metrics/trend', { params }),

  getLatest: (params?: Record<string, any>) =>
    api.get('/api/health/metrics/latest', { params }),
};

// --- Conditions ---
export const healthConditionsAPI = {
  create: (data: Record<string, any>) =>
    api.post('/api/health/conditions', data),

  getByPatient: (patientId: string) =>
    api.get(`/api/health/conditions/patient/${patientId}`),

  update: (id: string, data: Record<string, any>) =>
    api.put(`/api/health/conditions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/health/conditions/${id}`),
};

// --- Daily Log ---
export const healthDailyLogAPI = {
  create: (data: Record<string, any>) =>
    api.post('/api/health/daily-log', data),

  getByPatient: (patientId: string) =>
    api.get(`/api/health/daily-log/patient/${patientId}`),
};

// --- Alerts ---
export const healthAlertsAPI = {
  getByPatient: (patientId: string) =>
    api.get(`/api/health/alerts/patient/${patientId}`),

  acknowledge: (id: string) =>
    api.put(`/api/health/alerts/${id}/acknowledge`),

  resolve: (id: string) =>
    api.put(`/api/health/alerts/${id}/resolve`),
};

// --- Chronic Care Dashboard ---
export const chronicDashboardAPI = {
  get: (patientId: string) =>
    api.get(`/api/chronic/dashboard/${patientId}`),
};

// --- Provider ---
export const providerAPI = {
  getPatientRiskList: (params?: Record<string, any>) =>
    api.get('/api/provider/patient-risk-list', { params }),
};

export default {
  metrics: healthMetricsAPI,
  conditions: healthConditionsAPI,
  dailyLog: healthDailyLogAPI,
  alerts: healthAlertsAPI,
  chronicDashboard: chronicDashboardAPI,
  provider: providerAPI,
};
