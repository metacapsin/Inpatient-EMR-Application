/**
 * EVS / bed-turnaround API client. Replaces the in-memory evsMockService with the endpoints the
 * mock already named: GET /api/evs/queue, /metrics, /beds, /housekeepers and
 * POST /api/evs/queue/:id/{assign,start,complete,inspect,approve}.
 */
import api from './api';
import { getApiErrorMessage } from '../lib/httpError';
import type {
    AssignHousekeeperPayload,
    EvsBedFields,
    EvsHousekeeper,
    EvsQueueItem,
    EvsQueueMetrics,
    InspectPayload,
} from '../types/evs';

type Envelope<T> = { status: string; message?: string; data?: T };

async function get<T>(url: string, params?: Record<string, string>, fallback = 'Request failed'): Promise<T> {
    try {
        const { data } = await api.get<Envelope<T>>(url, { params });
        if (data?.data === undefined) throw new Error(data?.message || fallback);
        return data.data;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, fallback));
    }
}

async function post<T>(url: string, body?: unknown, fallback = 'Request failed'): Promise<T> {
    try {
        const { data } = await api.post<Envelope<T>>(url, body ?? {});
        if (data?.data === undefined) throw new Error(data?.message || fallback);
        return data.data;
    } catch (e) {
        throw new Error(getApiErrorMessage(e, fallback));
    }
}

const enc = encodeURIComponent;

/** Open cleaning jobs plus the ones approved clean today (newest first). */
export async function getQueue(filters?: { status?: string; wardId?: string }): Promise<EvsQueueItem[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.wardId) params.wardId = filters.wardId;
    const items = await get<EvsQueueItem[]>('/api/evs/queue', params, 'Failed to load the EVS queue');
    return [...items].sort((a, b) => {
        const ta = a.dirtyAt ? new Date(a.dirtyAt).getTime() : 0;
        const tb = b.dirtyAt ? new Date(b.dirtyAt).getTime() : 0;
        return tb - ta;
    });
}

export async function getMetrics(): Promise<EvsQueueMetrics> {
    return get<EvsQueueMetrics>('/api/evs/metrics', undefined, 'Failed to load EVS metrics');
}

export async function listHousekeepers(): Promise<EvsHousekeeper[]> {
    return get<EvsHousekeeper[]>('/api/evs/housekeepers', undefined, 'Failed to load housekeepers');
}

export async function assignHousekeeper(payload: AssignHousekeeperPayload): Promise<EvsQueueItem> {
    return post<EvsQueueItem>(`/api/evs/queue/${enc(payload.queueItemId)}/assign`, { housekeeperId: payload.housekeeperId }, 'Could not assign housekeeper');
}

export async function startCleaning(queueItemId: string): Promise<EvsQueueItem> {
    return post<EvsQueueItem>(`/api/evs/queue/${enc(queueItemId)}/start`, {}, 'Could not start cleaning');
}

export async function completeCleaning(queueItemId: string): Promise<EvsQueueItem> {
    return post<EvsQueueItem>(`/api/evs/queue/${enc(queueItemId)}/complete`, {}, 'Could not complete cleaning');
}

/** The inspector is the signed-in user; `inspectedBy` in the payload is kept for API compatibility and ignored. */
export async function inspectBed(payload: InspectPayload): Promise<EvsQueueItem> {
    return post<EvsQueueItem>(`/api/evs/queue/${enc(payload.queueItemId)}/inspect`, {}, 'Could not record inspection');
}

/** Approving returns the bed to 'available' on the bed board. */
export async function approveCleaning(queueItemId: string): Promise<EvsQueueItem> {
    return post<EvsQueueItem>(`/api/evs/queue/${enc(queueItemId)}/approve`, {}, 'Could not approve cleaning');
}

/** Manually flag a bed dirty (spill, isolation re-clean) — opens a cleaning job. */
export async function enqueueBed(bedId: string, cleaningType?: EvsQueueItem['cleaningType']): Promise<EvsQueueItem> {
    return post<EvsQueueItem>('/api/evs/queue', { bedId, ...(cleaningType ? { cleaningType } : {}) }, 'Could not add bed to the EVS queue');
}

/** Bed board overlay: bedId → EVS fields for the latest open (or cleaned-today) job on that bed. */
export async function getEvsFieldsByBedIds(bedIds: string[]): Promise<Record<string, EvsBedFields>> {
    if (!bedIds.length) return {};
    return get<Record<string, EvsBedFields>>('/api/evs/beds', { ids: bedIds.join(',') }, 'Failed to load EVS bed status');
}
