import axios from 'axios';
import { notifyAccessTokenRefreshed, triggerAuthClear } from './auth-events';

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_EMR_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
  if (configured) return configured;
  // SEC-19: this used to silently fall back to a hardcoded third-party domain
  // (devapi.mdcareproviders.com) — a misconfigured deployment would send every request there. Fail
  // loudly instead; the only convenience fallback is this app's own backend, for local dev only.
  if (import.meta.env.DEV) {
    console.error('[auth] VITE_EMR_API_BASE_URL is not set — falling back to http://localhost:4000 for local dev only.');
    return 'http://localhost:4000';
  }
  console.error('[auth] VITE_EMR_API_BASE_URL is not set. The app cannot reach a backend.');
  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Axios instance without auth interceptors — used only for `/auth/refresh`. withCredentials is
 *  required so the browser sends the httpOnly refresh-token cookie (SEC-09). */
const refreshHttp = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function decodeJwtExp(accessToken: string): number | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Access token is past `exp` (strict; used for bootstrap / guards). */
export function isAccessTokenExpired(accessToken: string): boolean {
  const exp = decodeJwtExp(accessToken);
  if (exp == null) return false;
  return exp < Math.floor(Date.now() / 1000);
}

/** Missing access token or within `skewSec` of expiry — refresh before the request (provider-style). */
export function accessTokenNeedsRefresh(accessToken: string | null, skewSec = 60): boolean {
  if (!accessToken) return true;
  const exp = decodeJwtExp(accessToken);
  if (exp == null) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp <= nowSec + skewSec;
}

// SEC-09: the access token now lives in memory only, not localStorage — any XSS on this page can no
// longer read it back out of storage after the fact. It's lost on a full page reload by design;
// bootstrapAuth() (store/authSlice.tsx) re-derives it from the httpOnly refresh cookie on load.
let inMemoryAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  return inMemoryAccessToken;
}

/** `refreshToken` is accepted for call-site compatibility but ignored — the server sets it as an
 *  httpOnly cookie now, never in a JSON body a script could read (SEC-09). */
export function persistAuthPair(accessToken: string, _refreshToken?: string | null): void {
  inMemoryAccessToken = accessToken;
}

export function clearStoredTokens(): void {
  inMemoryAccessToken = null;
}

export function shouldBypassRefreshForUrl(url: string): boolean {
  const u = url || '';
  return (
    u.includes('/login') ||
    u.includes('/auth/refresh') ||
    u.includes('/auth/register') ||
    u.includes('/auth/reset-password') ||
    u.includes('/resetPassword') ||
    u.includes('/forgotPassword') ||
    u.includes('/auth/mfa/verify') ||
    u.includes('/Patient-Portal/patientUserlogin')
  );
}

let refreshInFlight: Promise<string | null> | null = null;

type RefreshResponse = { token?: string };

/** No way to check for a stored refresh token anymore (it's httpOnly) — just attempt it; the server
 *  rejects with 401 if there's no valid cookie, same as any other failed refresh. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await refreshHttp.post<RefreshResponse>('/auth/refresh');
      const { token } = res.data || {};
      if (token) {
        persistAuthPair(token);
        notifyAccessTokenRefreshed(token);
        return token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function clearSessionAfterAuthFailure(): void {
  clearStoredTokens();
  triggerAuthClear();
}
