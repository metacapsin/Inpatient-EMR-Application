import api from './api';

import { FOLLOW_UP_NOTE_TYPE } from '../features/chart-notes/followUpProgress.types';

/** Free-text / light types + structured CPT forms enabled in facesheet Notes. */
export const PROGRESS_NOTE_TYPE = 'Office Note Free Text Progress Note' as const;
export const HP_NOTE_TYPE = 'Office Note Free Text HP' as const;
export const TCM_NOTE_TYPE = 'Office Note Free Text TCM Note' as const;
export const CCM_NOTE_TYPE = 'Office Note Free Text CCM Note' as const;
export const OFFICE_FORM_NOTE_TYPE = 'Office Form' as const;
export const WORK_NOTE_TYPE = 'Work Note' as const;
export const PHONE_NOTE_TYPE = 'Phone Note' as const;
export { FOLLOW_UP_NOTE_TYPE };

export const PHASE1_NOTE_TYPES = [
    PROGRESS_NOTE_TYPE,
    HP_NOTE_TYPE,
    TCM_NOTE_TYPE,
    CCM_NOTE_TYPE,
    OFFICE_FORM_NOTE_TYPE,
    WORK_NOTE_TYPE,
    PHONE_NOTE_TYPE,
    FOLLOW_UP_NOTE_TYPE,
] as const;
export type Phase1NoteType = (typeof PHASE1_NOTE_TYPES)[number];

export const NOTE_TYPE_SHORT_LABEL: Record<Phase1NoteType, string> = {
    [PROGRESS_NOTE_TYPE]: 'Progress Note',
    [HP_NOTE_TYPE]: 'H&P Note',
    [TCM_NOTE_TYPE]: 'TCM Note',
    [CCM_NOTE_TYPE]: 'CCM Note',
    [OFFICE_FORM_NOTE_TYPE]: 'Office Form',
    [WORK_NOTE_TYPE]: 'Work Note',
    [PHONE_NOTE_TYPE]: 'Phone Note',
    [FOLLOW_UP_NOTE_TYPE]: 'Follow-Up Progress',
};

export const STRUCTURED_NOTE_TYPES = [FOLLOW_UP_NOTE_TYPE] as const;

export function isStructuredNoteType(value: string): boolean {
    return (STRUCTURED_NOTE_TYPES as readonly string[]).includes(value);
}

export const CHART_NOTE_STATUSES = ['In Draft', 'Completed', 'Marked in Error'] as const;
export type ChartNoteStatus = (typeof CHART_NOTE_STATUSES)[number];

export function isPhase1NoteType(value: string): value is Phase1NoteType {
    return (PHASE1_NOTE_TYPES as readonly string[]).includes(value);
}

export interface ChartNoteProvider {
    id?: string;
    _id?: string;
    name: string;
}

