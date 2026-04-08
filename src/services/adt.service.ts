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
import { asRecord, extractIdString, unwrapList } from '../lib/apiPayload';
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
    path: '/api/admissions' | '/api/transfers' | '/api/discharges',
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

export function formatAdtUserMessage(result: AdtPostErr): string {
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

export type ListActiveEncountersParams = {
    patientId?: string;
    bedId?: string;
};

function normalizeActiveEncounterRow(item: unknown): ActiveEncounterRow | null {
    const row = asRecord(item);
    if (!row) return null;
    const id = extractIdString(row.id ?? row._id ?? row.encounterId);
    if (!id) return null;
    return { ...row, id };
}

/**
 * GET /api/admissions/active — in-progress admissions, newest first (server ordering).
 */
export async function listActiveEncounters(params?: ListActiveEncountersParams): Promise<ActiveEncounterRow[]> {
    const q: Record<string, string> = {};
    const p = params?.patientId?.trim();
    const b = params?.bedId?.trim();
    if (p) q.patientId = p;
    if (b) q.bedId = b;
    try {
        const { data } = await api.get<unknown>('/api/admissions/active', { params: Object.keys(q).length ? q : undefined });
        const top = asRecord(data);
        if (top && top.status === 'error') {
            const msg = typeof top.message === 'string' ? top.message : 'Failed to load active encounters';
            throw new Error(msg);
        }
        const rows = unwrapList(data);
        const out: ActiveEncounterRow[] = [];
        for (const item of rows) {
            const row = normalizeActiveEncounterRow(item);
            if (row) out.push(row);
        }
        return out;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, 'Failed to load active encounters'));
    }
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
    dischargeConfirm: (encounterId: string) =>
        adtPost<DischargeRequest, DischargeConfirmData>('/api/discharges', { phase: 'confirm', encounterId }),
};
