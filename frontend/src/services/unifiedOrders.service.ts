/**
 * Unified Orders Dashboard — mock implementation with documented REST contract.
 *
 * -----------------------------------------------------------------------------
 * REST contract (EMR-Backend / orderAggregatorService)
 * -----------------------------------------------------------------------------
 *
 *   GET  /api/inpatient/orders
 *        ?patientSearch=&unitId=&orderTypes=medication,lab&statuses=pending,accepted
 *        &priorities=stat,urgent&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=1&limit=25
 *
 *   POST /api/inpatient/orders/:aggregatedOrderId/acknowledge
 *        body: { acknowledgedBy?: string }
 *
 *   POST /api/inpatient/orders/:aggregatedOrderId/cancel
 *        body: { cancelReason?: string; cancelledBy?: string }
 *
 * List response: `{ status: 'success', data: UnifiedOrdersListResponse }`
 * Action response: `{ status: 'success', data: UnifiedOrderRow }`
 *
 * Source routing (by orderType):
 *   medication → /app/inpatient/medication-management?patientId&encounterId
 *   lab        → /app/facesheet/:patientId/lab-orders
 *   radiology  → /app/facesheet/:patientId/radiology
 *   dietary | therapy | procedure → canOpenSource: false (no deepLink)
 *
 * Mock patient ids come from {@link demoPatientRegistry} (same fixtures as patient search).
 * Encounter ids are hydrated from GET /api/admissions/active when listing mock orders.
 */

import api from './api';
import { withOrderSourceRouting } from '../features/order-dashboard/orderSourceRouting';
import { demoPatientBySlot } from '../mocks/demoPatientRegistry';
import { activeEncounterRowsToAdtMergePayload, listActiveEncounters } from './adt.service';
import { getWards } from './rooms.service';
import type {
    UnifiedOrderActionResult,
    UnifiedOrderPriority,
    UnifiedOrderRow,
    UnifiedOrdersApiEnvelope,
    UnifiedOrdersListParams,
    UnifiedOrdersListResponse,
    UnifiedOrderStatus,
    UnifiedOrderType,
} from '../types/unifiedOrders';

function useMock(): boolean {
    return import.meta.env.VITE_UNIFIED_ORDERS_MOCK !== 'false';
}

