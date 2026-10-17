/**
 * In-memory Code Event store — mirrors backend response shape.
 * Used when API is unavailable or USE_CODE_EVENT_MOCK is enabled.
 */

import type {
    ActivateCodeEventPayload,
    CloseCodeEventPayload,
    CodeEventRecord,
    CodeEventSummary,
    CodeEventTeamPayload,
    CodeEventTimelinePayload,
} from '../types/codeEvent';
import { DEFAULT_CODE_EVENT_UNIT_ID } from '../features/code-event/config/codeEventMock.config';
import { listStaff } from '../services/staffScheduling.service';

let nextId = 9000;
function genId(): string {
    nextId += 1;
    return `code-${nextId}`;
}

function genTimelineId(): string {
    nextId += 1;
    return `tl-${nextId}`;
}

const eventsById = new Map<string, CodeEventRecord>();
const activeByPatient = new Map<string, string>();
const activeByUnit = new Map<string, Set<string>>();

function delay<T>(value: T, ms = 100): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function touchUnit(unitId: string, eventId: string, add: boolean): void {
    const set = activeByUnit.get(unitId) ?? new Set<string>();
    if (add) set.add(eventId);
    else set.delete(eventId);
    if (set.size === 0) activeByUnit.delete(unitId);
    else activeByUnit.set(unitId, set);
}

function toSummary(e: CodeEventRecord): CodeEventSummary {
    return {
        id: e.id,
        patientId: e.patientId,
        patientName: e.patientName,
        patientMrn: e.patientMrn,
        eventType: e.eventType,
        location: e.location,
        status: e.status,
        calledAt: e.calledAt,
        teamLeadName: e.teamLeadName,
    };
}

export async function mockActivateCodeEvent(
    payload: ActivateCodeEventPayload,
    meta?: { patientName?: string; patientMrn?: string; unitId?: string }
): Promise<CodeEventRecord> {
    const existing = activeByPatient.get(payload.patientId);
    if (existing) {
        const prev = eventsById.get(existing);
        if (prev?.status === 'active') throw new Error('Patient already has an active code event');
    }

    const id = genId();
    const unitId = meta?.unitId?.trim() || DEFAULT_CODE_EVENT_UNIT_ID;
    const record: CodeEventRecord = {
        id,
        patientId: payload.patientId,
        encounterId: payload.encounterId,
        tenantId: payload.tenantId,
        patientName: meta?.patientName,
        patientMrn: meta?.patientMrn,
        eventType: payload.eventType,
        location: payload.location,
        calledBy: payload.calledBy,
        calledByName: payload.calledByName,
        calledAt: payload.calledAt,
        teamLeadId: payload.teamLeadId,
        teamLeadName: payload.teamLeadName,
        teamMembers: [],
        timeline: [],
        status: 'active',
        unitId,
        announceToUnit: payload.announceToUnit,
    };

    eventsById.set(id, record);
    activeByPatient.set(payload.patientId, id);
    touchUnit(unitId, id, true);
    return delay({ ...record });
}

export async function mockFetchActiveCodeEventsByUnit(unitId: string): Promise<CodeEventSummary[]> {
    const set = activeByUnit.get(unitId) ?? new Set<string>();
    const list: CodeEventSummary[] = [];
    for (const id of set) {
        const e = eventsById.get(id);
        if (e?.status === 'active') list.push(toSummary(e));
    }
    return delay(list);
}

export async function mockFetchCodeEventByPatient(patientId: string): Promise<CodeEventRecord | null> {
    const id = activeByPatient.get(patientId);
    if (!id) return delay(null);
    const e = eventsById.get(id);
    if (!e || e.status !== 'active') return delay(null);
    return delay({ ...e });
}

export async function mockFetchCodeEventById(eventId: string): Promise<CodeEventRecord | null> {
    const e = eventsById.get(eventId);
    return delay(e ? { ...e } : null);
}