export interface PatientChartNote {
    id: string;
    _id: string;
    patientId: string;
    encounterId: string;
    notesType: string;
    notesText: string;
    structuredPayload?: Record<string, unknown> | null;
    date: string;
    time?: string;
    assignedProvider: ChartNoteProvider | null;
    noteStatus: ChartNoteStatus;
    providerSigned?: string;
    signedDate?: string;
    signedTime?: string;
    inErrorReason?: string | null;
    createdByName?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ChartNoteListFilters {
    patientId: string;
    encounterId?: string;
    notesType?: string;
    noteStatus?: string;
    assignedProvider?: string;
    includeInError?: boolean;
}

export interface CreateChartNotePayload {
    patientId: string;
    encounterId: string;
    notesType?: Phase1NoteType;
    notesText: string;
    structuredPayload?: Record<string, unknown> | null;
    date: string;
    time?: string;
    assignedProviderId: string;
    assignedProviderName?: string;
    providerSigned?: string;
    signedDate?: string;
    signedTime?: string;
    noteStatus?: 'In Draft' | 'Completed';
}

export interface UpdateChartNotePayload {
    id: string;
    notesText?: string;
    structuredPayload?: Record<string, unknown> | null;
    date?: string;
    time?: string | null;
    assignedProviderId?: string;
    assignedProviderName?: string;
    encounterId?: string;
    providerSigned?: string;
    signedDate?: string;
    signedTime?: string;
    noteStatus?: 'In Draft' | 'Completed';
}

function unwrapData<T>(raw: unknown): T {
    if (raw && typeof raw === 'object') {
        const obj = raw as { data?: T; status?: string };
        if ('data' in obj) return obj.data as T;
    }
    return raw as T;
}

export async function listPatientChartNotes(filters: ChartNoteListFilters): Promise<PatientChartNote[]> {
    const { data } = await api.post('/Patient/getPatientWiseNotesList', {
        includeInError: true,
        ...filters,
    });
    const rows = unwrapData<PatientChartNote[]>(data);
    return Array.isArray(rows) ? rows : [];
}

export async function getPatientChartNoteById(id: string): Promise<PatientChartNote> {
    const { data } = await api.get(`/Patient/getPatientNoteById/${encodeURIComponent(id)}`);
    return unwrapData<PatientChartNote>(data);
}

export async function createPatientChartNote(payload: CreateChartNotePayload): Promise<PatientChartNote> {
    const { data } = await api.post('/Patient/createPatientNote', {
        ...payload,
        notesType: payload.notesType || PROGRESS_NOTE_TYPE,
    });
    return unwrapData<PatientChartNote>(data);
}

export async function updatePatientChartNote(payload: UpdateChartNotePayload): Promise<PatientChartNote> {
    const { data } = await api.put('/Patient/updatePatientNote', payload);
    return unwrapData<PatientChartNote>(data);
}

export async function signPatientChartNote(id: string, providerSigned?: string): Promise<PatientChartNote> {
    const { data } = await api.post(`/Patient/signPatientNote/${encodeURIComponent(id)}`, {
        providerSigned,
    });
    return unwrapData<PatientChartNote>(data);
}

export async function markChartNoteInError(id: string, reason: string): Promise<PatientChartNote> {
    const { data } = await api.put(`/Patient/markNoteInError/${encodeURIComponent(id)}`, { reason });
    return unwrapData<PatientChartNote>(data);
}

export async function restoreChartNote(id: string): Promise<PatientChartNote> {
    const { data } = await api.put(`/Patient/restoreNote/${encodeURIComponent(id)}`);
    return unwrapData<PatientChartNote>(data);
}

export async function deletePatientChartNote(id: string): Promise<void> {
    await api.delete(`/Patient/deletePatientNote/${encodeURIComponent(id)}`);
}

export async function fetchProviderOptions(): Promise<Array<{ id: string; name: string }>> {
    const { data } = await api.get('/ProviderProfile/getProviderList');
    const rows = unwrapData<Array<{ id?: string; _id?: string; name?: string; fullName?: string }>>(data);
    if (!Array.isArray(rows)) return [];
    return rows
        .map((p) => ({
            id: String(p.id || p._id || ''),
            name: String(p.name || p.fullName || '').trim() || 'Provider',
        }))
        .filter((p) => p.id);
}

export async function fetchActiveEncountersForPatient(
    patientId: string,
): Promise<Array<{ id: string; label: string; admittedAt?: string }>> {
    const { data } = await api.get('/api/admissions/active', { params: { patientId } });
    const rows = unwrapData<
        Array<{
            id?: string;
            _id?: string;
            encounterId?: string;
            admittedAt?: string;
            admitted_at?: string;
            admissionTimestamp?: string;
            admissionType?: string;
            diagnosis?: string;
            patientName?: string;
        }>
    >(data);
    if (!Array.isArray(rows)) return [];
    return rows.map((e) => {
        const id = String(e.id || e._id || e.encounterId || '');
        const admitted = e.admissionTimestamp || e.admittedAt || e.admitted_at;
        const when = admitted ? new Date(admitted).toLocaleString() : '';
        const bits = [e.admissionType, e.diagnosis, when].filter(Boolean);
        return {
            id,
            label: bits.length ? `Encounter · ${bits.join(' · ')}` : `Encounter ${id.slice(0, 8)}`,
            admittedAt: admitted,
        };
    });
}

export function previewNoteText(text: string, max = 100): string {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

export function formatVisitDateDisplay(value?: string): string {
    if (!value) return '—';
    try {
        const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T12:00:00`)
            : new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
        return value;
    }
}
