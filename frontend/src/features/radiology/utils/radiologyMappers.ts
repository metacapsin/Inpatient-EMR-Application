import type { RadiologyOrder } from '../types/radiologyOrder.types';

export function resolveOrderId(order: RadiologyOrder): string {
    return String(order._id ?? order.id ?? order.orderId ?? '').trim();
}

export function formatRadiologyDateTime(iso: string | undefined | null): string {
    if (!iso?.trim()) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function buildSpecialInstructionsPayload(
    specialInstructions: string,
    relevantLabValues: string,
    pregnancyStatus: string
): string | undefined {
    const parts: string[] = [];
    const labs = relevantLabValues.trim();
    const preg = pregnancyStatus.trim();
    if (labs) parts.push(`Relevant lab values: ${labs}`);
    if (preg && preg !== 'Not applicable') parts.push(`Pregnancy status: ${preg}`);
    const base = specialInstructions.trim();
    if (base) parts.push(base);
    const combined = parts.join('\n');
    return combined || undefined;
}
