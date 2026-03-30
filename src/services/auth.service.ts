import type { AxiosResponse } from 'axios';
import axios from 'axios';
import api from './api';

/** Provider /login expects username (often the same value as email) and password. */
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

/** Normalize token from common API response shapes */
export function normalizeLoginToken(data: unknown): string | null {
  if (data === null || data === undefined || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  if (typeof root.token === 'string' && root.token.length > 0) return root.token;
  const nested = root.data;
  if (nested && typeof nested === 'object') {
    const t = (nested as Record<string, unknown>).token;
    if (typeof t === 'string' && t.length > 0) return t;
  }
  return null;
}

export function parseLoginResponse(data: unknown): {
  token: string;
  user: Record<string, unknown> | null;
  role: string | null;
} | null {
  const token = normalizeLoginToken(data);
  if (!token) return null;
  if (typeof data !== 'object' || data === null) {
    return { token, user: null, role: null };
  }
  const root = data as Record<string, unknown>;
  const user =
    (root.user && typeof root.user === 'object' ? (root.user as Record<string, unknown>) : null) ??
    (root.data &&
    typeof root.data === 'object' &&
    (root.data as Record<string, unknown>).user &&
    typeof (root.data as Record<string, unknown>).user === 'object'
      ? ((root.data as Record<string, unknown>).user as Record<string, unknown>)
      : null);
  const role =
    (typeof root.role === 'string' ? root.role : null) ??
    (user && typeof user.role === 'string' ? user.role : null);
  return { token, user, role };
}

export const authService = {
  login: (body: LoginCredentials): Promise<AxiosResponse<unknown>> => {
    const payload = { username: body.username.trim(), password: body.password.trim() };
    console.log('[login] POST /login payload:', payload);
    return api.post('/login', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  forgotPassword: (body: ForgotPasswordPayload): Promise<AxiosResponse<unknown>> =>
    api.post('/forgotPassword', body),

  /** Clears persisted auth and default axios header (call with Redux logout in UI). */
  clearClientAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('patientData');
    localStorage.removeItem('premiumSubscription');
    localStorage.removeItem('patientLoginResponse');
    localStorage.removeItem('patientEmail');
    delete axios.defaults.headers.common['Authorization'];
  },
};
