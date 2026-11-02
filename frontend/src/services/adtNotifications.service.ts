import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';

export type RecipientKind = 'pcp' | 'post_acute' | 'hie' | 'other';
export type RecipientTransport = 'stub' | 'https_webhook' | 'mllp' | 'email' | 'direct';

export interface NotificationRecipient {
    id: string;
    name: string;
    kind: RecipientKind;
    transport: RecipientTransport;
    endpoint: string;
    hasSecret: boolean;
    enabled: boolean;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface NotificationRecipientInput {
    name: string;
    kind: RecipientKind;
    transport: RecipientTransport;
    endpoint?: string;
    authHeaderSecret?: string;
    enabled?: boolean;
}

export type AdtEventType = 'A01' | 'A02' | 'A03' | 'A08';

export interface AdtNotificationLogRow {
    id: string;
    encounterId: string;
    patientId: string | null;
    patientName: string | null;
    eventType: AdtEventType;
    recipientId: string | null;
    recipientName: string;
    transport: RecipientTransport;
    status: 'queued' | 'sent' | 'failed';
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
    createdAt: string;
    message: string;
}

export const ADT_EVENT_LABELS: Record<AdtEventType, string> = { A01: 'Admission', A02: 'Transfer', A03: 'Discharge', A08: 'Update' };
export const RECIPIENT_KIND_LABELS: Record<RecipientKind, string> = { pcp: 'Primary care physician', post_acute: 'Post-acute provider', hie: 'Health information exchange', other: 'Other' };
export const TRANSPORT_LABELS: Record<RecipientTransport, string> = { stub: 'Stub (log only)', https_webhook: 'HTTPS webhook', mllp: 'HL7 MLLP (TCP)', email: 'Email', direct: 'Direct secure messaging' };

const unwrap = <T,>(body: unknown): T => (body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T));

export async function listRecipients(): Promise<NotificationRecipient[]> {
    const { data } = await api.get('/api/notification-recipients');
    const raw = unwrap<unknown>(data);
    return Array.isArray(raw) ? (raw as NotificationRecipient[]) : [];
}

export async function createRecipient(body: NotificationRecipientInput): Promise<ServiceResult<NotificationRecipient>> {
    try {
        const { data } = await api.post('/api/notification-recipients', body);
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not save recipient') };
    }
}

export async function updateRecipient(id: string, body: Partial<NotificationRecipientInput>): Promise<ServiceResult<NotificationRecipient>> {
    try {
        const { data } = await api.put(`/api/notification-recipients/${encodeURIComponent(id)}`, body);
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not update recipient') };
    }
}

export async function deleteRecipient(id: string): Promise<ServiceResult<null>> {
    try {
        await api.delete(`/api/notification-recipients/${encodeURIComponent(id)}`);
        return { ok: true, data: null };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not remove recipient') };
    }
}

export async function testRecipient(id: string): Promise<ServiceResult<{ ok: boolean; detail?: string; error?: string; message: string }>> {
    try {
        const { data } = await api.post(`/api/notification-recipients/${encodeURIComponent(id)}/test`, {});
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Test send failed') };
    }
}

export async function listAdtNotifications(params: { encounterId?: string; patientId?: string; status?: 'queued' | 'sent' | 'failed'; limit?: number } = {}): Promise<AdtNotificationLogRow[]> {
    const { data } = await api.get('/api/adt-notifications', { params });
    const raw = unwrap<unknown>(data);
    return Array.isArray(raw) ? (raw as AdtNotificationLogRow[]) : [];
}

/** Re-delivers right now (synchronous); the pg-boss retry path is `retry`. */
export async function deliverNow(id: string): Promise<ServiceResult<AdtNotificationLogRow>> {
    try {
        const { data } = await api.post(`/api/adt-notifications/${encodeURIComponent(id)}/deliver-now`, {});
        return { ok: true, data: unwrap(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Retry failed') };
    }
}
