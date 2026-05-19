import type { RadiologyOrder } from '../types/radiologyOrder.types';
import { buildRadiologyMockSeed } from './radiologyMockSeed';

const store = new Map<string, RadiologyOrder[]>();

let idCounter = 0;

export function nextMockOrderId(): string {
    idCounter += 1;
    return `rad-mock-${Date.now()}-${idCounter}`;
}

export function ensureMockEncounter(
    encounterId: string,
    patientId: string,
    tenantId?: string
): RadiologyOrder[] {
    const key = encounterId.trim();
    if (!key) return [];
    if (!store.has(key)) {
        store.set(key, buildRadiologyMockSeed(patientId, key, tenantId));
    }
    return store.get(key)!;
}

export function getMockOrders(encounterId: string): RadiologyOrder[] {
    const key = encounterId.trim();
    return key ? [...(store.get(key) ?? [])] : [];
}

export function setMockOrders(encounterId: string, orders: RadiologyOrder[]): void {
    store.set(encounterId.trim(), orders);
}

export function findMockOrder(encounterId: string, orderId: string): RadiologyOrder | undefined {
    return getMockOrders(encounterId).find(
        (o) => o._id === orderId || o.id === orderId || o.orderId === orderId
    );
}

export function updateMockOrder(encounterId: string, updated: RadiologyOrder): RadiologyOrder {
    const list = getMockOrders(encounterId);
    const id = updated._id ?? updated.id ?? updated.orderId ?? '';
    const idx = list.findIndex((o) => (o._id ?? o.id ?? o.orderId) === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...updated };
    else list.push(updated);
    setMockOrders(encounterId, list);
    return updated;
}
