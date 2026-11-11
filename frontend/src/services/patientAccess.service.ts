import { z } from 'zod';
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';
import { patientAccountSchema, smartClientSchema, type PatientAccountStatus, type SmartClient } from '../types/patientAccess';

type Envelope<T> = { status: string; data?: T; message?: string };

const unwrap = <T>(body: unknown): T =>
    body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T);

export async function getPortalAccount(patientId: string): Promise<ServiceResult<PatientAccountStatus | null>> {
    try {
        const { data } = await api.get<Envelope<unknown>>(`/api/patients/${encodeURIComponent(patientId)}/portal-account`);
        const raw = unwrap(data);
        if (raw == null) return { ok: true, data: null };
        return { ok: true, data: patientAccountSchema.parse(raw) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load portal account') };
    }
}

export async function invitePortalAccount(patientId: string, email?: string): Promise<ServiceResult<PatientAccountStatus>> {
    try {
        const { data } = await api.post<Envelope<unknown>>(`/api/patients/${encodeURIComponent(patientId)}/portal-invite`, email ? { email } : {});
        return { ok: true, data: patientAccountSchema.parse(unwrap(data)) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not send portal invite') };
    }
}

export async function deactivatePortalAccount(patientId: string): Promise<ServiceResult<PatientAccountStatus>> {
    try {
        const { data } = await api.post<Envelope<unknown>>(`/api/patients/${encodeURIComponent(patientId)}/portal-account/deactivate`, {});
        return { ok: true, data: patientAccountSchema.parse(unwrap(data)) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not deactivate portal access') };
    }
}

export async function listSmartClients(): Promise<ServiceResult<SmartClient[]>> {
    try {
        const { data } = await api.get<Envelope<unknown>>('/api/smart-clients');
        return { ok: true, data: z.array(smartClientSchema).parse(unwrap(data) ?? []) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load connected apps') };
    }
}

export async function createSmartClient(body: {
    name: string;
    redirectUris: string[];
    allowedScopes: string[];
    isConfidential?: boolean;
}): Promise<ServiceResult<SmartClient>> {
    try {
        const { data } = await api.post<Envelope<unknown>>('/api/smart-clients', body);
        return { ok: true, data: smartClientSchema.parse(unwrap(data)) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not register app') };
    }
}

export async function updateSmartClient(
    id: string,
    body: Partial<{ name: string; redirectUris: string[]; allowedScopes: string[]; isActive: boolean }>,
): Promise<ServiceResult<SmartClient>> {
    try {
        const { data } = await api.put<Envelope<unknown>>(`/api/smart-clients/${encodeURIComponent(id)}`, body);
        return { ok: true, data: smartClientSchema.parse(unwrap(data)) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not update app') };
    }
}

export async function deleteSmartClient(id: string): Promise<ServiceResult<{ deleted: boolean } | SmartClient>> {
    try {
        const { data } = await api.delete<Envelope<unknown>>(`/api/smart-clients/${encodeURIComponent(id)}`);
        return { ok: true, data: unwrap(data) as { deleted: boolean } };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not remove app') };
    }
}
