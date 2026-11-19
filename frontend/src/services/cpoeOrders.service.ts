import api from './api';
import type { CpoeOrderRow, OrderSet, OrderSetInput, PlaceOrderBody } from '../types/cpoeOrders';

type Envelope<T> = { status: string; message?: string; data?: T };

export async function placeOrder(body: PlaceOrderBody): Promise<CpoeOrderRow> {
    const { data } = await api.post<Envelope<CpoeOrderRow>>('/api/orders', body);
    if (!data?.data) throw new Error(data?.message || 'Order was not created');
    return data.data;
}

export async function listEncounterOrders(encounterId: string): Promise<CpoeOrderRow[]> {
    const { data } = await api.get<Envelope<CpoeOrderRow[]>>(`/api/encounters/${encodeURIComponent(encounterId)}/orders`);
    return data?.data ?? [];
}

/** 'active' (resume from held) needs no reason; every other transition does. */
export async function updateOrderStatus(orderId: string, status: 'active' | 'held' | 'discontinued' | 'cancelled', reason?: string): Promise<CpoeOrderRow> {
    const { data } = await api.put<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/status`, { status, reason });
    if (!data?.data) throw new Error(data?.message || 'Order status was not updated');
    return data.data;
}

export async function acknowledgeOrder(orderId: string): Promise<CpoeOrderRow> {
    const { data } = await api.post<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/acknowledge`, {});
    if (!data?.data) throw new Error(data?.message || 'Order was not acknowledged');
    return data.data;
}

export async function cosignOrder(orderId: string): Promise<CpoeOrderRow> {
    const { data } = await api.post<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/cosign`, {});
    if (!data?.data) throw new Error(data?.message || 'Order was not co-signed');
    return data.data;
}

export async function renewOrder(orderId: string): Promise<CpoeOrderRow> {
    const { data } = await api.post<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/renew`, {});
    if (!data?.data) throw new Error(data?.message || 'Order was not renewed');
    return data.data;
}

export async function modifyOrder(orderId: string, detail: Record<string, unknown>): Promise<CpoeOrderRow> {
    const { data } = await api.post<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/modify`, detail);
    if (!data?.data) throw new Error(data?.message || 'Order was not modified');
    return data.data;
}

// ------------------------------------------------------------------------------- order sets
export async function listOrderSets(): Promise<OrderSet[]> {
    const { data } = await api.get<Envelope<OrderSet[]>>('/api/order-sets');
    return data?.data ?? [];
}

export async function getOrderSet(id: string): Promise<OrderSet> {
    const { data } = await api.get<Envelope<OrderSet>>(`/api/order-sets/${encodeURIComponent(id)}`);
    if (!data?.data) throw new Error(data?.message || 'Order set not found');
    return data.data;
}

export async function createOrderSet(body: OrderSetInput): Promise<OrderSet> {
    const { data } = await api.post<Envelope<OrderSet>>('/api/order-sets', body);
    if (!data?.data) throw new Error(data?.message || 'Order set was not created');
    return data.data;
}

export async function updateOrderSet(id: string, body: Partial<OrderSetInput> & { isActive?: boolean }): Promise<OrderSet> {
    const { data } = await api.put<Envelope<OrderSet>>(`/api/order-sets/${encodeURIComponent(id)}`, body);
    if (!data?.data) throw new Error(data?.message || 'Order set was not updated');
    return data.data;
}

export async function retireOrderSet(id: string): Promise<void> {
    await api.delete(`/api/order-sets/${encodeURIComponent(id)}`);
}

export async function placeOrderSet(id: string, patientId: string, encounterId: string): Promise<CpoeOrderRow[]> {
    const { data } = await api.post<Envelope<CpoeOrderRow[]>>(`/api/order-sets/${encodeURIComponent(id)}/place`, { patientId, encounterId });
    return data?.data ?? [];
}
