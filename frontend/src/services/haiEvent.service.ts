import api from './api';
import {
    appendMockHaiEvent,
    getMockEncounterTimeline,
    getMockUnitSummary,
} from '../data/haiEventMockData';
import type { HAIEncounterTimelineResponse, HAIEvent, HAIUnitSummary } from '../types/haiEvent';

/** Set `VITE_HAI_EVENT_MOCK=false` when backend routes are live. */
export const USE_HAI_EVENT_MOCK = import.meta.env.VITE_HAI_EVENT_MOCK !== 'false';

const API_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('HAI_API_TIMEOUT')), ms);
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

function unwrapList(data: unknown): unknown[] {
    if (!data || typeof data !== 'object') return [];
    const o = data as Record<string, unknown>;
    if (o.status === 'success' && Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.events)) return o.events;
    if (Array.isArray(data)) return data as unknown[];
    return [];
}

function str(v: unknown): string {
    if (v == null) return '';
    return String(v).trim();
}

function normalizeEvent(raw: unknown, encounterId: string): HAIEvent | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const eventType = str(r.eventType ?? r.event_type ?? r.type) as HAIEvent['eventType'];
    const validTypes: HAIEvent['eventType'][] = [
        'infection_detected',
        'isolation_started',
        'severity_updated',
        'status_changed',
        'infection_resolved',
    ];
    if (!validTypes.includes(eventType)) return null;
    const id = str(r.id ?? r.eventId) || `hai-${Date.now()}`;
    const occurredAt = str(r.occurredAt ?? r.occurred_at ?? r.timestamp) || new Date().toISOString();
    return {
        id,
        encounterId: str(r.encounterId ?? r.encounter_id) || encounterId,
        patientId: str(r.patientId ?? r.patient_id) || undefined,
        infectionRecordId: str(r.infectionRecordId ?? r.infection_record_id) || undefined,
        eventType,
        title: str(r.title) || eventType.replace(/_/g, ' '),
        description: str(r.description ?? r.notes) || undefined,
        infectionType: str(r.infectionType ?? r.infection_type) || undefined,
        severity: (str(r.severity) || undefined) as HAIEvent['severity'],
        status: (str(r.status) || undefined) as HAIEvent['status'],
        isolationType: str(r.isolationType ?? r.isolation_type) || undefined,
        occurredAt,
        recordedBy: str(r.recordedBy ?? r.recorded_by) || undefined,
    };
}

function normalizeSummary(raw: unknown, unitId: string): HAIUnitSummary {
    if (!raw || typeof raw !== 'object') return getMockUnitSummary(unitId);
    const r = raw as Record<string, unknown>;
    const inner = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : r;
    return {
        unitId: str(inner.unitId ?? inner.unit_id) || unitId,
        unitName: str(inner.unitName ?? inner.unit_name) || 'Unit',
        asOf: str(inner.asOf ?? inner.as_of) || new Date().toISOString(),
        totalActiveInfections: Number(inner.totalActiveInfections ?? inner.total_active_infections ?? 0),
        isolationPatients: Number(inner.isolationPatients ?? inner.isolation_patients ?? 0),
        resolvedCases: Number(inner.resolvedCases ?? inner.resolved_cases ?? 0),
        highSeverityCases: Number(inner.highSeverityCases ?? inner.high_severity_cases ?? 0),
        activeByType: Array.isArray(inner.activeByType)
            ? (inner.activeByType as { infectionType: string; count: number }[])
            : undefined,
        recentEvents: Array.isArray(inner.recentEvents)
            ? (inner.recentEvents as unknown[])
                  .map((e) => normalizeEvent(e, ''))
                  .filter((e): e is HAIEvent => e != null)
            : undefined,
    };
}

async function fetchEncounterTimelineApi(encounterId: string): Promise<HAIEvent[]> {
    const { data } = await api.get<unknown>(`/api/HAIEvent/encounter/${encodeURIComponent(encounterId)}`);
    const list = unwrapList(data);
    return list
        .map((row) => normalizeEvent(row, encounterId))
        .filter((e): e is HAIEvent => e != null)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

async function fetchUnitSummaryApi(unitId: string): Promise<HAIUnitSummary> {
    const { data } = await api.get<unknown>(`/api/HAIEvent/summary/${encodeURIComponent(unitId)}`);
    return normalizeSummary(data, unitId);
}

/** GET /api/HAIEvent/encounter/:encounterId */
export async function getHaiEncounterTimeline(encounterId: string): Promise<HAIEncounterTimelineResponse> {
    const id = encounterId.trim();
    if (!id) return { encounterId: '', events: [] };

    if (!USE_HAI_EVENT_MOCK) {
        const events = await fetchEncounterTimelineApi(id);
        return { encounterId: id, events };
    }

    try {
        const events = await withTimeout(fetchEncounterTimelineApi(id), API_TIMEOUT_MS);
        if (events.length > 0) return { encounterId: id, events };
    } catch {
        /* fallback */
    }

    return { encounterId: id, events: getMockEncounterTimeline(id) };
}

/** GET /api/HAIEvent/summary/:unitId */
export async function getHaiUnitSummary(unitId: string): Promise<HAIUnitSummary> {
    const id = unitId.trim() || 'unit-1';

    if (!USE_HAI_EVENT_MOCK) {
        return fetchUnitSummaryApi(id);
    }

    try {
        return await withTimeout(fetchUnitSummaryApi(id), API_TIMEOUT_MS);
    } catch {
        return getMockUnitSummary(id);
    }
}

/** Push a timeline event into mock store (local demo when infection records change). */
export function recordLocalHaiEvent(event: HAIEvent): void {
    if (USE_HAI_EVENT_MOCK) appendMockHaiEvent(event);
}
