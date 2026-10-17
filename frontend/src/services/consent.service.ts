import api from './api';
import { asRecord, unwrapList } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';
import {
    buildMockConsents,
    buildMockPatientRights,
    CONSENT_TEMPLATE_VERSIONS,
    MOCK_CONSENT_PDF_URL,
} from '../mocks/consents.mock';
import type {
    ConsentCompleteness,
    ConsentRecord,
    ConsentSummaryCounts,
    ConsentType,
    CreateConsentPayload,
    PatientRightsRecord,
    PatientRightsRequestPayload,
    RevokeConsentPayload,
    ServiceResult,
    SignConsentPayload,
} from '../types/consent';

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

const REQUIRED_DISCHARGE_CONSENTS: ConsentType[] = ['General Treatment', 'HIPAA NPP'];

const consentStore = new Map<string, ConsentRecord[]>();
const rightsStore = new Map<string, PatientRightsRecord[]>();

function mockDelay<T>(data: T, ms = 280): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function storeKey(encounterId: string) {
    return encounterId.trim();
}

function ensureMockConsents(encounterId: string, patientId: string, tenantId: string): ConsentRecord[] {
    const key = storeKey(encounterId);
    if (!consentStore.has(key)) {
        consentStore.set(key, buildMockConsents(encounterId, patientId, tenantId));
    }
    return [...(consentStore.get(key) ?? [])];
}

function ensureMockRights(patientId: string): PatientRightsRecord[] {
    const key = patientId.trim();
    if (!rightsStore.has(key)) {
        rightsStore.set(key, buildMockPatientRights(patientId));
    }
    return [...(rightsStore.get(key) ?? [])];
}

function coerceConsent(raw: unknown): ConsentRecord | null {
    const r = asRecord(raw);
    if (!r || typeof r.consentId !== 'string') return null;
    return r as unknown as ConsentRecord;
}

function computeCompletenessFromRecords(records: ConsentRecord[]): ConsentCompleteness {
    const signedTypes = new Set(
        records.filter((c) => c.status === 'Signed').map((c) => c.consentType),
    );
    const missing = REQUIRED_DISCHARGE_CONSENTS.filter((t) => !signedTypes.has(t));
    return {
        required: [...REQUIRED_DISCHARGE_CONSENTS],
        missing,
        complete: missing.length === 0,
    };
}

export function computeSummaryCounts(records: ConsentRecord[], completeness: ConsentCompleteness): ConsentSummaryCounts {
    return {
        signed: records.filter((c) => c.status === 'Signed').length,
        pending: records.filter((c) => c.status === 'Pending').length,
        revoked: records.filter((c) => c.status === 'Revoked').length,
        expired: records.filter((c) => c.status === 'Expired').length,
        missingRequired: completeness.missing.length,
    };
}

export function getTemplateVersion(consentType: ConsentType): string {
    return CONSENT_TEMPLATE_VERSIONS[consentType] ?? 'UNKNOWN';
}

export function resolveConsentPdfUrl(record: ConsentRecord): string {
    if (record.signedPdfS3Key) {
        return USE_MOCK_API ? MOCK_CONSENT_PDF_URL : `${record.signedPdfS3Key}`;
    }
    return MOCK_CONSENT_PDF_URL;
}

