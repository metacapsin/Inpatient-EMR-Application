import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, badRequest, conflict, h, notFound, ok, created, parse, row } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

const TERMINAL_STATUSES = ['completed', 'discontinued', 'cancelled'];

// Unified order-entry: one write path (POST /api/orders) that inserts into the correct detail
// table (medications / prn_stat_orders / lab_orders / radiology_orders — unchanged, still directly
// writable via their own existing endpoints) plus a row in the `orders` ledger that points at it,
// so every order type becomes queryable together by encounter. See cpoe_build_plan.md.
export const ordersRouter = Router();

const optText = (max = 500) => z.string().trim().max(max).optional().nullable();
const ts = z.string().datetime({ offset: true }).or(z.string().datetime({ local: true }));

async function assertEncounter(req, encounterId, patientId) {
    const r = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Encounter not found');
    if (r.rows[0].patient_id !== patientId) throw badRequest('Encounter does not belong to this patient');
    return r.rows[0];
}

// ----------------------------------------------------------------- order-type variants
// Same field shapes the four existing endpoints already validate (see medication.js, records.js,
// clinicalOps.js) — `encounterId` is newly required on all four here because the orders ledger
// row points at exactly one encounter.
const medicationVariant = z.object({
    orderType: z.literal('medication'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    dose: z.string().max(100).optional(),
    route: z.string().max(50).optional(),
    frequency: z.string().max(100).optional(),
    nextScheduledTime: ts.optional(),
});

const prnStatVariant = z.object({
    orderType: z.literal('prn_stat'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    medicationName: z.string().trim().min(1).max(200),
    type: z.enum(['PRN', 'STAT']),
    indication: z.string().trim().min(1).max(500),
    lastGivenTime: ts.optional().or(z.literal('')),
    interval: z.string().max(100).optional(),
    maxDose: z.string().max(100).optional(),
    orderedTime: ts,
    urgencyLevel: z.string().max(50).optional(),
    givenBy: z.string().trim().min(1).max(200),
    doctorApproval: z.string().max(200).optional(),
    remarks: z.string().max(1000).optional(),
});

const labVariant = z.object({
    orderType: z.literal('lab'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    labTests: z.array(z.object({ name: z.string().trim().min(1).max(200), code: optText(30), specimen: optText(60) })).min(1).max(50),
    orderDate: z.preprocess((v) => (v === '' ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD').nullable().optional()),
    priority: z.enum(['Routine', 'Urgent', 'STAT']).default('Routine'),
    orderingProviderName: optText(200),
    officeNotes: optText(2000),
    patientContactNotes: optText(2000),
});

const radiologyVariant = z.object({
    orderType: z.literal('radiology'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    modality: z.string().trim().min(1).max(40),
    bodyRegion: z.string().trim().min(1).max(80),
    laterality: optText(30),
    contrast: optText(60),
    clinicalIndication: z.string().trim().min(1).max(1000),
    icd10Codes: z.array(z.string().trim().min(1).max(12)).max(20).default([]),
    priority: z.enum(['Routine', 'Urgent', 'STAT']).default('Routine'),
    specialInstructions: optText(1000),
    transportRequired: z.boolean().default(false),
    scheduledFor: ts.optional().nullable(),
});

const orderBody = z.discriminatedUnion('orderType', [medicationVariant, prnStatVariant, labVariant, radiologyVariant]);

// ----------------------------------------------------------------- write path
ordersRouter.post('/api/orders', requireRole('physician', 'nurse'), h(async (req, res) => {
    const b = parse(orderBody, req.body);

    // Radiology stays physician-only, same as /api/Radiology/order — the router-level gate above
    // is the union of what all four order types allow, so this rule applies only here.
    if (b.orderType === 'radiology' && req.user.role !== 'physician' && req.user.role !== 'admin') {
        throw new ApiError(403, 'You do not have permission to perform this action');
    }

    await assertEncounter(req, b.encounterId, b.patientId);

    const out = await withTx(async (db) => {
        let detail;
        let refTable;

        if (b.orderType === 'medication') {
            refTable = 'medications';
            detail = (await db.query(
                `INSERT INTO medications (tenant_id, patient_id, encounter_id, name, dose, route, frequency, next_scheduled_time)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [req.user.tenantId, b.patientId, b.encounterId, b.name, b.dose ?? null, b.route ?? null, b.frequency ?? null, b.nextScheduledTime ?? null],
            )).rows[0];
        } else if (b.orderType === 'prn_stat') {
            refTable = 'prn_stat_orders';
            detail = (await db.query(
                `INSERT INTO prn_stat_orders (tenant_id, patient_id, encounter_id, medication_name, order_type, indication, last_given_time, dose_interval, max_dose,
                                              ordered_time, urgency_level, given_by, doctor_approval, remarks)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
                [req.user.tenantId, b.patientId, b.encounterId, b.medicationName, b.type, b.indication, b.lastGivenTime || null, b.interval ?? null, b.maxDose ?? null,
                 b.orderedTime, b.urgencyLevel ?? null, b.givenBy, b.doctorApproval ?? null, b.remarks ?? null],
            )).rows[0];
        } else if (b.orderType === 'lab') {
            refTable = 'lab_orders';
            detail = (await db.query(
                `INSERT INTO lab_orders (tenant_id, patient_id, encounter_id, lab_tests, order_date, priority, ordering_provider_name, office_notes, patient_contact_notes, created_by)
                 VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10) RETURNING *`,
                [req.user.tenantId, b.patientId, b.encounterId, JSON.stringify(b.labTests), b.orderDate ?? null, b.priority, b.orderingProviderName || req.user.name || null, b.officeNotes || null, b.patientContactNotes || null, req.user.id],
            )).rows[0];
        } else {
            refTable = 'radiology_orders';
            detail = (await db.query(
                `INSERT INTO radiology_orders (tenant_id, patient_id, encounter_id, modality, body_region, laterality, contrast, clinical_indication, icd10_codes,
                                               priority, special_instructions, transport_required, scheduled_for, ordered_by, ordered_by_name)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
                [req.user.tenantId, b.patientId, b.encounterId, b.modality, b.bodyRegion, b.laterality || null, b.contrast || null, b.clinicalIndication, JSON.stringify(b.icd10Codes),
                 b.priority, b.specialInstructions || null, b.transportRequired, b.scheduledFor ?? null, req.user.id, req.user.name || req.user.email],
            )).rows[0];
        }

        const ledger = (await db.query(
            `INSERT INTO orders (tenant_id, patient_id, encounter_id, order_type, ref_table, ref_id, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.orderType, refTable, detail.id, req.user.id],
        )).rows[0];

        return { ledger, detail };
    });

    created(res, { ...row(out.ledger), detail: row(out.detail) });
}));

// ----------------------------------------------------------------- read paths
const DETAIL_TABLES = { medication: 'medications', prn_stat: 'prn_stat_orders', lab: 'lab_orders', radiology: 'radiology_orders' };

async function hydrateDetails(req, ledgerRows) {
    const byType = new Map();
    for (const o of ledgerRows) {
        if (!byType.has(o.order_type)) byType.set(o.order_type, []);
        byType.get(o.order_type).push(o.ref_id);
    }
    const detailById = new Map();
    for (const [orderType, ids] of byType) {
        const table = DETAIL_TABLES[orderType];
        const r = await query(`SELECT * FROM ${table} WHERE tenant_id = $1 AND id = ANY($2::text[])`, [req.user.tenantId, ids]);
        for (const d of r.rows) detailById.set(`${orderType}:${d.id}`, d);
    }
    return ledgerRows.map((o) => ({ ...row(o), detail: row(detailById.get(`${o.order_type}:${o.ref_id}`)) ?? null }));
}

ordersRouter.get('/api/encounters/:encounterId/orders', h(async (req, res) => {
    const enc = await query('SELECT 1 FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.encounterId, req.user.tenantId]);
    if (!enc.rowCount) throw notFound('Encounter not found');
    const ledger = await query('SELECT * FROM orders WHERE encounter_id = $1 AND tenant_id = $2 ORDER BY ordered_at DESC', [req.params.encounterId, req.user.tenantId]);
    ok(res, await hydrateDetails(req, ledger.rows));
}));

ordersRouter.get('/api/orders/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM orders WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Order not found');
    const [out] = await hydrateDetails(req, r.rows);
    ok(res, out);
}));

// A basic status flip on the ledger row only (no detail-table changes, no reason/cosign) — the
// "real cancel/discontinue workflow" the plan deferred is a later pass; this is deliberately just
// that flip, used by both the per-encounter timeline (Cancel/Discontinue) and the orders dashboard
// (Cancel, below) so there is exactly one place this transition happens.
ordersRouter.put('/api/orders/:id/status', requireRole('physician', 'nurse'), h(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['discontinued', 'cancelled']) }), req.body);
    const out = await withTx(async (db) => {
        const o = (await db.query('SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, req.user.tenantId])).rows[0];
        if (!o) throw notFound('Order not found');
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        return (await db.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [b.status, o.id])).rows[0];
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));

// ----------------------------------------------------------------- orders dashboard (cross-patient)
// `frontend/src/features/order-dashboard` — a hospital-wide worklist across units, not scoped to one
// encounter, so it needs its own aggregate query rather than GET /api/encounters/:id/orders above.
// It folds `prn_stat` into the `medication` bucket (the dashboard's type system predates this ledger
// and has no separate PRN/STAT type) and derives a dashboard-shaped status/priority per order type,
// since neither is uniform across the four detail tables.
const LEDGER_TO_DASHBOARD_TYPE = { medication: 'medication', prn_stat: 'medication', lab: 'lab', radiology: 'radiology' };
const LEDGER_TO_DASHBOARD_STATUS = { draft: 'pending', active: 'pending', completed: 'completed', discontinued: 'cancelled', cancelled: 'cancelled' };

function summarizeOrder(orderType, detail) {
    const d = detail ?? {};
    switch (orderType) {
        case 'medication':
            return [d.name, d.dose, d.route, d.frequency].filter(Boolean).join(' ') || 'Medication order';
        case 'prn_stat':
            return [d.medicationName, d.indication].filter(Boolean).join(' — ') || 'PRN/STAT order';
        case 'lab': {
            const tests = Array.isArray(d.labTests) ? d.labTests.map((t) => t.name).filter(Boolean) : [];
            return tests.length ? tests.join(', ') : 'Lab order';
        }
        case 'radiology':
            return [d.modality, d.bodyRegion].filter(Boolean).join(' ') || 'Radiology order';
        default:
            return 'Order';
    }
}

// No order type carries a dashboard-style priority uniformly: lab/radiology have their own
// Routine/Urgent/STAT field, medication has none, and prn_stat only distinguishes PRN vs STAT.
function priorityOf(orderType, detail) {
    const d = detail ?? {};
    if (orderType === 'lab' || orderType === 'radiology') {
        const p = String(d.priority || '').toLowerCase();
        return p === 'stat' ? 'stat' : p === 'urgent' ? 'urgent' : 'routine';
    }
    if (orderType === 'prn_stat') return d.orderType === 'STAT' ? 'stat' : 'routine';
    return 'routine';
}

function toDashboardRow(o) {
    const patientName = `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || 'Unknown patient';
    const orderedByName = [o.ordererFirstName, o.ordererLastName].filter(Boolean).join(' ').trim() || o.ordererEmail || undefined;
    return {
        id: o.id,
        sourceOrderId: o.refId,
        sourceModule: LEDGER_TO_DASHBOARD_TYPE[o.orderType] ?? o.orderType,
        orderType: LEDGER_TO_DASHBOARD_TYPE[o.orderType] ?? o.orderType,
        patientId: o.patientId,
        patientName,
        mrn: o.mrn ?? undefined,
        encounterId: o.encounterId,
        unitId: o.wardId ?? undefined,
        unitName: o.wardName ?? undefined,
        summary: summarizeOrder(o.orderType, o.detail),
        status: LEDGER_TO_DASHBOARD_STATUS[o.status] ?? 'pending',
        priority: priorityOf(o.orderType, o.detail),
        orderedAt: o.orderedAt,
        orderedByName,
        // No acknowledgement concept exists at the ledger level yet — only a basic status flip
        // (above), so the dashboard's separate "Acknowledge" action has nothing to call.
        canAcknowledge: false,
        canCancel: !TERMINAL_STATUSES.includes(o.status),
    };
}

/** Same join (patient/ward/orderer) backing both the list below and the single-row cancel response. */
async function queryDashboardOrders(req, extraWhere = [], extraParams = []) {
    const params = [req.user.tenantId, ...extraParams];
    const where = ['o.tenant_id = $1', ...extraWhere];
    const r = await query(
        `SELECT o.*, p.first_name, p.last_name, p.mrn,
                w.id AS ward_id, w.name AS ward_name,
                u.first_name AS orderer_first_name, u.last_name AS orderer_last_name, u.email AS orderer_email
         FROM orders o
         JOIN patients p ON p.id = o.patient_id
         JOIN encounters e ON e.id = o.encounter_id
         LEFT JOIN beds bd ON bd.id = e.bed_id
         LEFT JOIN rooms rm ON rm.id = bd.room_id
         LEFT JOIN wards w ON w.id = rm.ward_id
         LEFT JOIN users u ON u.id = o.ordered_by
         WHERE ${where.join(' AND ')}
         ORDER BY o.ordered_at DESC
         LIMIT 2000`,
        params,
    );
    return hydrateDetails(req, r.rows);
}

ordersRouter.get('/api/inpatient/orders', h(async (req, res) => {
    const q = parse(
        z.object({
            patientSearch: z.string().trim().max(200).optional(),
            unitId: z.string().trim().min(1).optional(),
            orderTypes: z.string().trim().optional(),
            statuses: z.string().trim().optional(),
            priorities: z.string().trim().optional(),
            dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(25),
        }),
        req.query,
    );

    const extraWhere = [];
    const extraParams = [];
    const add = (sql, v) => { extraParams.push(v); extraWhere.push(sql.replace('?', `$${extraParams.length + 1}`)); };

    if (q.patientSearch) {
        extraParams.push(`%${q.patientSearch.replace(/[\\%_]/g, '\\$&')}%`);
        const n = extraParams.length + 1;
        extraWhere.push(`(p.first_name || ' ' || p.last_name ILIKE $${n} OR p.mrn ILIKE $${n})`);
    }
    if (q.unitId) add('w.id = ?', q.unitId);
    if (q.orderTypes) {
        const requested = q.orderTypes.split(',').map((t) => t.trim()).filter(Boolean);
        const ledgerTypes = requested.flatMap((t) => (t === 'medication' ? ['medication', 'prn_stat'] : [t]));
        if (ledgerTypes.length) add('o.order_type = ANY(?::text[])', ledgerTypes);
    }
    if (q.dateFrom) add('o.ordered_at >= ?::date', q.dateFrom);
    if (q.dateTo) add(`o.ordered_at < (?::date + 1)`, q.dateTo);

    const hydrated = await queryDashboardOrders(req, extraWhere, extraParams);
    let items = hydrated.map(toDashboardRow);

    if (q.statuses) {
        const set = new Set(q.statuses.split(',').map((s) => s.trim()).filter(Boolean));
        items = items.filter((r) => set.has(r.status));
    }
    if (q.priorities) {
        const set = new Set(q.priorities.split(',').map((s) => s.trim()).filter(Boolean));
        items = items.filter((r) => set.has(r.priority));
    }

    const total = items.length;
    const start = (q.page - 1) * q.limit;
    ok(res, { items: items.slice(start, start + q.limit), total, page: q.page, limit: q.limit });
}));

ordersRouter.post('/api/inpatient/orders/:id/cancel', requireRole('physician', 'nurse'), h(async (req, res) => {
    await withTx(async (db) => {
        const o = (await db.query('SELECT status FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, req.user.tenantId])).rows[0];
        if (!o) throw notFound('Order not found');
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['cancelled', req.params.id]);
    });
    const [out] = await queryDashboardOrders(req, ['o.id = $2'], [req.params.id]);
    if (!out) throw notFound('Order not found');
    ok(res, toDashboardRow(out));
}));
