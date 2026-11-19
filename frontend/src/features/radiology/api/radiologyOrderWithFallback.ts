import {
    acknowledgeRadiologyOrder as apiAcknowledge,
    cancelRadiologyOrder as apiCancel,
    createRadiologyOrder as apiCreate,
    fetchRadiologyOrderById as apiFetchById,
    fetchRadiologyOrdersByEncounter as apiFetchByEncounter,
    markRadiologyCritical as apiMarkCritical,
    submitRadiologyResult as apiSubmitResult,
} from './radiologyOrderApi';
import { USE_RADIOLOGY_MOCK } from '../config/radiologyMock.config';
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


/** Pure switch: real API unless VITE_RADIOLOGY_MOCK=true. An imaging order is never diverted into browser memory on error. */
export function getLastRadiologyDataSource(_encounterId: string): RadiologyDataSource | null {
    return USE_RADIOLOGY_MOCK ? 'mock' : 'api';
}

function pick<T>(apiFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
    return USE_RADIOLOGY_MOCK ? mockFn() : apiFn();
}

export async function fetchRadiologyOrdersByEncounter(
    encounterId: string,
    context?: RadiologyEncounterContext
): Promise<RadiologyOrder[]> {
    return pick(
        () => apiFetchByEncounter(encounterId),
        () => mockFetchRadiologyOrdersByEncounter(encounterId, context?.patientId, context?.tenantId)
    );
}

export async function fetchRadiologyOrderById(orderId: string, encounterId: string): Promise<RadiologyOrder | null> {
    return pick(() => apiFetchById(orderId), () => mockFetchRadiologyOrderById(encounterId, orderId));
}

export async function createRadiologyOrder(payload: CreateRadiologyOrderPayload): Promise<RadiologyOrder> {
    return pick(() => apiCreate(payload), () => mockCreateRadiologyOrder(payload));
}

export async function acknowledgeRadiologyOrder(
    orderId: string,
    encounterId: string,
    body?: { acknowledgedBy?: string }
): Promise<RadiologyOrder> {
    return pick(() => apiAcknowledge(orderId, body), () => mockAcknowledgeRadiologyOrder(encounterId, orderId, body?.acknowledgedBy));
}

export async function submitRadiologyResult(
    orderId: string,
    encounterId: string,
    body: RadiologyResultPayload
): Promise<RadiologyOrder> {
    return pick(() => apiSubmitResult(orderId, body), () => mockSubmitRadiologyResult(encounterId, orderId, body));
}

export async function cancelRadiologyOrder(orderId: string, encounterId: string): Promise<RadiologyOrder> {
    return pick(() => apiCancel(orderId), () => mockCancelRadiologyOrder(encounterId, orderId));
}

export async function markRadiologyCritical(
    orderId: string,
    encounterId: string,
    body: RadiologyCriticalPayload
): Promise<RadiologyOrder> {
    return pick(() => apiMarkCritical(orderId, body), () => mockMarkRadiologyCritical(encounterId, orderId, body));
}
