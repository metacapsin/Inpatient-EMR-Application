import type {
    CreateRadiologyOrderPayload,
    RadiologyCriticalPayload,
    RadiologyOrder,
    RadiologyResultPayload,
} from '../types/radiologyOrder.types';
import { buildRadiologyMockSeed } from './radiologyMockSeed';
import {
    ensureMockEncounter,
    findMockOrder,
    getMockOrders,
    nextMockOrderId,
    setMockOrders,
    updateMockOrder,
} from './radiologyMockStore';

export async function mockFetchRadiologyOrdersByEncounter(
    encounterId: string,
    patientId?: string,
    tenantId?: string
): Promise<RadiologyOrder[]> {
    if (patientId?.trim()) {
        ensureMockEncounter(encounterId, patientId, tenantId);
    }
    return getMockOrders(encounterId);
}

export async function mockFetchRadiologyOrderById(
    encounterId: string,
    orderId: string
): Promise<RadiologyOrder | null> {
    return findMockOrder(encounterId, orderId) ?? null;
}

export async function mockCreateRadiologyOrder(payload: CreateRadiologyOrderPayload): Promise<RadiologyOrder> {
    ensureMockEncounter(payload.encounterId, payload.patientId, payload.tenantId);
    const order: RadiologyOrder = {
        ...payload,
        _id: nextMockOrderId(),
        orderedAt: new Date().toISOString(),
        status: 'Ordered',
        icd10Codes: payload.icd10Codes ?? [],
    };
    const list = getMockOrders(payload.encounterId);
    list.unshift(order);
    setMockOrders(payload.encounterId, list);
    return order;
}

export async function mockAcknowledgeRadiologyOrder(
    encounterId: string,
    orderId: string,
    acknowledgedBy?: string
): Promise<RadiologyOrder> {
    const existing = findMockOrder(encounterId, orderId);
    if (!existing) throw new Error('Order not found');
    return updateMockOrder(encounterId, {
        ...existing,
        acknowledgedBy: acknowledgedBy ?? existing.acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
        status: existing.status === 'Ordered' ? 'Scheduled' : existing.status,
    });
}

export async function mockSubmitRadiologyResult(
    encounterId: string,
    orderId: string,
    body: RadiologyResultPayload
): Promise<RadiologyOrder> {
    const existing = findMockOrder(encounterId, orderId);
    if (!existing) throw new Error('Order not found');
    return updateMockOrder(encounterId, {
        ...existing,
        ...body,
        resultedAt: body.resultedAt ?? new Date().toISOString(),
        status: 'Final',
    });
}

export async function mockCancelRadiologyOrder(encounterId: string, orderId: string): Promise<RadiologyOrder> {
    const existing = findMockOrder(encounterId, orderId);
    if (!existing) throw new Error('Order not found');
    const list = getMockOrders(encounterId).filter(
        (o) => (o._id ?? o.id ?? o.orderId) !== (existing._id ?? existing.id ?? existing.orderId)
    );
    setMockOrders(encounterId, list);
    return { ...existing, amendmentReason: 'Order cancelled' };
}

export async function mockMarkRadiologyCritical(
    encounterId: string,
    orderId: string,
    body: RadiologyCriticalPayload
): Promise<RadiologyOrder> {
    const existing = findMockOrder(encounterId, orderId);
    if (!existing) throw new Error('Order not found');
    return updateMockOrder(encounterId, {
        ...existing,
        criticalValue: body.criticalValue,
        criticalValueNotifiedTo: body.criticalValueNotifiedTo,
        criticalValueNotifiedAt: new Date().toISOString(),
        status: existing.status === 'Ordered' ? 'Preliminary' : existing.status,
    });
}

/** Dev helper: reset encounter to seed data. */
export function reseedMockEncounter(encounterId: string, patientId: string, tenantId?: string): void {
    setMockOrders(encounterId, buildRadiologyMockSeed(patientId, encounterId, tenantId));
}