/** Discharge readiness & cross-module gate — missing General Treatment or HIPAA NPP => incomplete. */
export async function getConsentCompleteness(encounterId: string): Promise<ServiceResult<ConsentCompleteness>> {
    const eid = encounterId.trim();
    if (!eid) return { ok: false, message: 'Encounter id is required' };

    if (USE_MOCK_API) {
        const records = consentStore.get(storeKey(eid)) ?? [];
        return { ok: true, data: computeCompletenessFromRecords(records) };
    }

    try {
        const { data } = await api.get<ConsentCompleteness>(`/api/Consent/completeness/${encodeURIComponent(eid)}`);
        return { ok: true, data };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function listConsentsByEncounter(
    encounterId: string,
    patientId: string,
    tenantId: string,
): Promise<ServiceResult<ConsentRecord[]>> {
    const eid = encounterId.trim();
    if (!eid) return { ok: false, message: 'Encounter id is required' };

    if (USE_MOCK_API) {
        const list = ensureMockConsents(eid, patientId, tenantId);
        return mockDelay({ ok: true as const, data: list });
    }

    try {
        const { data } = await api.get(`/api/Consent/encounter/${encodeURIComponent(eid)}`);
        const rows = unwrapList(data).map(coerceConsent).filter((x): x is ConsentRecord => x !== null);
        return { ok: true, data: rows };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function createConsent(payload: CreateConsentPayload): Promise<ServiceResult<ConsentRecord>> {
    if (USE_MOCK_API) {
        const id = `cons-${Date.now()}`;
        const record: ConsentRecord = {
            consentId: id,
            ...payload,
            capacityAssessmentNote: payload.capacityAssessmentNote ?? null,
            updatedAt: new Date().toISOString(),
        };
        const key = storeKey(payload.encounterId);
        const list = ensureMockConsents(payload.encounterId, payload.patientId, payload.tenantId);
        list.unshift(record);
        consentStore.set(key, list);
        return mockDelay({ ok: true, data: record });
    }

    try {
        const { data } = await api.post('/api/Consent/create', payload);
        const row = coerceConsent(data);
        if (!row) return { ok: false, message: 'Invalid consent response' };
        return { ok: true, data: row };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function signConsent(
    consentId: string,
    payload: SignConsentPayload,
): Promise<ServiceResult<ConsentRecord>> {
    if (USE_MOCK_API) {
        for (const [key, list] of consentStore.entries()) {
            const idx = list.findIndex((c) => c.consentId === consentId);
            if (idx >= 0) {
                const updated: ConsentRecord = {
                    ...list[idx],
                    ...payload,
                    status: 'Signed',
                    signedPdfS3Key: payload.signedPdfS3Key ?? `consents/${consentId}-signed.pdf`,
                    expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                const next = [...list];
                next[idx] = updated;
                consentStore.set(key, next);
                return mockDelay({ ok: true, data: updated });
            }
        }
        return { ok: false, message: 'Consent not found' };
    }

    try {
        const { data } = await api.put(`/api/Consent/${encodeURIComponent(consentId)}/sign`, payload);
        const row = coerceConsent(data);
        if (!row) return { ok: false, message: 'Invalid sign response' };
        return { ok: true, data: row };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function revokeConsent(
    consentId: string,
    payload: RevokeConsentPayload,
): Promise<ServiceResult<ConsentRecord>> {
    if (USE_MOCK_API) {
        for (const [key, list] of consentStore.entries()) {
            const idx = list.findIndex((c) => c.consentId === consentId);
            if (idx >= 0) {
                const updated: ConsentRecord = {
                    ...list[idx],
                    status: 'Revoked',
                    revokedAt: new Date().toISOString(),
                    revokedReason: payload.revokedReason,
                    updatedAt: new Date().toISOString(),
                };
                const next = [...list];
                next[idx] = updated;
                consentStore.set(key, next);
                return mockDelay({ ok: true, data: updated });
            }
        }
        return { ok: false, message: 'Consent not found' };
    }

    try {
        const { data } = await api.put(`/api/Consent/${encodeURIComponent(consentId)}/revoke`, payload);
        const row = coerceConsent(data);
        if (!row) return { ok: false, message: 'Invalid revoke response' };
        return { ok: true, data: row };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function fetchConsentCompleteness(encounterId: string): Promise<ServiceResult<ConsentCompleteness>> {
    return getConsentCompleteness(encounterId);
}

export async function listPatientRights(patientId: string): Promise<ServiceResult<PatientRightsRecord[]>> {
    const pid = patientId.trim();
    if (!pid) return { ok: false, message: 'Patient id is required' };

    if (USE_MOCK_API) {
        return mockDelay({ ok: true, data: ensureMockRights(pid) });
    }

    try {
        const { data } = await api.get(`/api/PatientRights/${encodeURIComponent(pid)}`);
        const rows = unwrapList(data) as PatientRightsRecord[];
        return { ok: true, data: rows };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

export async function createPatientRightsRequest(
    payload: PatientRightsRequestPayload,
): Promise<ServiceResult<PatientRightsRecord>> {
    if (USE_MOCK_API) {
        const record: PatientRightsRecord = {
            id: `pr-${Date.now()}`,
            patientId: payload.patientId,
            requestType: payload.requestType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            access: payload.access,
            amendment: payload.amendment,
            restriction: payload.restriction,
            disclosures: payload.disclosures,
            representative: payload.representative,
        };
        const key = payload.patientId.trim();
        const list = ensureMockRights(key);
        list.unshift(record);
        rightsStore.set(key, list);
        return mockDelay({ ok: true, data: record });
    }

    try {
        const { data } = await api.post('/api/PatientRights/request', payload);
        return { ok: true, data: data as PatientRightsRecord };
    } catch (err) {
        return { ok: false, message: getApiErrorMessage(err) };
    }
}

/** Human-readable discharge blocking messages from completeness. */
export function consentDischargeBlockingMessages(completeness: ConsentCompleteness | null | undefined): string[] {
    if (!completeness || completeness.complete) return [];
    if (completeness.missing.length === 0) return [];
    return [
        `Missing required consents: ${completeness.missing.join(', ')}. Obtain and sign before discharge.`,
    ];
}
