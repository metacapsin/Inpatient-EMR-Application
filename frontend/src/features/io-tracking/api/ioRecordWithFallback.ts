import api from '../../../services/api';
import { USE_IO_MOCK } from '../config/ioMock.config';
import { mockAddIoRecord, mockGetIoBalance, mockGetIoTimeline } from '../mock/ioMockApi';
import type { IoAddIntakePayload, IoAddOutputPayload, IoBalanceSummary, IoTimelineRow } from '../types/ioRecord.types';
import { mapTimelineRows, normalizeBalanceSummary } from '../utils/ioRecordMappers';

export type IoDataSource = 'api' | 'mock';


/** Pure switch: real API unless VITE_IO_MOCK=true. No timeout/error fallback to fabricated I/O data. */
export function getLastIoDataSource(_encounterId: string): IoDataSource | null {
    return USE_IO_MOCK ? 'mock' : 'api';
}

function pick<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    return USE_IO_MOCK ? mockFn() : apiFn();
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
    return pick(() => fetchBalanceFromApi(encounterId), () => mockGetIoBalance(encounterId));
}

export async function getIoTimelineWithFallback(encounterId: string): Promise<IoTimelineRow[]> {
    return pick(() => fetchTimelineFromApi(encounterId), () => mockGetIoTimeline(encounterId));
}

export async function addIoRecordWithFallback(payload: IoAddIntakePayload | IoAddOutputPayload): Promise<unknown> {
    return pick(() => postRecordToApi(payload), () => mockAddIoRecord(payload));
}
