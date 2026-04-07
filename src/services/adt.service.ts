import type { AxiosError } from 'axios';
import type {
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
