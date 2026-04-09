import axios from 'axios';
import { notifyAccessTokenRefreshed, triggerAuthClear } from './auth-events';

export const API_BASE_URL =
  (import.meta.env.VITE_EMR_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  // 'http://localhost:1338';
'https://devapi.mdcareproviders.com';
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';

/** Axios instance without auth interceptors — used only for `/auth/refresh` (same as provider portal). */
const refreshHttp = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
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

export function getStoredAccessToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  return t && t.trim() ? t.trim() : null;
}

export function getStoredRefreshToken(): string | null {
  const raw = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export function persistAuthPair(accessToken: string, refreshToken?: string | null): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken != null && String(refreshToken).trim()) {
    localStorage.setItem(REFRESH_TOKEN_KEY, String(refreshToken).trim());
  }
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function shouldBypassRefreshForUrl(url: string): boolean {
  const u = url || '';
  return (
    u.includes('/login') ||
    u.includes('/auth/refresh') ||
    u.includes('/resetPassword') ||
    u.includes('/forgotPassword') ||
    u.includes('/Patient-Portal/patientUserlogin')
  );
}

let refreshInFlight: Promise<string | null> | null = null;

type RefreshResponse = { token?: string; refreshToken?: string };

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const rt = getStoredRefreshToken();
  if (!rt) return null;

  refreshInFlight = (async () => {
    try {
      const res = await refreshHttp.post<RefreshResponse>('/auth/refresh', { refreshToken: rt });
      const { token, refreshToken } = res.data || {};
      if (token) {
        persistAuthPair(token, refreshToken ?? undefined);
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
