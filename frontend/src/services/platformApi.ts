// Super Admin Console API client. Deliberately separate from `api.ts` / `authSlice`: platform
// admins are a distinct credential space from tenant users (see Phase 1 of the onboarding plan),
// so this talks to its own token storage and never touches the tenant auth state.
import axios from 'axios';
import { BASE_URL } from './api';

const PLATFORM_TOKEN_KEY = 'platformToken';
const PLATFORM_ADMIN_KEY = 'platformAdmin';

export interface PlatformAdmin {
  id: string;
  email: string;
}

export interface Tenant {
  id: string;
  _id: string;
  name: string;
  status: 'trial' | 'active' | 'suspended';
  plan: string | null;
  stripeSubscriptionId: string | null;
  enabledModules: string[];
  onboardingStatus: 'provisioned' | 'in_progress' | 'complete';
  userCount: number;
  createdAt: string;
}

export const getPlatformToken = (): string | null => localStorage.getItem(PLATFORM_TOKEN_KEY);

export const getPlatformAdmin = (): PlatformAdmin | null => {
  const raw = localStorage.getItem(PLATFORM_ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlatformAdmin;
  } catch {
    return null;
  }
};

export const clearPlatformSession = () => {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
  localStorage.removeItem(PLATFORM_ADMIN_KEY);
};

const setPlatformSession = (token: string, admin: PlatformAdmin) => {
  localStorage.setItem(PLATFORM_TOKEN_KEY, token);
  localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin));
};

const platformApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

platformApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) clearPlatformSession();
    return Promise.reject(error);
  }
);

export const platformAuthAPI = {
  login: async (email: string, password: string): Promise<PlatformAdmin> => {
    const res = await platformApi.post('/api/platform/login', { email, password });
    const { token, admin } = res.data.data as { token: string; admin: PlatformAdmin };
    setPlatformSession(token, admin);
    return admin;
  },
  logout: () => clearPlatformSession(),
};

export const platformTenantsAPI = {
  list: async (): Promise<Tenant[]> => {
    const res = await platformApi.get('/api/platform/tenants');
    return res.data.data as Tenant[];
  },
  create: async (data: { name: string; plan?: string; enabledModules?: string[] }): Promise<Tenant> => {
    const res = await platformApi.post('/api/platform/tenants', data);
    return res.data.data as Tenant;
  },
  inviteAdmin: async (
    tenantId: string,
    data: { email: string; firstName?: string; lastName?: string }
  ): Promise<{ id: string; email: string; emailSent: boolean; devSetPasswordToken?: string }> => {
    const res = await platformApi.post(`/api/platform/tenants/${tenantId}/invite-admin`, data);
    return res.data.data;
  },
  update: async (
    tenantId: string,
    data: { status?: Tenant['status']; plan?: string; enabledModules?: string[] }
  ): Promise<Tenant> => {
    const res = await platformApi.patch(`/api/platform/tenants/${tenantId}`, data);
    return res.data.data as Tenant;
  },
  deletionImpact: async (
    tenantId: string
  ): Promise<{ tenantId: string; tenantName: string; patientCount: number; userCount: number; encounterCount: number }> => {
    const res = await platformApi.get(`/api/platform/tenants/${tenantId}/deletion-impact`);
    return res.data.data;
  },
  remove: async (tenantId: string, confirmName: string): Promise<void> => {
    await platformApi.delete(`/api/platform/tenants/${tenantId}`, { data: { confirmName } });
  },
};

export default platformApi;
