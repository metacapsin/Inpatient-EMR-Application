/** Unified inpatient orders dashboard — aggregator row shape (matches backend contract). */

export const UNIFIED_ORDER_TYPES = [
    'medication',
    'lab',
    'radiology',
    'dietary',
    'therapy',
    'procedure',
] as const;

export type UnifiedOrderType = (typeof UNIFIED_ORDER_TYPES)[number];

export const UNIFIED_ORDER_PRIORITIES = ['stat', 'urgent', 'routine'] as const;

export type UnifiedOrderPriority = (typeof UNIFIED_ORDER_PRIORITIES)[number];

/** Normalized lifecycle across source modules (CPOE + radiology + lab). */
export const UNIFIED_ORDER_STATUSES = [
    'pending',
    'accepted',
    'in_progress',
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
    canAcknowledge: boolean;
    canCancel: boolean;
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
