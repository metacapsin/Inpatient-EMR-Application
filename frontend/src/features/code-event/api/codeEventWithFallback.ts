import {
    apiActivateCodeEvent,
    apiCloseCodeEvent,
    apiFetchActiveCodeEventsByUnit,
    apiFetchCodeEventById,
    apiFetchCodeEventByPatient,
    apiGenerateCodeEventNote,
    apiUpdateCodeEventTeam,
    apiUpdateCodeEventTimeline,
} from './codeEventApi';
import { CODE_EVENT_API_TIMEOUT_MS, USE_CODE_EVENT_MOCK } from '../config/codeEventMock.config';
import {
    mockActivateCodeEvent,
    mockCloseCodeEvent,
    mockFetchActiveCodeEventsByUnit,
    mockFetchCodeEventById,
    mockFetchCodeEventByPatient,
    mockGenerateCodeEventNote,
    mockListOnShiftStaff,
    mockUpdateCodeEventTeam,
    mockUpdateCodeEventTimeline,
} from '../../../mocks/codeEventMock';
import type {
    ActivateCodeEventPayload,
    CloseCodeEventPayload,
    CodeEventRecord,
    CodeEventSummary,
    CodeEventTeamPayload,
    CodeEventTimelinePayload,
} from '../../../types/codeEvent';

export type CodeEventDataSource = 'api' | 'mock';

let lastSource: CodeEventDataSource = USE_CODE_EVENT_MOCK ? 'mock' : 'api';

export function getLastCodeEventDataSource(): CodeEventDataSource {
    return lastSource;
}

function setSource(source: CodeEventDataSource): void {
    lastSource = source;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CODE_EVENT_API_TIMEOUT')), ms);
        promise
            .then((v) => {
                clearTimeout(timer);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(timer);
                reject(e);
            });
    });
}

async function callApi<T>(fn: () => Promise<T>): Promise<T> {
    if (!USE_CODE_EVENT_MOCK) return fn();
    return withTimeout(fn(), CODE_EVENT_API_TIMEOUT_MS);
}

async function withMockFallback<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    if (!USE_CODE_EVENT_MOCK) {
        const data = await apiFn();
        setSource('api');
        return data;
    }
    if (lastSource === 'mock') {
        const data = await mockFn();
        setSource('mock');
        return data;
    }
    try {
        const data = await callApi(apiFn);
        setSource('api');
        return data;
    } catch {
        const data = await mockFn();
        setSource('mock');
        return data;
    }
}

export async function activateCodeEvent(
    payload: ActivateCodeEventPayload,
    meta?: { patientName?: string; patientMrn?: string; unitId?: string }
): Promise<CodeEventRecord> {
    return withMockFallback(
        () => apiActivateCodeEvent(payload),
        () => mockActivateCodeEvent(payload, meta)
    );
}

export async function fetchActiveCodeEventsByUnit(unitId: string): Promise<CodeEventSummary[]> {
    return withMockFallback(
        () => apiFetchActiveCodeEventsByUnit(unitId),
        () => mockFetchActiveCodeEventsByUnit(unitId)
    );
}

export async function fetchCodeEventByPatient(patientId: string): Promise<CodeEventRecord | null> {
    return withMockFallback(
        () => apiFetchCodeEventByPatient(patientId),
        () => mockFetchCodeEventByPatient(patientId)
    );
}

export async function fetchCodeEventById(eventId: string): Promise<CodeEventRecord | null> {
    if (!USE_CODE_EVENT_MOCK) return apiFetchCodeEventById(eventId);
    if (lastSource === 'mock') return mockFetchCodeEventById(eventId);
    try {
        const data = await callApi(() => apiFetchCodeEventById(eventId));
        setSource('api');
        return data;
    } catch {
        return mockFetchCodeEventById(eventId);
    }
}

export async function updateCodeEventTimeline(
    eventId: string,
    payload: CodeEventTimelinePayload
): Promise<CodeEventRecord> {
    return withMockFallback(
        () => apiUpdateCodeEventTimeline(eventId, payload),
        () => mockUpdateCodeEventTimeline(eventId, payload)
    );
}

export async function updateCodeEventTeam(eventId: string, payload: CodeEventTeamPayload): Promise<CodeEventRecord> {
    return withMockFallback(
        () => apiUpdateCodeEventTeam(eventId, payload),
        () => mockUpdateCodeEventTeam(eventId, payload)
    );
}

export async function closeCodeEvent(eventId: string, payload: CloseCodeEventPayload): Promise<CodeEventRecord> {
    return withMockFallback(
        () => apiCloseCodeEvent(eventId, payload),
        () => mockCloseCodeEvent(eventId, payload)
    );
}

export async function generateCodeEventNote(eventId: string): Promise<{ noteText: string }> {
    return withMockFallback(
        () => apiGenerateCodeEventNote(eventId),
        () => mockGenerateCodeEventNote(eventId)
    );
}

export async function listOnShiftStaffForCodeEvent(): Promise<{ id: string; name: string; role: string }[]> {
    return mockListOnShiftStaff();
}
