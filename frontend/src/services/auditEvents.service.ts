import { z } from 'zod';
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type { ServiceResult } from '../types/dischargeReadiness';
import { auditEventSchema, type AuditEvent, type AuditEventFilters } from '../types/auditEvents';

type Envelope<T> = { status: string; data?: T; message?: string };

const unwrap = <T>(body: unknown): T =>
    body && typeof body === 'object' && 'data' in (body as object) ? (body as { data: T }).data : (body as T);

function toQuery(filters: AuditEventFilters = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export async function listAuditEvents(filters: AuditEventFilters = {}): Promise<ServiceResult<AuditEvent[]>> {
    try {
        const { data } = await api.get<Envelope<unknown>>(`/api/audit-events${toQuery(filters)}`);
        return { ok: true, data: z.array(auditEventSchema).parse(unwrap(data) ?? []) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load the audit trail') };
    }
}

export async function downloadAuditEventsCsv(filters: AuditEventFilters = {}): Promise<ServiceResult<void>> {
    try {
        const res = await api.get(`/api/audit-events/export.csv${toQuery(filters)}`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit-events.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return { ok: true, data: undefined };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not export the audit trail') };
    }
}

const aiRequestSchema = z.object({
    id: z.string(),
    userId: z.string().nullable().optional(),
    patientId: z.string().nullable().optional(),
    endpoint: z.string(),
    model: z.string(),
    status: z.enum(['ok', 'error']),
    errorCode: z.string().nullable().optional(),
    latencyMs: z.number().nullable().optional(),
    promptTokens: z.number().nullable().optional(),
    outputTokens: z.number().nullable().optional(),
    createdAt: z.string(),
});
export type AiRequestRow = z.infer<typeof aiRequestSchema>;

export async function listAiRequests(filters: { patientId?: string } = {}): Promise<ServiceResult<AiRequestRow[]>> {
    try {
        const { data } = await api.get<Envelope<unknown>>(`/api/ai/requests${toQuery(filters)}`);
        return { ok: true, data: z.array(aiRequestSchema).parse(unwrap(data) ?? []) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e, 'Could not load the AI request ledger') };
    }
}