function mockDelay<T>(value: T, ms = 140): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function hoursAgo(h: number): string {
    return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function computeActions(row: Pick<UnifiedOrderRow, 'status' | 'acknowledgedAt'>): {
    canAcknowledge: boolean;
    canCancel: boolean;
} {
    const terminal = row.status === 'completed' || row.status === 'cancelled';
    const canAcknowledge = !terminal && row.status === 'pending' && !row.acknowledgedAt;
    const canCancel = !terminal && row.status !== 'cancelled';
    return { canAcknowledge, canCancel };
}

function aggregatedId(sourceModule: string, sourceOrderId: string): string {
    return `agg-${sourceModule}-${sourceOrderId}`;
}

const P0 = demoPatientBySlot(0);
const P1 = demoPatientBySlot(1);
const P2 = demoPatientBySlot(2);
const P3 = demoPatientBySlot(3);

let encounterIdByPatientCache: Map<string, string> | null = null;
let encounterIdByPatientCacheAt = 0;
const ENCOUNTER_CACHE_MS = 30_000;

async function loadEncounterIdByPatient(): Promise<Map<string, string>> {
    const now = Date.now();
    if (encounterIdByPatientCache && now - encounterIdByPatientCacheAt < ENCOUNTER_CACHE_MS) {
        return encounterIdByPatientCache;
    }
    const map = new Map<string, string>();
    const res = await listActiveEncounters();
    if (res.ok) {
        for (const row of activeEncounterRowsToAdtMergePayload(res.data)) {
            if (row.patientId && row.encounterId) map.set(row.patientId, row.encounterId);
        }
    }
    encounterIdByPatientCache = map;
    encounterIdByPatientCacheAt = now;
    return map;
}

function applyLiveOrderContext(
    row: UnifiedOrderRow,
    encounterByPatient: Map<string, string>
): UnifiedOrderRow {
    const encounterId = encounterByPatient.get(row.patientId.trim()) || '';
    const base: UnifiedOrderRow = { ...row, encounterId };
    const actions = computeActions(base);
    return {
        ...withOrderSourceRouting(base),
        ...actions,
    };
}

async function enrichMockRows(items: UnifiedOrderRow[]): Promise<UnifiedOrderRow[]> {
    const encounterByPatient = await loadEncounterIdByPatient();
    return items.map((r) => applyLiveOrderContext(r, encounterByPatient));
}

async function enrichMockListResponse(res: UnifiedOrdersListResponse): Promise<UnifiedOrdersListResponse> {
    return { ...res, items: await enrichMockRows(res.items) };
}

function buildSeedOrders(): UnifiedOrderRow[] {
    const rows: Array<
        Omit<UnifiedOrderRow, 'id' | 'deepLink' | 'canOpenSource' | 'canAcknowledge' | 'canCancel'>
    > = [
        {
            sourceOrderId: 'cpoe-med-101',
            sourceModule: 'medication',
            orderType: 'medication',
            patientId: P0.id,
            patientName: P0.patientName,
            mrn: P0.mrn,
            encounterId: '',
            unitId: '1',
            unitName: 'ICU West',
            summary: 'Lisinopril 10 mg PO daily',
            status: 'pending',
            priority: 'routine',
            orderedAt: hoursAgo(1.2),
            orderedByName: 'Dr. Riley Hart',
        },
        {
            sourceOrderId: 'cpoe-med-102',
            sourceModule: 'medication',
            orderType: 'medication',
            patientId: P1.id,
            patientName: P1.patientName,
            mrn: P1.mrn,
            encounterId: '',
            unitId: '2',
            unitName: 'Med/Surg 4B',
            summary: 'Vancomycin 1 g IV q12h',
            status: 'in_progress',
            priority: 'urgent',
            orderedAt: hoursAgo(4),
            orderedByName: 'Dr. Casey Nguyen',
            acknowledgedAt: hoursAgo(3.5),
            acknowledgedBy: 'Pharmacy',
        },
        {
            sourceOrderId: 'lab-5501',
            sourceModule: 'lab',
            orderType: 'lab',
            patientId: P0.id,
            patientName: P0.patientName,
            mrn: P0.mrn,
            encounterId: '',
            unitId: '1',
            unitName: 'ICU West',
            summary: 'BMP, CBC, lactate',
            status: 'pending',
            priority: 'stat',
            orderedAt: hoursAgo(0.4),
            orderedByName: 'Dr. Riley Hart',
        },
        {
            sourceOrderId: 'lab-5502',
            sourceModule: 'lab',
            orderType: 'lab',
            patientId: P2.id,
            patientName: P2.patientName,
            mrn: P2.mrn,
            encounterId: '',
            unitId: '3',
            unitName: 'Telemetry',
            summary: 'Troponin ×3, BNP',
            status: 'accepted',
            priority: 'urgent',
            orderedAt: hoursAgo(6),
            orderedByName: 'Dr. Casey Nguyen',
            acknowledgedAt: hoursAgo(5.8),
            acknowledgedBy: 'Lab — Core',
        },
        {
            sourceOrderId: 'rad-mock-002',
            sourceModule: 'radiology',
            orderType: 'radiology',
            patientId: P1.id,
            patientName: P1.patientName,
            mrn: P1.mrn,
            encounterId: '',
            unitId: '2',
            unitName: 'Med/Surg 4B',
            summary: 'CT Chest w/ contrast',
            status: 'pending',
            priority: 'stat',
            orderedAt: hoursAgo(0.9),
            orderedByName: 'Dr. Casey Nguyen',
        },
        {
            sourceOrderId: 'rad-mock-003',
            sourceModule: 'radiology',
            orderType: 'radiology',
            patientId: P0.id,
            patientName: P0.patientName,
            mrn: P0.mrn,
            encounterId: '',
            unitId: '1',
            unitName: 'ICU West',
            summary: 'Portable CXR',
            status: 'completed',
            priority: 'routine',
            orderedAt: hoursAgo(18),
            orderedByName: 'Dr. Riley Hart',
            acknowledgedAt: hoursAgo(17),
            acknowledgedBy: 'Rad Tech',
        },
        {
            sourceOrderId: 'cpoe-diet-01',
            sourceModule: 'dietary',
            orderType: 'dietary',
            patientId: P2.id,
            patientName: P2.patientName,
            mrn: P2.mrn,
            encounterId: '',
            unitId: '3',
            unitName: 'Telemetry',
            summary: 'Cardiac diet — sodium 2 g',
            status: 'accepted',
            priority: 'routine',
            orderedAt: hoursAgo(10),
            orderedByName: 'Dr. Casey Nguyen',
            acknowledgedAt: hoursAgo(9.5),
            acknowledgedBy: 'Dietary',
        },
        {
            sourceOrderId: 'cpoe-pt-01',
            sourceModule: 'therapy',
            orderType: 'therapy',
            patientId: P1.id,
            patientName: P1.patientName,
            mrn: P1.mrn,
            encounterId: '',
            unitId: '2',
            unitName: 'Med/Surg 4B',
            summary: 'PT eval & treat — mobility',
            status: 'pending',
            priority: 'routine',
            orderedAt: hoursAgo(8),
            orderedByName: 'Dr. Casey Nguyen',
        },
        {
            sourceOrderId: 'cpoe-proc-44',
            sourceModule: 'procedure',
            orderType: 'procedure',
            patientId: P0.id,
            patientName: P0.patientName,
            mrn: P0.mrn,
            encounterId: '',
            unitId: '1',
            unitName: 'ICU West',
            summary: 'Central line dressing change',
            status: 'in_progress',
            priority: 'urgent',
            orderedAt: hoursAgo(2),
            orderedByName: 'Dr. Riley Hart',
            acknowledgedAt: hoursAgo(1.8),
            acknowledgedBy: 'Nursing',
        },
        {
            sourceOrderId: 'cpoe-med-103',
            sourceModule: 'medication',
            orderType: 'medication',
            patientId: P3.id,
            patientName: P3.patientName,
            mrn: P3.mrn,
            encounterId: '',
            unitId: '2',
            unitName: 'Med/Surg 4B',
            summary: 'Insulin lispro sliding scale',
            status: 'cancelled',
            priority: 'routine',
            orderedAt: hoursAgo(30),
            orderedByName: 'Dr. Riley Hart',
        },
    ];

    return rows.map((r) => {
        const base = { ...r, id: aggregatedId(r.sourceModule, r.sourceOrderId) };
        const actions = computeActions(base);
        return {
            ...withOrderSourceRouting(base),
            ...actions,
        };
    });
}

let mockStore: UnifiedOrderRow[] = buildSeedOrders();

function matchesSearch(row: UnifiedOrderRow, q: string): boolean {
    const hay = [row.patientName, row.mrn, row.summary, row.orderedByName, row.patientId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

function inDateRange(iso: string, from?: string, to?: string): boolean {
    if (!from && !to) return true;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return true;
    if (from) {
        const f = new Date(`${from}T00:00:00`).getTime();
        if (t < f) return false;
    }
    if (to) {
        const end = new Date(`${to}T23:59:59.999`).getTime();
        if (t > end) return false;
    }
    return true;
}

function filterMock(params: UnifiedOrdersListParams): UnifiedOrdersListResponse {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const q = (params.patientSearch ?? '').trim().toLowerCase();

    let items = [...mockStore];

    if (q) items = items.filter((r) => matchesSearch(r, q));
    if (params.unitId) items = items.filter((r) => r.unitId === params.unitId);
    if (params.orderTypes?.length) {
        const set = new Set(params.orderTypes);
        items = items.filter((r) => set.has(r.orderType));
    }
    if (params.statuses?.length) {
        const set = new Set(params.statuses);
        items = items.filter((r) => set.has(r.status));
    }
    if (params.priorities?.length) {
        const set = new Set(params.priorities);
        items = items.filter((r) => set.has(r.priority));
    }
    items = items.filter((r) => inDateRange(r.orderedAt, params.dateFrom, params.dateTo));

    items.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

    const total = items.length;
    const start = (page - 1) * limit;
    const pageItems = items.slice(start, start + limit);

    return normalizeListResponse({ items: pageItems, total, page, limit });
}

async function filterMockEnriched(params: UnifiedOrdersListParams): Promise<UnifiedOrdersListResponse> {
    const res = filterMock(params);
    return enrichMockListResponse(res);
}

async function mockAcknowledge(id: string, acknowledgedBy?: string): Promise<UnifiedOrderActionResult> {
    const idx = mockStore.findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, message: 'Order not found' };
    const cur = mockStore[idx];
    if (!cur.canAcknowledge) return { ok: false, message: 'Order cannot be acknowledged in its current state' };

    const updated: UnifiedOrderRow = {
        ...cur,
        status: cur.status === 'pending' ? 'accepted' : cur.status,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: acknowledgedBy?.trim() || 'Staff',
        ...computeActions({
            status: cur.status === 'pending' ? 'accepted' : cur.status,
            acknowledgedAt: new Date().toISOString(),
        }),
    };
    mockStore = [...mockStore.slice(0, idx), updated, ...mockStore.slice(idx + 1)];
    const [enriched] = await enrichMockRows([updated]);
    return { ok: true, order: enriched ?? updated };
}

async function mockCancel(id: string, _cancelReason?: string): Promise<UnifiedOrderActionResult> {
    const idx = mockStore.findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, message: 'Order not found' };
    const cur = mockStore[idx];
    if (!cur.canCancel) return { ok: false, message: 'Order cannot be cancelled in its current state' };

    const updated: UnifiedOrderRow = {
        ...cur,
        status: 'cancelled',
        ...computeActions({ status: 'cancelled', acknowledgedAt: cur.acknowledgedAt }),
    };
    mockStore = [...mockStore.slice(0, idx), updated, ...mockStore.slice(idx + 1)];
    const [enriched] = await enrichMockRows([updated]);
    return { ok: true, order: enriched ?? updated };
}

function serializeListParams(params: UnifiedOrdersListParams): Record<string, string> {
    const out: Record<string, string> = {};
    if (params.patientSearch?.trim()) out.patientSearch = params.patientSearch.trim();
    if (params.unitId) out.unitId = params.unitId;
    if (params.orderTypes?.length) out.orderTypes = params.orderTypes.join(',');
    if (params.statuses?.length) out.statuses = params.statuses.join(',');
    if (params.priorities?.length) out.priorities = params.priorities.join(',');
    if (params.dateFrom) out.dateFrom = params.dateFrom;
    if (params.dateTo) out.dateTo = params.dateTo;
    if (params.page != null) out.page = String(params.page);
    if (params.limit != null) out.limit = String(params.limit);
    return out;
}

/** Ensure source routing flags match order TYPE (client-side guard for API payloads). */
function normalizeOrderRow(row: UnifiedOrderRow): UnifiedOrderRow {
    const routed = withOrderSourceRouting(row);
    if (row.canOpenSource === routed.canOpenSource && row.deepLink === routed.deepLink) return row;
    return { ...row, canOpenSource: routed.canOpenSource, deepLink: routed.deepLink };
}

function normalizeListResponse(res: UnifiedOrdersListResponse): UnifiedOrdersListResponse {
    return { ...res, items: res.items.map(normalizeOrderRow) };
}

function unwrapList(body: unknown): UnifiedOrdersListResponse {
    const root = body as UnifiedOrdersApiEnvelope<UnifiedOrdersListResponse>;
    if (root?.data && Array.isArray(root.data.items)) return normalizeListResponse(root.data);
    const direct = body as UnifiedOrdersListResponse;
    if (direct && Array.isArray(direct.items)) return normalizeListResponse(direct);
    return { items: [], total: 0, page: 1, limit: 25 };
}

function unwrapOrder(body: unknown): UnifiedOrderRow | undefined {
    const root = body as UnifiedOrdersApiEnvelope<UnifiedOrderRow>;
    if (root?.data && typeof root.data === 'object' && 'id' in root.data) return normalizeOrderRow(root.data);
    const direct = body as UnifiedOrderRow;
    if (direct?.id) return normalizeOrderRow(direct);
    return undefined;
}

export async function listUnifiedOrders(params: UnifiedOrdersListParams = {}): Promise<UnifiedOrdersListResponse> {
    if (useMock()) return mockDelay(filterMockEnriched(params));

    const { data } = await api.get<UnifiedOrdersApiEnvelope<UnifiedOrdersListResponse>>('/api/inpatient/orders', {
        params: serializeListParams(params),
    });
    return unwrapList(data);
}

export async function acknowledgeUnifiedOrder(
    aggregatedOrderId: string,
    body?: { acknowledgedBy?: string }
): Promise<UnifiedOrderActionResult> {
    if (useMock()) return mockDelay(mockAcknowledge(aggregatedOrderId, body?.acknowledgedBy));

    try {
        const { data } = await api.post<UnifiedOrdersApiEnvelope<UnifiedOrderRow>>(
            `/api/inpatient/orders/${encodeURIComponent(aggregatedOrderId)}/acknowledge`,
            body ?? {}
        );
        const order = unwrapOrder(data);
        return order ? { ok: true, order } : { ok: false, message: 'Unexpected response' };
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Acknowledge failed' };
    }
}

export async function cancelUnifiedOrder(
    aggregatedOrderId: string,
    body?: { cancelReason?: string; cancelledBy?: string }
): Promise<UnifiedOrderActionResult> {
    if (useMock()) return mockDelay(mockCancel(aggregatedOrderId, body?.cancelReason));

    try {
        const { data } = await api.post<UnifiedOrdersApiEnvelope<UnifiedOrderRow>>(
            `/api/inpatient/orders/${encodeURIComponent(aggregatedOrderId)}/cancel`,
            body ?? {}
        );
        const order = unwrapOrder(data);
        return order ? { ok: true, order } : { ok: false, message: 'Unexpected response' };
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Cancel failed' };
    }
}

export async function fetchOrderDashboardWards(): Promise<Array<{ id: string; name: string; code?: string }>> {
    try {
        const wards = await getWards();
        return wards.map((w) => ({ id: String(w.id), name: w.name, code: w.code }));
    } catch {
        return [
            { id: '1', name: 'ICU West', code: 'ICU-W' },
            { id: '2', name: 'Med/Surg 4B', code: 'MS-4B' },
            { id: '3', name: 'Telemetry', code: 'TEL' },
        ];
    }
}

export { buildOrderSourceHref as buildDeepLinkHref } from '../features/order-dashboard/orderSourceRouting';
