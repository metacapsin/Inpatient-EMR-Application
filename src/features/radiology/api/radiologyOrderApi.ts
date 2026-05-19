import api from '../../../services/api';
import type {
    CreateRadiologyOrderPayload,
    RadiologyCriticalPayload,
    RadiologyOrder,
    RadiologyResultPayload,
} from '../types/radiologyOrder.types';

type ApiEnvelope<T> = { data?: T; status?: string; message?: string };

function unwrapList(raw: unknown): RadiologyOrder[] {
    if (Array.isArray(raw)) return raw as RadiologyOrder[];
    if (raw && typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.orders)) return o.orders as RadiologyOrder[];
        if (Array.isArray(o.data)) return o.data as RadiologyOrder[];
    }
    return [];
}

function unwrapOne(raw: unknown): RadiologyOrder | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.data && typeof o.data === 'object') return o.data as RadiologyOrder;
    return raw as RadiologyOrder;
}

export async function createRadiologyOrder(payload: CreateRadiologyOrderPayload): Promise<RadiologyOrder> {
    const { data } = await api.post<ApiEnvelope<RadiologyOrder> | RadiologyOrder>('/api/Radiology/order', payload);
    return unwrapOne(data) ?? (data as RadiologyOrder);
}

export async function fetchRadiologyOrdersByEncounter(encounterId: string): Promise<RadiologyOrder[]> {
    const { data } = await api.get<ApiEnvelope<RadiologyOrder[]> | RadiologyOrder[]>(
        `/api/Radiology/encounter/${encodeURIComponent(encounterId)}`
    );
    if (data && typeof data === 'object' && 'data' in data) return unwrapList((data as ApiEnvelope<RadiologyOrder[]>).data);
    return unwrapList(data);
}

export async function fetchRadiologyOrderById(orderId: string): Promise<RadiologyOrder | null> {
    const { data } = await api.get<ApiEnvelope<RadiologyOrder> | RadiologyOrder>(
        `/api/Radiology/order/${encodeURIComponent(orderId)}`
    );
    return unwrapOne(data);
}

export async function acknowledgeRadiologyOrder(orderId: string, body?: { acknowledgedBy?: string }): Promise<RadiologyOrder> {
    const { data } = await api.put<ApiEnvelope<RadiologyOrder> | RadiologyOrder>(
        `/api/Radiology/order/${encodeURIComponent(orderId)}/acknowledge`,
        body ?? {}
    );
    return unwrapOne(data) ?? (data as RadiologyOrder);
}

export async function submitRadiologyResult(orderId: string, body: RadiologyResultPayload): Promise<RadiologyOrder> {
    const { data } = await api.put<ApiEnvelope<RadiologyOrder> | RadiologyOrder>(
        `/api/Radiology/order/${encodeURIComponent(orderId)}/result`,
        body
    );
    return unwrapOne(data) ?? (data as RadiologyOrder);
}

export async function cancelRadiologyOrder(orderId: string): Promise<RadiologyOrder> {
    const { data } = await api.put<ApiEnvelope<RadiologyOrder> | RadiologyOrder>(
        `/api/Radiology/order/${encodeURIComponent(orderId)}/cancel`,
        {}
    );
    return unwrapOne(data) ?? (data as RadiologyOrder);
}

export async function markRadiologyCritical(orderId: string, body: RadiologyCriticalPayload): Promise<RadiologyOrder> {
    const { data } = await api.put<ApiEnvelope<RadiologyOrder> | RadiologyOrder>(
        `/api/Radiology/order/${encodeURIComponent(orderId)}/critical`,
        body
    );
    return unwrapOne(data) ?? (data as RadiologyOrder);
}
