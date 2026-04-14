import type { AxiosError } from 'axios';
import type {
    ActiveEncounterRow,
    AdmitRequest,
    AdmitResponseData,
    AdtApiError,
    AdtApiSuccess,
    DischargeRequest,
    DischargeConfirmData,
    DischargeInitiateData,
    TransferRequest,
    TransferResponseData,
} from '../types/adt';

export type { ActiveEncounterRow };
import { extractIdString, pickString } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';
import api from './api';

export type AdtPostOk<TData> = {
    ok: true;
    message: string;
    data: TData;
    adt?: AdtApiSuccess<TData>['adt'];
};

export type AdtPostErr = {
    ok: false;
    status: number;
    message: string;
    details?: Record<string, unknown>;
};

export type AdtPostResult<TData> = AdtPostOk<TData> | AdtPostErr;

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

function asAdtErrorPayload(data: unknown): AdtApiError | null {
    if (!isRecord(data)) return null;
    if (data.status !== 'error') return null;
    const message = typeof data.message === 'string' ? data.message : 'Request failed';
    const details = isRecord(data.details) ? (data.details as Record<string, unknown>) : undefined;
    return { status: 'error', message, details };
}

async function adtPost<TBody extends object, TData>(
    path: '/api/admissions' | '/api/transfers' | '/api/discharges' | '/api/discharges/confirm',
    body: TBody
): Promise<AdtPostResult<TData>> {
    try {
        const { data } = await api.post<AdtApiSuccess<TData> | AdtApiError>(path, body);
        const errBody = asAdtErrorPayload(data);
        if (errBody) {
            return { ok: false, status: 200, message: errBody.message, details: errBody.details };
        }
        if (!isRecord(data) || data.status !== 'success') {
            return { ok: false, status: 200, message: 'Unexpected response from ADT API' };
        }
        const ok = data as AdtApiSuccess<TData>;
        return { ok: true, message: ok.message, data: ok.data, adt: ok.adt };
    } catch (e) {
        const ax = e as AxiosError<unknown>;
        const status = ax.response?.status ?? 0;
        const payload = ax.response?.data;
        const fromBody = asAdtErrorPayload(payload);
        const message =
            fromBody?.message ??
            (typeof payload === 'object' && payload !== null && 'message' in payload && typeof (payload as { message: unknown }).message === 'string'
                ? (payload as { message: string }).message
                : ax.message || 'Request failed');
        return { ok: false, status, message, details: fromBody?.details };
    }
}

function messageLooksLikeBedNotFound(message: string): boolean {
    const m = message.trim().toLowerCase();
    if (!m) return false;
    if (m.includes('bed not found')) return true;
    if (m.includes('bed_not_found')) return true;
    if (/\bbed\b/.test(m) && /\bnot found\b/.test(m)) return true;
    return false;
}

export function formatAdtUserMessage(result: AdtPostErr): string {
    if (messageLooksLikeBedNotFound(result.message)) {
        return BED_NOT_FOUND_USER_MESSAGE;
    }
    if (result.status === 401) {
        return 'Your session has expired. Please sign in again.';
    }
    if (result.status === 403) {
        return 'You do not have permission to perform this action.';
    }
    if (result.status === 409) {
        return (
            result.message ||
            'This action conflicts with the current patient or bed state. Refresh the list and try again.'
        );
    }
    if (result.status === 400) {
        return result.message || 'The request was invalid. Check bed selection and patient state, then try again.';
    }
    return result.message;
}

export type ListActiveEncountersOk = {
    ok: true;
    data: ActiveEncounterRow[];
    message: string;
};

export type ListActiveEncountersErr = {
    ok: false;
    status: number;
    message: string;
};

export type ListActiveEncountersResult = ListActiveEncountersOk | ListActiveEncountersErr;

/** GET /api/admissions/active — optional patientId / bedId filters. */
export async function listActiveEncounters(params?: {
    patientId?: string;
    bedId?: string;
}): Promise<ListActiveEncountersResult> {
    try {
        const { data } = await api.get<{ status: string; message?: string; data?: ActiveEncounterRow[] }>(
            '/api/admissions/active',
            { params: params || {} }
        );
        if (data.status === 'error' || !Array.isArray(data.data)) {
            return {
                ok: false,
                status: 200,
                message: typeof data.message === 'string' ? data.message : 'Failed to load encounters',
            };
        }
        const normalized: ActiveEncounterRow[] = data.data.map((row) => {
            const rec = row as Record<string, unknown>;
            const id = pickEncounterId(rec);
            return {
                ...rec,
                id,
                patientId: String(rec.patientId ?? ''),
            } as ActiveEncounterRow;
        });
        return { ok: true, data: normalized, message: data.message || '' };
    } catch (e) {
        const ax = e as AxiosError<unknown>;
        const status = ax.response?.status ?? 0;
        const payload = ax.response?.data;
        const message =
            typeof payload === 'object' &&
            payload !== null &&
            'message' in payload &&
            typeof (payload as { message: unknown }).message === 'string'
                ? (payload as { message: string }).message
                : ax.message || 'Request failed';
        return { ok: false, status, message };
    }
}

