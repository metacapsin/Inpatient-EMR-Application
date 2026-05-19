import api from '../../../services/api';
import type {
    ActivateCodeEventPayload,
    CloseCodeEventPayload,
    CodeEventRecord,
    CodeEventSummary,
    CodeEventTeamPayload,
    CodeEventTimelinePayload,
} from '../../../types/codeEvent';

type ApiEnvelope<T> = { data?: T; status?: string; message?: string };

function unwrapOne(raw: unknown): CodeEventRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.data && typeof o.data === 'object') return o.data as CodeEventRecord;
    return raw as CodeEventRecord;
}

function unwrapList(raw: unknown): CodeEventSummary[] {
    if (Array.isArray(raw)) return raw as CodeEventSummary[];
    if (raw && typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.data)) return o.data as CodeEventSummary[];
        if (Array.isArray(o.events)) return o.events as CodeEventSummary[];
    }
    return [];
}

export async function apiActivateCodeEvent(payload: ActivateCodeEventPayload): Promise<CodeEventRecord> {
    const { data } = await api.post<ApiEnvelope<CodeEventRecord> | CodeEventRecord>('/api/CodeEvent/activate', payload);
    return unwrapOne(data) ?? (data as CodeEventRecord);
}

export async function apiFetchActiveCodeEventsByUnit(unitId: string): Promise<CodeEventSummary[]> {
    const { data } = await api.get<ApiEnvelope<CodeEventSummary[]> | CodeEventSummary[]>(
        `/api/CodeEvent/active/${encodeURIComponent(unitId)}`
    );
    if (data && typeof data === 'object' && 'data' in data) {
        return unwrapList((data as ApiEnvelope<CodeEventSummary[]>).data);
    }
    return unwrapList(data);
}

export async function apiFetchCodeEventByPatient(patientId: string): Promise<CodeEventRecord | null> {
    const { data } = await api.get<ApiEnvelope<CodeEventRecord> | CodeEventRecord>(
        `/api/CodeEvent/patient/${encodeURIComponent(patientId)}`
    );
    return unwrapOne(data);
}

export async function apiFetchCodeEventById(eventId: string): Promise<CodeEventRecord | null> {
    const { data } = await api.get<ApiEnvelope<CodeEventRecord> | CodeEventRecord>(
        `/api/CodeEvent/${encodeURIComponent(eventId)}`
    );
    return unwrapOne(data);
}

export async function apiUpdateCodeEventTimeline(
    eventId: string,
    payload: CodeEventTimelinePayload
): Promise<CodeEventRecord> {
    const { data } = await api.put<ApiEnvelope<CodeEventRecord> | CodeEventRecord>(
        `/api/CodeEvent/${encodeURIComponent(eventId)}/timeline`,
        payload
    );
    return unwrapOne(data) ?? (data as CodeEventRecord);
}

export async function apiUpdateCodeEventTeam(eventId: string, payload: CodeEventTeamPayload): Promise<CodeEventRecord> {
    const { data } = await api.put<ApiEnvelope<CodeEventRecord> | CodeEventRecord>(
        `/api/CodeEvent/${encodeURIComponent(eventId)}/team`,
        payload
    );
    return unwrapOne(data) ?? (data as CodeEventRecord);
}

export async function apiCloseCodeEvent(eventId: string, payload: CloseCodeEventPayload): Promise<CodeEventRecord> {
    const { data } = await api.put<ApiEnvelope<CodeEventRecord> | CodeEventRecord>(
        `/api/CodeEvent/${encodeURIComponent(eventId)}/close`,
        payload
    );
    return unwrapOne(data) ?? (data as CodeEventRecord);
}

export async function apiGenerateCodeEventNote(eventId: string): Promise<{ noteText: string }> {
    const { data } = await api.get<ApiEnvelope<{ noteText: string }> | { noteText: string }>(
        `/api/CodeEvent/${encodeURIComponent(eventId)}/generate-note`
    );
    if (data && typeof data === 'object' && 'data' in data) {
        const inner = (data as ApiEnvelope<{ noteText: string }>).data;
        return inner ?? { noteText: '' };
    }
    return (data as { noteText: string }) ?? { noteText: '' };
}
