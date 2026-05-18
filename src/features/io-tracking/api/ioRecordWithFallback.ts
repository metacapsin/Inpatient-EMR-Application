import api from '../../../services/api';
import { IO_API_TIMEOUT_MS, USE_IO_MOCK } from '../config/ioMock.config';
import { mockAddIoRecord, mockGetIoBalance, mockGetIoTimeline } from '../mock/ioMockApi';
import type { IoAddIntakePayload, IoAddOutputPayload, IoBalanceSummary, IoTimelineRow } from '../types/ioRecord.types';
import { mapTimelineRows, normalizeBalanceSummary } from '../utils/ioRecordMappers';

export type IoDataSource = 'api' | 'mock';

const lastSourceByEncounter = new Map<string, IoDataSource>();

export function getLastIoDataSource(encounterId: string): IoDataSource | null {
    return lastSourceByEncounter.get(encounterId.trim()) ?? null;
}

function setSource(encounterId: string, source: IoDataSource): void {
    lastSourceByEncounter.set(encounterId.trim(), source);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('IO_API_TIMEOUT')), ms);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

async function callApi<T>(fn: () => Promise<T>): Promise<T> {
    if (!USE_IO_MOCK) return fn();
    return withTimeout(fn(), IO_API_TIMEOUT_MS);
}

function useMockStoreOnly(encounterId: string): boolean {
    return USE_IO_MOCK && getLastIoDataSource(encounterId) === 'mock';
}

async function withMockFallback<T>(
    encounterId: string,
    apiFn: () => Promise<T>,
    mockFn: () => Promise<T>
): Promise<T> {
    if (!USE_IO_MOCK) {
        const data = await apiFn();
        setSource(encounterId, 'api');
        return data;
    }

    if (useMockStoreOnly(encounterId)) {
        const data = await mockFn();
        setSource(encounterId, 'mock');
        return data;
    }

    try {
        const data = await callApi(apiFn);
        setSource(encounterId, 'api');
        return data;
    } catch {
        const data = await mockFn();
        setSource(encounterId, 'mock');
        return data;
    }
}

async function fetchBalanceFromApi(encounterId: string): Promise<IoBalanceSummary> {
    const { data } = await api.get<unknown>(`/api/IORecord/balance/${encodeURIComponent(encounterId)}`);
    return normalizeBalanceSummary(data);
}

async function fetchTimelineFromApi(encounterId: string): Promise<IoTimelineRow[]> {
    const { data } = await api.get<unknown>(`/api/IORecord/timeline/${encodeURIComponent(encounterId)}`);
    return mapTimelineRows(data);
}

async function postRecordToApi(payload: IoAddIntakePayload | IoAddOutputPayload): Promise<unknown> {
    const { data } = await api.post<unknown>('/api/IORecord/add', payload);
    return data;
}

export async function getIoBalanceWithFallback(encounterId: string): Promise<IoBalanceSummary> {
    return withMockFallback(
        encounterId,
        () => fetchBalanceFromApi(encounterId),
        () => mockGetIoBalance(encounterId)
    );
}

export async function getIoTimelineWithFallback(encounterId: string): Promise<IoTimelineRow[]> {
    return withMockFallback(
        encounterId,
        () => fetchTimelineFromApi(encounterId),
        () => mockGetIoTimeline(encounterId)
    );
}

export async function addIoRecordWithFallback(payload: IoAddIntakePayload | IoAddOutputPayload): Promise<unknown> {
    const encounterId = payload.encounterId;

    if (!USE_IO_MOCK) {
        const data = await postRecordToApi(payload);
        setSource(encounterId, 'api');
        return data;
    }

    if (useMockStoreOnly(encounterId)) {
        const data = await mockAddIoRecord(payload);
        setSource(encounterId, 'mock');
        return data;
    }

    try {
        const data = await callApi(() => postRecordToApi(payload));
        setSource(encounterId, 'api');
        return data;
    } catch {
        const data = await mockAddIoRecord(payload);
        setSource(encounterId, 'mock');
        return data;
    }
}
