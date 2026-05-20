/**
 * Unified inpatient orders aggregator — read-only aggregation over source modules.
 * Does NOT persist orders; delegates acknowledge/cancel to owning services.
 *
 * Intended routes (EMR-Backend):
 *   GET  /api/inpatient/orders
 *   POST /api/inpatient/orders/:aggregatedOrderId/acknowledge
 *   POST /api/inpatient/orders/:aggregatedOrderId/cancel
 *
 * Aggregated id format: `agg-{sourceModule}-{sourceOrderId}` (stable composite key).
 */

/** @typedef {'medication'|'lab'|'radiology'|'dietary'|'therapy'|'procedure'} UnifiedOrderType */
/** @typedef {'stat'|'urgent'|'routine'} UnifiedOrderPriority */
/** @typedef {'pending'|'accepted'|'in_progress'|'completed'|'cancelled'} UnifiedOrderStatus */

/**
 * @typedef {Object} UnifiedOrderRow
 * @property {string} id
 * @property {string} sourceOrderId
 * @property {UnifiedOrderType} sourceModule
 * @property {UnifiedOrderType} orderType
 * @property {string} patientId
 * @property {string} patientName
 * @property {string} [mrn]
 * @property {string} encounterId
 * @property {string} [unitId]
 * @property {string} [unitName]
 * @property {string} summary
 * @property {UnifiedOrderStatus} status
 * @property {UnifiedOrderPriority} priority
 * @property {string} orderedAt
 * @property {string} [orderedByName]
 * @property {string} [acknowledgedAt]
 * @property {string} [acknowledgedBy]
 * @property {boolean} canAcknowledge
 * @property {boolean} canCancel
 * @property {{ path: string, query?: Record<string, string> }} deepLink
 */

const UNIFIED_ORDER_TYPES = ['medication', 'lab', 'radiology', 'dietary', 'therapy', 'procedure'];
const UNIFIED_ORDER_STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
const UNIFIED_ORDER_PRIORITIES = ['stat', 'urgent', 'routine'];

/** In-memory mock until source collectors are wired (dev / integration tests). */
let mockRows = buildMockSeed();

function hoursAgo(h) {
    return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function aggregatedId(sourceModule, sourceOrderId) {
    return `agg-${sourceModule}-${sourceOrderId}`;
}

function parseAggregatedId(id) {
    const m = String(id).match(/^agg-([^-]+)-(.+)$/);
    if (!m) return null;
    return { sourceModule: m[1], sourceOrderId: m[2] };
}

function computeActions(status, acknowledgedAt) {
    const terminal = status === 'completed' || status === 'cancelled';
    return {
        canAcknowledge: !terminal && status === 'pending' && !acknowledgedAt,
        canCancel: !terminal,
    };
}

/** @returns {import('./orderAggregatorService').UnifiedOrderDeepLink | null} */
function deepLinkFor(order) {
    const patientId = String(order.patientId || '').trim();
    const encounterId = String(order.encounterId || '').trim();
    if (!patientId) return null;

    switch (order.orderType) {
        case 'medication': {
            const query = { patientId };
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

function withSourceRouting(row) {
    const deepLink = deepLinkFor(row);
    return {
        ...row,
        canOpenSource: deepLink != null,
        ...(deepLink ? { deepLink } : {}),
    };
}

/** Keep in sync with src/mocks/demoPatientRegistry.ts */
const DEMO_PATIENTS = [
    { id: '696b3e59d0c882d0b569684f', patientName: 'Akbaruddin AO Owaisi', mrn: '25000207' },
    { id: '696b3e59d0c882d0b569684e', patientName: 'Jane M Doe', mrn: '25000208' },
    { id: '696b3e59d0c882d0b569684d', patientName: 'John Smith', mrn: '25000209' },
    { id: '696b3e59d0c882d0b569684c', patientName: 'Maria R Garcia', mrn: '25000210' },
];

function buildMockSeed() {
    const p0 = DEMO_PATIENTS[0];
    const p1 = DEMO_PATIENTS[1];
    const raw = [
        {
            sourceModule: 'medication',
            sourceOrderId: 'cpoe-med-101',
            patientId: p0.id,
            patientName: p0.patientName,
            mrn: p0.mrn,
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
            sourceModule: 'lab',
            sourceOrderId: 'lab-5501',
            patientId: p0.id,
            patientName: p0.patientName,
            mrn: p0.mrn,
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
            sourceModule: 'radiology',
            sourceOrderId: 'rad-mock-002',
            patientId: p1.id,
            patientName: p1.patientName,
            mrn: p1.mrn,
            encounterId: '',
            unitId: '2',
            unitName: 'Med/Surg 4B',
            summary: 'CT Chest w/ contrast',
            status: 'pending',
            priority: 'stat',
            orderedAt: hoursAgo(0.9),
            orderedByName: 'Dr. Casey Nguyen',
        },
    ];

    return raw.map((r) => {
        const orderType = r.sourceModule;
        const actions = computeActions(r.status, r.acknowledgedAt);
        const base = { ...r, orderType, id: aggregatedId(r.sourceModule, r.sourceOrderId) };
        return {
            ...withSourceRouting(base),
            ...actions,
        };
    });
}

/**
 * Normalize radiology status to unified lifecycle.
 * @param {string} status
 * @returns {UnifiedOrderStatus}
 */
function normalizeRadiologyStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s === 'final' || s === 'amended') return 'completed';
    if (s === 'preliminary' || s === 'in progress') return 'in_progress';
    if (s === 'scheduled' || s === 'patient arrived') return 'accepted';
    return 'pending';
}

/**
 * Normalize CPOE order status.
 * @param {string} status
 * @returns {UnifiedOrderStatus}
 */
function normalizeCpoeStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s === 'completed') return 'completed';
    if (s === 'in_progress' || s === 'in progress') return 'in_progress';
    if (s === 'accepted') return 'accepted';
    return 'pending';
}

