import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';

type Envelope<T> = { status: string; data?: T; message?: string };

const unwrap = <T>(body: unknown): T =>
    body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T);

export interface MfaEnrollment {
    secret: string;
    otpauthUri: string;
}

export async function enrollMfa(): Promise<ServiceResult<MfaEnrollment>> {
    try {
        const { data } = await api.post<Envelope<MfaEnrollment>>('/auth/mfa/enroll');
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not start MFA enrollment') };
    }
}

export async function confirmMfa(code: string): Promise<ServiceResult<{ backupCodes: string[] }>> {
    try {
        const { data } = await api.post<Envelope<{ backupCodes: string[] }>>('/auth/mfa/confirm', { code });
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Invalid code') };
    }
}

export async function disableMfa(password: string): Promise<ServiceResult<void>> {
    try {
        await api.post('/auth/mfa/disable', { password });
        return { ok: true, data: undefined };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not disable MFA') };
    }
}

export async function signOutAllDevices(): Promise<ServiceResult<void>> {
    try {
        await api.post('/auth/logout-all');
        return { ok: true, data: undefined };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not sign out of other devices') };
    }
}
