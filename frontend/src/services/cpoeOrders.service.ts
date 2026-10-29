import api from './api';
import type { CpoeOrderRow, PlaceOrderBody } from '../types/cpoeOrders';

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

export async function updateOrderStatus(orderId: string, status: 'discontinued' | 'cancelled'): Promise<CpoeOrderRow> {
    const { data } = await api.put<Envelope<CpoeOrderRow>>(`/api/orders/${encodeURIComponent(orderId)}/status`, { status });
    if (!data?.data) throw new Error(data?.message || 'Order status was not updated');
    return data.data;
}
