import type { UnifiedOrderDeepLink, UnifiedOrderRow, UnifiedOrderType } from '../../types/unifiedOrders';

/** Order types with a live source module in the current inpatient EMR. */
export const ACTIVE_SOURCE_ORDER_TYPES = ['medication', 'lab', 'radiology'] as const;

export type ActiveSourceOrderType = (typeof ACTIVE_SOURCE_ORDER_TYPES)[number];

export const SOURCE_MODULE_UNAVAILABLE_MESSAGE = 'Module under development';

const ACTIVE_SET = new Set<string>(ACTIVE_SOURCE_ORDER_TYPES);

export function isActiveSourceOrderType(orderType: UnifiedOrderType | string): orderType is ActiveSourceOrderType {
    return ACTIVE_SET.has(orderType);
}

export type OrderSourceContext = Pick<UnifiedOrderRow, 'orderType' | 'patientId' | 'encounterId'>;

/**
 * Resolve deep-link to the original source workflow from the order TYPE badge.
 * Returns null for dietary, therapy, procedure (not implemented).
 */
export function resolveOrderSourceDeepLink(order: OrderSourceContext): UnifiedOrderDeepLink | null {
    const patientId = order.patientId?.trim();
    const encounterId = order.encounterId?.trim();
    if (!patientId) return null;

    switch (order.orderType) {
        case 'medication': {
            const query: Record<string, string> = { patientId };
            if (encounterId) query.encounterId = encounterId;
            return { path: '/app/inpatient/medication-management', query };
        }
        case 'lab':
            return { path: `/app/facesheet/${encodeURIComponent(patientId)}/lab-orders` };
        case 'radiology':
            return { path: `/app/facesheet/${encodeURIComponent(patientId)}/radiology` };
        default:
            return null;
    }
}

export function buildOrderSourceHref(link: UnifiedOrderDeepLink | null | undefined): string | null {
    if (!link?.path?.trim()) return null;
    const url = new URL(link.path, window.location.origin);
    if (link.query) {
        Object.entries(link.query).forEach(([k, v]) => {
            if (v) url.searchParams.set(k, v);
        });
    }
    return `${url.pathname}${url.search}`;
}

/** Attach `canOpenSource` and optional `deepLink` for aggregator rows. */
export function withOrderSourceRouting<T extends OrderSourceContext>(
    row: T
): T & Pick<UnifiedOrderRow, 'canOpenSource' | 'deepLink'> {
    const deepLink = resolveOrderSourceDeepLink(row);
    return {
        ...row,
        canOpenSource: deepLink != null,
        ...(deepLink ? { deepLink } : {}),
    };
}
