/**
 * Patient-facing API client — separate credential space from staff authSlice / platformApi.
 */
import axios from 'axios';
import { BASE_URL } from './api';

const PATIENT_TOKEN_KEY = 'patientAccessToken';
const PATIENT_ACCOUNT_KEY = 'patientAccessAccount';

export type PatientSessionAccount = {
    id: string;
    patientId: string;
    email: string;
    tenantId?: string;
};

export const getPatientToken = (): string | null => localStorage.getItem(PATIENT_TOKEN_KEY);

export const getPatientAccount = (): PatientSessionAccount | null => {
    const raw = localStorage.getItem(PATIENT_ACCOUNT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as PatientSessionAccount;
    } catch {
        return null;
    }
};

export const clearPatientSession = () => {
    localStorage.removeItem(PATIENT_TOKEN_KEY);
    localStorage.removeItem(PATIENT_ACCOUNT_KEY);
};

const setPatientSession = (token: string, account: PatientSessionAccount) => {
    localStorage.setItem(PATIENT_TOKEN_KEY, token);
    localStorage.setItem(PATIENT_ACCOUNT_KEY, JSON.stringify(account));
};

const patientApi = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

patientApi.interceptors.request.use((config) => {
    const token = getPatientToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
});

patientApi.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401) clearPatientSession();
        return Promise.reject(error);
    },
);

type Envelope<T> = { status: string; data?: T; message?: string };

export const patientAuthAPI = {
    setPassword: async (token: string, newPassword: string, confirmPassword: string) => {
        const res = await patientApi.post<Envelope<{ ok?: boolean }>>('/patient-auth/set-password', {
            token,
            newPassword,
            confirmPassword,
        });
        return res.data;
    },
    login: async (email: string, password: string, tenantId?: string) => {
        const res = await patientApi.post<
            Envelope<{ token: string; patientId: string; tenantId: string; email: string }>
        >('/patient-auth/login', {
            email,
            password,
            tenantId,
        });
        const payload = res.data.data;
        if (!payload?.token || !payload.patientId) throw new Error(res.data.message || 'Login failed');
        const account: PatientSessionAccount = {
            id: payload.patientId,
            patientId: payload.patientId,
            email: payload.email,
            tenantId: payload.tenantId,
        };
        setPatientSession(payload.token, account);
        return account;
    },
    forgotPassword: async (email: string, tenantId?: string) => {
        const res = await patientApi.post<Envelope<{ emailSent?: boolean }>>('/patient-auth/forgot-password', { email, tenantId });
        return res.data;
    },
    logout: () => clearPatientSession(),
};

export const patientOAuthAPI = {
    decide: async (body: {
        allow: boolean;
        client_id: string;
        redirect_uri: string;
        scope: string;
        state?: string;
        code_challenge: string;
        code_challenge_method?: string;
    }) => {
        const res = await patientApi.post<Envelope<{ redirectUrl: string }>>('/oauth/authorize/decision', body);
        const redirectUrl = res.data.data?.redirectUrl;
        if (!redirectUrl) throw new Error(res.data.message || 'Authorization failed');
        return redirectUrl;
    },
};

export default patientApi;