/**
 * @param {Record<string, unknown>} query
 * @returns {Promise<{ items: UnifiedOrderRow[], total: number, page: number, limit: number }>}
 */
async function listAggregatedOrders(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const patientSearch = String(query.patientSearch || '').trim().toLowerCase();
    const unitId = String(query.unitId || '').trim();
    const orderTypes = String(query.orderTypes || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const statuses = String(query.statuses || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const priorities = String(query.priorities || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const dateFrom = String(query.dateFrom || '').trim();
    const dateTo = String(query.dateTo || '').trim();

    // Production: Promise.all([
    //   collectMedicationOrders(filters),
    //   collectLabOrders(filters),
    //   collectRadiologyOrders(filters),
    //   collectCpoeOrders(filters, ['dietary','therapy','procedure']),
    // ]).then(flatten + map to UnifiedOrderRow)

    let items = [...mockRows];

    if (patientSearch) {
        items = items.filter((r) => {
            const hay = [r.patientName, r.mrn, r.summary, r.orderedByName, r.patientId].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(patientSearch);
        });
    }
    if (unitId) items = items.filter((r) => r.unitId === unitId);
    if (orderTypes.length) {
        const set = new Set(orderTypes);
        items = items.filter((r) => set.has(r.orderType));
    }
    if (statuses.length) {
        const set = new Set(statuses);
        items = items.filter((r) => set.has(r.status));
    }
    if (priorities.length) {
        const set = new Set(priorities);
        items = items.filter((r) => set.has(r.priority));
    }
    if (dateFrom || dateTo) {
        items = items.filter((r) => {
            const t = new Date(r.orderedAt).getTime();
            if (Number.isNaN(t)) return true;
            if (dateFrom && t < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
            if (dateTo && t > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
            return true;
        });
    }

    items.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

    const total = items.length;
    const start = (page - 1) * limit;
    return {
        items: items.slice(start, start + limit),
        total,
        page,
        limit,
    };
}

/**
 * @param {string} aggregatedOrderId
 * @param {{ acknowledgedBy?: string }} [body]
 * @returns {Promise<UnifiedOrderRow>}
 */
async function acknowledgeAggregatedOrder(aggregatedOrderId, body = {}) {
    const parsed = parseAggregatedId(aggregatedOrderId);
    if (!parsed) {
        const err = new Error('Invalid aggregated order id');
        err.statusCode = 400;
        throw err;
    }

    // Production: switch (parsed.sourceModule) { case 'radiology': return radiologyService.acknowledge(...); ... }

    const idx = mockRows.findIndex((r) => r.id === aggregatedOrderId);
    if (idx < 0) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }
    const cur = mockRows[idx];
    if (!cur.canAcknowledge) {
        const err = new Error('Order cannot be acknowledged');
        err.statusCode = 409;
        throw err;
    }
    const status = cur.status === 'pending' ? 'accepted' : cur.status;
    const acknowledgedAt = new Date().toISOString();
    const updated = {
        ...cur,
        status,
        acknowledgedAt,
        acknowledgedBy: String(body.acknowledgedBy || 'Staff').trim() || 'Staff',
        ...computeActions(status, acknowledgedAt),
    };
    mockRows = [...mockRows.slice(0, idx), updated, ...mockRows.slice(idx + 1)];
    return updated;
}

/**
 * @param {string} aggregatedOrderId
 * @param {{ cancelReason?: string, cancelledBy?: string }} [body]
 * @returns {Promise<UnifiedOrderRow>}
 */
async function cancelAggregatedOrder(aggregatedOrderId, body = {}) {
    const parsed = parseAggregatedId(aggregatedOrderId);
    if (!parsed) {
        const err = new Error('Invalid aggregated order id');
        err.statusCode = 400;
        throw err;
    }

    // Production: delegate to clinicalApi.updateOrderStatus / radiology cancel / lab cancel

    const idx = mockRows.findIndex((r) => r.id === aggregatedOrderId);
    if (idx < 0) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }
    const cur = mockRows[idx];
    if (!cur.canCancel) {
        const err = new Error('Order cannot be cancelled');
        err.statusCode = 409;
        throw err;
    }
    const updated = {
        ...cur,
        status: 'cancelled',
        ...computeActions('cancelled', cur.acknowledgedAt),
    };
    mockRows = [...mockRows.slice(0, idx), updated, ...mockRows.slice(idx + 1)];
    return updated;
}

module.exports = {
    UNIFIED_ORDER_TYPES,
    UNIFIED_ORDER_STATUSES,
    UNIFIED_ORDER_PRIORITIES,
    aggregatedId,
    parseAggregatedId,
    normalizeRadiologyStatus,
    normalizeCpoeStatus,
    listAggregatedOrders,
    acknowledgeAggregatedOrder,
    cancelAggregatedOrder,
    deepLinkFor,
    withSourceRouting,
};
