import {
    acknowledgeRadiologyOrder as apiAcknowledge,
    cancelRadiologyOrder as apiCancel,
    createRadiologyOrder as apiCreate,
    fetchRadiologyOrderById as apiFetchById,
    fetchRadiologyOrdersByEncounter as apiFetchByEncounter,
    markRadiologyCritical as apiMarkCritical,
    submitRadiologyResult as apiSubmitResult,
} from './radiologyOrderApi';
import { RADIOLOGY_API_TIMEOUT_MS, USE_RADIOLOGY_MOCK } from '../config/radiologyMock.config';
import {
    mockAcknowledgeRadiologyOrder,
    mockCancelRadiologyOrder,
    mockCreateRadiologyOrder,
    mockFetchRadiologyOrderById,
    mockFetchRadiologyOrdersByEncounter,
    mockMarkRadiologyCritical,
    mockSubmitRadiologyResult,
} from '../mock/radiologyMockApi';
import type {
    CreateRadiologyOrderPayload,
    RadiologyCriticalPayload,
    RadiologyOrder,
    RadiologyResultPayload,
} from '../types/radiologyOrder.types';

export type RadiologyDataSource = 'api' | 'mock';

export type RadiologyEncounterContext = {
    patientId?: string;
    tenantId?: string;
};

const lastSourceByEncounter = new Map<string, RadiologyDataSource>();

export function getLastRadiologyDataSource(encounterId: string): RadiologyDataSource | null {
    return lastSourceByEncounter.get(encounterId.trim()) ?? null;
}

function setSource(encounterId: string, source: RadiologyDataSource): void {
    lastSourceByEncounter.set(encounterId.trim(), source);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('RADIOLOGY_API_TIMEOUT')), ms);
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

async function callApi<T>(fn: () => Promise<T>): Promise<T> {
    if (!USE_RADIOLOGY_MOCK) return fn();
    return withTimeout(fn(), RADIOLOGY_API_TIMEOUT_MS);
}

function useMockStoreOnly(encounterId: string): boolean {
    return USE_RADIOLOGY_MOCK && getLastRadiologyDataSource(encounterId) === 'mock';
}

async function withMockFallback<T>(
    encounterId: string,
    apiFn: () => Promise<T>,
    mockFn: () => Promise<T>
): Promise<T> {
    if (!USE_RADIOLOGY_MOCK) {
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

export async function fetchRadiologyOrdersByEncounter(
    encounterId: string,
    context?: RadiologyEncounterContext
): Promise<RadiologyOrder[]> {
    return withMockFallback(
        encounterId,
        () => apiFetchByEncounter(encounterId),
        () =>
            mockFetchRadiologyOrdersByEncounter(
                encounterId,
                context?.patientId,
                context?.tenantId
            )
    );
}

export async function fetchRadiologyOrderById(orderId: string, encounterId: string): Promise<RadiologyOrder | null> {
    if (!USE_RADIOLOGY_MOCK) return apiFetchById(orderId);
    if (useMockStoreOnly(encounterId)) return mockFetchRadiologyOrderById(encounterId, orderId);
    try {
        return await callApi(() => apiFetchById(orderId));
    } catch {
        return mockFetchRadiologyOrderById(encounterId, orderId);
    }
}

export async function createRadiologyOrder(payload: CreateRadiologyOrderPayload): Promise<RadiologyOrder> {
    const { encounterId } = payload;
    if (!USE_RADIOLOGY_MOCK) {
        const data = await apiCreate(payload);
        setSource(encounterId, 'api');
        return data;
    }
    if (useMockStoreOnly(encounterId)) {
        const data = await mockCreateRadiologyOrder(payload);
        setSource(encounterId, 'mock');
        return data;
    }
    try {
        const data = await callApi(() => apiCreate(payload));
        setSource(encounterId, 'api');
        return data;
    } catch {
        const data = await mockCreateRadiologyOrder(payload);
        setSource(encounterId, 'mock');
        return data;
    }
}

export async function acknowledgeRadiologyOrder(
    orderId: string,
    encounterId: string,
    body?: { acknowledgedBy?: string }
): Promise<RadiologyOrder> {
    if (!USE_RADIOLOGY_MOCK) return apiAcknowledge(orderId, body);
    if (useMockStoreOnly(encounterId)) return mockAcknowledgeRadiologyOrder(encounterId, orderId, body?.acknowledgedBy);
    try {
        const data = await callApi(() => apiAcknowledge(orderId, body));
        setSource(encounterId, 'api');
        return data;
    } catch {
        return mockAcknowledgeRadiologyOrder(encounterId, orderId, body?.acknowledgedBy);
    }
}

export async function submitRadiologyResult(
    orderId: string,
    encounterId: string,
    body: RadiologyResultPayload
): Promise<RadiologyOrder> {
    if (!USE_RADIOLOGY_MOCK) return apiSubmitResult(orderId, body);
    if (useMockStoreOnly(encounterId)) return mockSubmitRadiologyResult(encounterId, orderId, body);
    try {
        const data = await callApi(() => apiSubmitResult(orderId, body));
        setSource(encounterId, 'api');
        return data;
    } catch {
        return mockSubmitRadiologyResult(encounterId, orderId, body);
    }
}

export async function cancelRadiologyOrder(orderId: string, encounterId: string): Promise<RadiologyOrder> {
    if (!USE_RADIOLOGY_MOCK) return apiCancel(orderId);
    if (useMockStoreOnly(encounterId)) return mockCancelRadiologyOrder(encounterId, orderId);
    try {
        const data = await callApi(() => apiCancel(orderId));
        setSource(encounterId, 'api');
        return data;
    } catch {
        return mockCancelRadiologyOrder(encounterId, orderId);
    }
}

export async function markRadiologyCritical(
    orderId: string,
    encounterId: string,
    body: RadiologyCriticalPayload
): Promise<RadiologyOrder> {
    if (!USE_RADIOLOGY_MOCK) return apiMarkCritical(orderId, body);
    if (useMockStoreOnly(encounterId)) return mockMarkRadiologyCritical(encounterId, orderId, body);
    try {
        const data = await callApi(() => apiMarkCritical(orderId, body));
        setSource(encounterId, 'api');
        return data;
    } catch {
        return mockMarkRadiologyCritical(encounterId, orderId, body);
    }
}