function pickEncounterId(row: Record<string, unknown>): string {
    if (typeof row.id === 'string' && row.id) return row.id;
    const _id = row._id;
    if (_id && typeof _id === 'object' && _id !== null && 'toString' in _id) {
        return String((_id as { toString(): string }).toString());
    }
    return typeof row.id === 'string' ? row.id : '';
}

/** Patient ids with an in-progress encounter (same source as bed board “Active encounters”). */
export function patientIdSetFromActiveEncounters(rows: ActiveEncounterRow[]): Set<string> {
    const set = new Set<string>();
    for (const e of rows) {
        const rec = e as Record<string, unknown>;
        const pid =
            extractIdString(e.patientId ?? rec.patient_id) || pickString(rec, 'patientId', 'patient_id');
        const t = pid.trim();
        if (t) set.add(t);
    }
    return set;
}

/** One entry per patient (last row wins) for Redux ADT workspace hydration. */
export type ActiveEncounterAdtMerge = {
    patientId: string;
    encounterId: string;
    bedMongoId: string | null;
};

/**
 * Normalize bed id from API payloads (active admission rows, encounter objects, transfer responses).
 * Keeps admit / transfer / active-list / discharge flows aligned on one canonical id string.
 */
export function pickAdtBedMongoIdFromRecord(rec: Record<string, unknown> | null | undefined): string | null {
    if (!rec) return null;
    const raw =
        extractIdString(
            rec.currentBedId ??
                rec.currentBedMongoId ??
                rec.bedId ??
                rec.bed_id ??
                rec.newBedId ??
                rec.bed
        ) ||
        pickString(rec, 'currentBedId', 'currentBedMongoId', 'bedId', 'newBedId', 'bed');
    const t = raw.trim();
    return t || null;
}

/** True when workspace session has an encounter and a non-empty bed assignment (required before discharge initiate). */
export function hasValidAdtBedForDischarge(
    session: { encounterId?: string; currentBedMongoId?: string | null } | null | undefined
): boolean {
    return Boolean(session?.encounterId?.trim() && session.currentBedMongoId?.trim());
}

/** Prefer bed id returned on the encounter from the server; fall back to the bed selected in the admit UI. */
export function resolveBedMongoIdAfterAdmit(
    encounter: Record<string, unknown> | undefined,
    selectedBedId: string
): string {
    return pickAdtBedMongoIdFromRecord(encounter)?.trim() || selectedBedId.trim();
}

const BED_NOT_FOUND_USER_MESSAGE =
    'This encounter is not linked to a bed in the system. Refresh the chart or open the patient from the bed board, then try again.';

/** Map GET /api/admissions/active rows into encounter id + bed id for `mergeActiveEncountersFromServer`. */
export function activeEncounterRowsToAdtMergePayload(rows: ActiveEncounterRow[]): ActiveEncounterAdtMerge[] {
    const byPatient = new Map<string, ActiveEncounterAdtMerge>();
    for (const e of rows) {
        const rec = e as Record<string, unknown>;
        const patientId =
            extractIdString(e.patientId ?? rec.patient_id) || pickString(rec, 'patientId', 'patient_id');
        const pid = patientId.trim();
        const encounterId = extractIdString(e.id) || pickEncounterId(rec);
        const enc = encounterId.trim();
        if (!pid || !enc) continue;
        byPatient.set(pid, {
            patientId: pid,
            encounterId: enc,
            bedMongoId: pickAdtBedMongoIdFromRecord(rec),
        });
    }
    return Array.from(byPatient.values());
}

export const adtApi = {
    admit: (body: AdmitRequest) => adtPost<AdmitRequest, AdmitResponseData>('/api/admissions', body),
    transfer: (body: TransferRequest) => adtPost<TransferRequest, TransferResponseData>('/api/transfers', body),
    dischargeInitiate: (encounterId: string, disposition?: string, dischargeSummary?: string) =>
        adtPost<DischargeRequest, DischargeInitiateData>('/api/discharges', {
            phase: 'initiate',
            encounterId,
            disposition,
            dischargeSummary,
        }),
    /**
     * Finalize inpatient discharge — POST /api/discharges/confirm.
     * Falls back to legacy POST /api/discharges { phase: 'confirm' } when the dedicated route is not deployed.
     */
    dischargeConfirm: async (encounterId: string): Promise<AdtPostResult<DischargeConfirmData>> => {
        const primary = await adtPost<{ encounterId: string }, DischargeConfirmData>('/api/discharges/confirm', {
            encounterId,
        });
        if (primary.ok) return primary;
        if (primary.status === 404) {
            return adtPost<DischargeRequest, DischargeConfirmData>('/api/discharges', { phase: 'confirm', encounterId });
        }
        return primary;
    },
};
