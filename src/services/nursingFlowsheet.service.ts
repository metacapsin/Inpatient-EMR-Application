import api from './api';
import type {
    FlowsheetAuditEvent,
    FlowsheetVersionEntry,
    NursingFlowsheetApiPayload,
    NursingFlowsheetDocument,
} from '../features/nursing-flowsheet/types/nursingFlowsheet.types';

/** POST /api/NursingFlowsheet/save — upsert per shift (body = backend payload). */
export async function saveNursingFlowsheet(payload: NursingFlowsheetApiPayload): Promise<unknown> {
    const { data } = await api.post<unknown>('/api/NursingFlowsheet/save', payload);
    return data;
}

/** GET /api/NursingFlowsheet/:encounterId — current shift flowsheet. */
export async function getNursingFlowsheet(encounterId: string): Promise<unknown> {
    const { data } = await api.get<unknown>(`/api/NursingFlowsheet/${encodeURIComponent(encounterId)}`);
    return data;
}

/** GET /api/NursingFlowsheet/history/:encounterId — last 7 days (shape normalized below). */
export async function getNursingFlowsheetHistory(encounterId: string): Promise<unknown> {
    const { data } = await api.get<unknown>(`/api/NursingFlowsheet/history/${encodeURIComponent(encounterId)}`);
    return data;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function mergeSection<T extends object>(defaults: T, incoming: unknown): T {
    if (!isRecord(incoming)) return defaults;
    return { ...defaults, ...incoming } as T;
}

/**
 * Merge server JSON with mock defaults so UI always has shiftInfo / chartStatus / id.
 * Tolerant of partial API responses.
 */
export function normalizeServerDocumentToClient(
    raw: unknown,
    defaults: NursingFlowsheetDocument
): NursingFlowsheetDocument {
    if (!isRecord(raw)) return defaults;

    const neurological = raw.neurological;
    const hasClinical =
        isRecord(neurological) ||
        isRecord(raw.cardiovascular) ||
        isRecord(raw.respiratory) ||
        isRecord(raw.gastrointestinal);

    if (!hasClinical) return defaults;

    const shiftInfo = isRecord(raw.shiftInfo) ? { ...defaults.shiftInfo, ...(raw.shiftInfo as object) } : defaults.shiftInfo;

    const ivTemplate = defaults.ivAccess[0];
    let ivAccess = defaults.ivAccess;
    if (Array.isArray(raw.ivAccess)) {
        ivAccess = raw.ivAccess.map((row, i) => {
            const base = defaults.ivAccess[i] ?? ivTemplate;
            if (!isRecord(row)) return base;
            const id = typeof row.id === 'string' && row.id.trim() ? row.id : base.id;
            return mergeSection({ ...base, id }, row);
        });
    }

    return {
        ...defaults,
        ...raw,
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : defaults.id,
        patientId: typeof raw.patientId === 'string' && raw.patientId.trim() ? raw.patientId : defaults.patientId,
        encounterId: typeof raw.encounterId === 'string' && raw.encounterId.trim() ? raw.encounterId : defaults.encounterId,
        tenantId: typeof raw.tenantId === 'string' && raw.tenantId.trim() ? raw.tenantId : defaults.tenantId,
        shiftDate: typeof raw.shiftDate === 'string' && raw.shiftDate.trim() ? raw.shiftDate : defaults.shiftDate,
        shiftType: typeof raw.shiftType === 'string' && raw.shiftType.trim() ? raw.shiftType : defaults.shiftType,
        chartStatus: (raw.chartStatus as NursingFlowsheetDocument['chartStatus']) ?? defaults.chartStatus,
        version: typeof raw.version === 'number' ? raw.version : defaults.version,
        updatedAtIso: typeof raw.updatedAtIso === 'string' ? raw.updatedAtIso : defaults.updatedAtIso,
        createdAtIso: typeof raw.createdAtIso === 'string' ? raw.createdAtIso : defaults.createdAtIso,
        attestationAccepted: typeof raw.attestationAccepted === 'boolean' ? raw.attestationAccepted : defaults.attestationAccepted,
        signerCredentials:
            typeof raw.signerCredentials === 'string' ? raw.signerCredentials : defaults.signerCredentials ?? null,
        neurological: mergeSection(defaults.neurological, raw.neurological),
        cardiovascular: mergeSection(defaults.cardiovascular, raw.cardiovascular),
        respiratory: mergeSection(defaults.respiratory, raw.respiratory),
        gastrointestinal: mergeSection(defaults.gastrointestinal, raw.gastrointestinal),
        genitourinary: mergeSection(defaults.genitourinary, raw.genitourinary),
        integumentary: mergeSection(defaults.integumentary, raw.integumentary),
        pain: mergeSection(defaults.pain, raw.pain),
        musculoskeletal: mergeSection(defaults.musculoskeletal, raw.musculoskeletal),
        psychosocial: mergeSection(defaults.psychosocial, raw.psychosocial),
        ivAccess,
        shiftInfo,
    } as NursingFlowsheetDocument;
}

/** Try GET; on 404/network error return null so caller can use mock. */
export async function tryGetNursingFlowsheetDocument(
    encounterId: string,
    fallback: NursingFlowsheetDocument
): Promise<NursingFlowsheetDocument | null> {
    try {
        const raw = await getNursingFlowsheet(encounterId);
        return normalizeServerDocumentToClient(raw, fallback);
    } catch {
        return null;
    }
}

export function mapHistoryResponseToVersionEntries(raw: unknown): FlowsheetVersionEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((row, i) => {
        const r = isRecord(row) ? row : {};
        const savedAt =
            (typeof r.savedAtIso === 'string' && r.savedAtIso) ||
            (typeof r.savedAt === 'string' && r.savedAt) ||
            new Date().toISOString();
        const status = (r.status as FlowsheetVersionEntry['status']) || 'draft';
        return {
            id: String(r.id ?? `h-${i}`),
            version: Number(r.version ?? i + 1),
            status,
            savedAtIso: savedAt,
            savedByDisplay: String(r.savedByDisplay ?? r.savedByName ?? '—'),
            summary: String(r.summary ?? 'Server revision'),
        };
    });
}

export function mapHistoryResponseToAuditEvents(raw: unknown): FlowsheetAuditEvent[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((row, i) => {
        const r = isRecord(row) ? row : {};
        return {
            id: String(r.id ?? `audit-${i}`),
            atIso: String(r.atIso ?? r.at ?? new Date().toISOString()),
            actorDisplay: String(r.actorDisplay ?? r.actor ?? '—'),
            action: String(r.action ?? 'SERVER'),
            detail: String(r.detail ?? ''),
        };
    });
}

/** Normalize history GET body whether it is a bare array or `{ versions, audit }`. */
export function extractHistoryVersionsPayload(raw: unknown): FlowsheetVersionEntry[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return mapHistoryResponseToVersionEntries(raw);
    if (isRecord(raw)) {
        if (Array.isArray(raw.versions)) return mapHistoryResponseToVersionEntries(raw.versions);
        if (Array.isArray(raw.items)) return mapHistoryResponseToVersionEntries(raw.items);
        if (Array.isArray(raw.history)) return mapHistoryResponseToVersionEntries(raw.history);
    }
    return [];
}

export function extractHistoryAuditPayload(raw: unknown): FlowsheetAuditEvent[] {
    if (!raw) return [];
    if (isRecord(raw) && Array.isArray(raw.auditTrail)) return mapHistoryResponseToAuditEvents(raw.auditTrail);
    if (isRecord(raw) && Array.isArray(raw.audit)) return mapHistoryResponseToAuditEvents(raw.audit);
    return [];
}