export async function mockUpdateCodeEventTimeline(
    eventId: string,
    payload: CodeEventTimelinePayload
): Promise<CodeEventRecord> {
    const e = eventsById.get(eventId);
    if (!e) throw new Error('Code event not found');
    const updated: CodeEventRecord = { ...e, timeline: [...payload.timeline] };
    eventsById.set(eventId, updated);
    return delay({ ...updated });
}

export async function mockUpdateCodeEventTeam(eventId: string, payload: CodeEventTeamPayload): Promise<CodeEventRecord> {
    const e = eventsById.get(eventId);
    if (!e) throw new Error('Code event not found');
    const updated: CodeEventRecord = {
        ...e,
        teamMembers: [...payload.teamMembers],
        teamLeadId: payload.teamLeadId ?? e.teamLeadId,
        teamLeadName: payload.teamLeadName ?? e.teamLeadName,
    };
    eventsById.set(eventId, updated);
    return delay({ ...updated });
}

export async function mockCloseCodeEvent(eventId: string, payload: CloseCodeEventPayload): Promise<CodeEventRecord> {
    const e = eventsById.get(eventId);
    if (!e) throw new Error('Code event not found');
    const updated: CodeEventRecord = {
        ...e,
        status: 'closed',
        endTime: payload.endTime,
        outcome: payload.outcome,
        postEventDisposition: payload.postEventDisposition,
        debriefNotes: payload.debriefNotes,
        totalDurationMinutes: payload.totalDurationMinutes,
    };
    eventsById.set(eventId, updated);
    activeByPatient.delete(e.patientId);
    if (e.unitId) touchUnit(e.unitId, eventId, false);
    return delay({ ...updated });
}

export async function mockGenerateCodeEventNote(eventId: string): Promise<{ noteText: string }> {
    const e = eventsById.get(eventId);
    if (!e) throw new Error('Code event not found');
    const lines = [
        `CODE EVENT DOCUMENTATION — ${e.eventType}`,
        `Patient: ${e.patientName ?? e.patientId} · MRN ${e.patientMrn ?? '—'}`,
        `Location: ${e.location}`,
        `Called: ${e.calledAt} by ${e.calledByName}`,
        `Team lead: ${e.teamLeadName}`,
        '',
        'Timeline:',
        ...e.timeline.map(
            (t) =>
                `  ${t.timestamp} — ${t.entryType}${t.medication?.name ? ` (${t.medication.name} ${t.medication.dose} ${t.medication.route})` : ''}${t.joules != null ? ` · ${t.joules} J` : ''}${t.notes ? ` — ${t.notes}` : ''}`
        ),
        '',
        e.status === 'closed'
            ? `Outcome: ${e.outcome ?? '—'} · Disposition: ${e.postEventDisposition ?? '—'} · Duration: ${e.totalDurationMinutes ?? '—'} min`
            : 'Event still active.',
        e.debriefNotes ? `\nDebrief:\n${e.debriefNotes}` : '',
    ];
    return delay({ noteText: lines.filter(Boolean).join('\n') });
}

/** On-shift staff options for activation modal (mock uses scheduling roster) */
export async function mockListOnShiftStaff(): Promise<{ id: string; name: string; role: string }[]> {
    const staff = await listStaff();
    return staff
        .filter((s) => s.active)
        .slice(0, 12)
        .map((s) => ({
            id: s.id,
            name: s.displayName,
            role: s.credentials || s.role,
        }));
}

export function mockAppendTimelineEntry(
    eventId: string,
    entry: Omit<import('../types/codeEvent').CodeEventTimelineEntry, 'id'> & { id?: string }
): Promise<CodeEventRecord> {
    const e = eventsById.get(eventId);
    if (!e) return Promise.reject(new Error('Code event not found'));
    const full = { ...entry, id: entry.id ?? genTimelineId() };
    return mockUpdateCodeEventTimeline(eventId, { timeline: [...e.timeline, full] });
}
