/** Unified inpatient orders dashboard — aggregator row shape (matches backend contract). */

export const UNIFIED_ORDER_TYPES = [
    'medication',
    'lab',
    'radiology',
    'dietary',
    'therapy',
    'procedure',
    'consult',
    'nursing',
] as const;

export type UnifiedOrderType = (typeof UNIFIED_ORDER_TYPES)[number];

export const UNIFIED_ORDER_PRIORITIES = ['stat', 'urgent', 'routine'] as const;

export type UnifiedOrderPriority = (typeof UNIFIED_ORDER_PRIORITIES)[number];

/** Normalized lifecycle across source modules (CPOE + radiology + lab).
 * 'in_progress' was removed — the real data path never produced it, only the mock store did. */
export const UNIFIED_ORDER_STATUSES = [
    'pending',
    'accepted',
    'held',
    'completed',
    'cancelled',
] as const;

export type UnifiedOrderStatus = (typeof UNIFIED_ORDER_STATUSES)[number];

export type UnifiedOrderDeepLink = {
    path: string;
    query?: Record<string, string>;
};

export type UnifiedOrderRow = {
    id: string;
    sourceOrderId: string;
    sourceModule: UnifiedOrderType;
    orderType: UnifiedOrderType;
    patientId: string;
    patientName: string;
    mrn?: string;
    encounterId: string;
    unitId?: string;
    unitName?: string;
    summary: string;
    status: UnifiedOrderStatus;
    priority: UnifiedOrderPriority;
    orderedAt: string;
    orderedByName?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    isVerbal?: boolean;
    requiresCosign?: boolean;
    cosignedBy?: string | null;
    reason?: string | null;
    canAcknowledge: boolean;
    canCancel: boolean;
    canHold?: boolean;
    canResume?: boolean;
    canRenew?: boolean;
    canModify?: boolean;
    /** True when a live source module exists (medication, lab, radiology). */
    canOpenSource: boolean;
    /** Present only when {@link canOpenSource} is true. */
    deepLink?: UnifiedOrderDeepLink;
};

export type UnifiedOrdersListParams = {
    patientSearch?: string;
    unitId?: string;
    orderTypes?: UnifiedOrderType[];
    statuses?: UnifiedOrderStatus[];
    priorities?: UnifiedOrderPriority[];
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
};

export type UnifiedOrdersListResponse = {
    items: UnifiedOrderRow[];
    total: number;
    page: number;
    limit: number;
};

export type UnifiedOrderActionResult = {
    ok: boolean;
    message?: string;
    order?: UnifiedOrderRow;
};

export type UnifiedOrdersApiEnvelope<T> = {
    status: string;
    message?: string;
    data?: T;
};
