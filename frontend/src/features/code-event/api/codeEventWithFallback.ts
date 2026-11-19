import {
    apiActivateCodeEvent,
    apiCloseCodeEvent,
    apiFetchActiveCodeEventsByUnit,
    apiFetchCodeEventById,
    apiFetchCodeEventByPatient,
    apiGenerateCodeEventNote,
    apiSaveCodeEventNote,
    apiUpdateCodeEventTeam,
    apiUpdateCodeEventTimeline,
} from './codeEventApi';
import { USE_CODE_EVENT_MOCK } from '../config/codeEventMock.config';
import {
    mockActivateCodeEvent,
    mockCloseCodeEvent,
    mockFetchActiveCodeEventsByUnit,
    mockFetchCodeEventById,
    mockFetchCodeEventByPatient,
    mockGenerateCodeEventNote,
    mockListOnShiftStaff,
    mockSaveCodeEventNote,
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


/** Pure switch: real API unless VITE_CODE_EVENT_MOCK=true. A code-blue timeline is never fabricated on error. */
export function getLastCodeEventDataSource(): CodeEventDataSource {
    return USE_CODE_EVENT_MOCK ? 'mock' : 'api';
}

function pick<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    return USE_CODE_EVENT_MOCK ? mockFn() : apiFn();
}

export async function activateCodeEvent(
    payload: ActivateCodeEventPayload,
    meta?: { patientName?: string; patientMrn?: string; unitId?: string }
): Promise<CodeEventRecord> {
    return pick(() => apiActivateCodeEvent(payload), () => mockActivateCodeEvent(payload, meta));
}

export async function fetchActiveCodeEventsByUnit(unitId: string): Promise<CodeEventSummary[]> {
    return pick(() => apiFetchActiveCodeEventsByUnit(unitId), () => mockFetchActiveCodeEventsByUnit(unitId));
}

export async function fetchCodeEventByPatient(patientId: string): Promise<CodeEventRecord | null> {
    return pick(() => apiFetchCodeEventByPatient(patientId), () => mockFetchCodeEventByPatient(patientId));
}

export async function fetchCodeEventById(eventId: string): Promise<CodeEventRecord | null> {
    return pick(() => apiFetchCodeEventById(eventId), () => mockFetchCodeEventById(eventId));
}

export async function updateCodeEventTimeline(
    eventId: string,
    payload: CodeEventTimelinePayload
): Promise<CodeEventRecord> {
    return pick(() => apiUpdateCodeEventTimeline(eventId, payload), () => mockUpdateCodeEventTimeline(eventId, payload));
}

export async function updateCodeEventTeam(eventId: string, payload: CodeEventTeamPayload): Promise<CodeEventRecord> {
    return pick(() => apiUpdateCodeEventTeam(eventId, payload), () => mockUpdateCodeEventTeam(eventId, payload));
}

export async function closeCodeEvent(eventId: string, payload: CloseCodeEventPayload): Promise<CodeEventRecord> {
    return pick(() => apiCloseCodeEvent(eventId, payload), () => mockCloseCodeEvent(eventId, payload));
}

export async function generateCodeEventNote(eventId: string): Promise<{ noteText: string }> {
    return pick(() => apiGenerateCodeEventNote(eventId), () => mockGenerateCodeEventNote(eventId));
}

export async function saveCodeEventNote(eventId: string): Promise<{ noteId: string; noteText: string }> {
    return pick(() => apiSaveCodeEventNote(eventId), () => mockSaveCodeEventNote(eventId));
}

/** Team picker options. Still a static list: there is no on-shift staff endpoint for code events yet. */
export async function listOnShiftStaffForCodeEvent(): Promise<{ id: string; name: string; role: string }[]> {
    return mockListOnShiftStaff();
}
