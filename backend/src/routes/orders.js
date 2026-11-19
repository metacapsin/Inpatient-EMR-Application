import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, badRequest, conflict, h, notFound, ok, created, parse, row } from '../lib/http.js';
import { requireRole, requireClinicalRole } from '../middleware/auth.js';
import { checkInteractions, recordCdsAlerts } from '../lib/cds/check.js';
import { requiresOverride } from '../lib/cds/policy.js';
import { cdsOverrideSchema } from '../lib/cds/schemas.js';
import { resolveLabTestCodes } from '../lib/labCatalog.js';

const TERMINAL_STATUSES = ['completed', 'discontinued', 'cancelled'];

// Unified order-entry: one write path (POST /api/orders) that inserts into the correct detail
// table (medications / prn_stat_orders / lab_orders / radiology_orders / dietary_orders /
// therapy_orders / procedure_orders / consult_orders / nursing_orders) plus a row in the `orders`
// ledger that points at it, so every order type becomes queryable together by encounter.
export const ordersRouter = Router();
const readers = requireRole('physician', 'nurse', 'pharmacist');
const writers = requireRole('physician', 'nurse');
// A verbal order's read-back is performed by whoever takes the call (nurse); the physician
// co-sign that follows is a genuine clinical attestation — admin must not be able to do it on
// someone else's behalf, same reasoning as clinical-note co-sign (SEC-17 family).
const cosigners = requireClinicalRole('physician');

const optText = (max = 500) => z.string().trim().max(max).optional().nullable();
const ts = z.string().datetime({ offset: true }).or(z.string().datetime({ local: true }));
const PRIORITY = z.enum(['routine', 'urgent', 'stat']).default('routine');

async function assertEncounter(req, encounterId, patientId) {
    const r = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Encounter not found');
    if (r.rows[0].patient_id !== patientId) throw badRequest('Encounter does not belong to this patient');
    return r.rows[0];
}

// ----------------------------------------------------------------- order-type variants
// Same field shapes the four original endpoints already validate (see medication.js, records.js,
// clinicalOps.js) — `encounterId` is required on all variants since the orders ledger row points
// at exactly one encounter. `isVerbal`/`readBackConfirmed` are shared across every type: a verbal
// (telephone) order can be any order type, not just medication.
const cdsOverrideField = cdsOverrideSchema.optional();
const verbalFields = {
    isVerbal: z.boolean().default(false),
    readBackConfirmed: z.boolean().default(false),
};

const medicationVariant = z.object({
    orderType: z.literal('medication'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    dose: z.string().max(100).optional(),
    route: z.string().max(50).optional(),
    frequency: z.string().max(100).optional(),
    nextScheduledTime: ts.optional(),
    rxnormCode: z.string().trim().max(20).optional().nullable(),
    priority: PRIORITY,
    cdsOverride: cdsOverrideField,
    ...verbalFields,
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
    rxnormCode: z.string().trim().max(20).optional().nullable(),
    cdsOverride: cdsOverrideField,
    ...verbalFields,
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
    clinicalIndication: optText(1000),
    ...verbalFields,
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
    pregnancyStatus: z.enum(['Not applicable', 'Unknown', 'No', 'Yes']).optional().nullable(),
    contrastAllergy: z.enum(['none', 'unknown', 'confirmed']).optional().nullable(),
    transportRequired: z.boolean().default(false),
    scheduledFor: ts.optional().nullable(),
    ...verbalFields,
});

const dietaryVariant = z.object({
    orderType: z.literal('dietary'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    dietType: z.string().trim().min(1).max(100),
    restrictions: optText(500),
    notes: optText(1000),
    priority: PRIORITY,
    ...verbalFields,
});

const therapyVariant = z.object({
    orderType: z.literal('therapy'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    therapyType: z.string().trim().min(1).max(100),
    frequency: optText(100),
    notes: optText(1000),
    priority: PRIORITY,
    ...verbalFields,
});

const procedureVariant = z.object({
    orderType: z.literal('procedure'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    procedureName: z.string().trim().min(1).max(200),
    laterality: optText(30),
    scheduledFor: ts.optional().nullable(),
    notes: optText(1000),
    priority: PRIORITY,
    ...verbalFields,
});

const consultVariant = z.object({
    orderType: z.literal('consult'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    consultingService: z.string().trim().min(1).max(100),
    reason: z.string().trim().min(1).max(1000),
    priority: PRIORITY,
    ...verbalFields,
});

const nursingVariant = z.object({
    orderType: z.literal('nursing'),
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    nursingOrderType: z.string().trim().min(1).max(100),
    details: optText(1000),
    priority: PRIORITY,
    ...verbalFields,
});

const ORDER_VARIANTS = [medicationVariant, prnStatVariant, labVariant, radiologyVariant, dietaryVariant, therapyVariant, procedureVariant, consultVariant, nursingVariant];

const orderBody = z.discriminatedUnion('orderType', ORDER_VARIANTS).superRefine((b, ctx) => {
    if (b.isVerbal && !b.readBackConfirmed) {
        ctx.addIssue({ code: 'custom', path: ['readBackConfirmed'], message: 'A verbal/telephone order requires read-back confirmation at the time it is entered' });
    }
});

// Per-type "detail only" schemas (orderType/patientId/encounterId stripped) — reused by modify and
// by order-set item validation, so a set's saved template is held to the same rules a live order is.
const DETAIL_SCHEMAS = {
    medication: medicationVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    prn_stat: prnStatVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    lab: labVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    radiology: radiologyVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    dietary: dietaryVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    therapy: therapyVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    procedure: procedureVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    consult: consultVariant.omit({ orderType: true, patientId: true, encounterId: true }),
    nursing: nursingVariant.omit({ orderType: true, patientId: true, encounterId: true }),
};

const DETAIL_TABLES = {
    medication: 'medications', prn_stat: 'prn_stat_orders', lab: 'lab_orders', radiology: 'radiology_orders',
    dietary: 'dietary_orders', therapy: 'therapy_orders', procedure: 'procedure_orders', consult: 'consult_orders', nursing: 'nursing_orders',
};

/**
 * Inserts the per-type detail row for a new (or renewed/modified/order-set-placed) order. Runs CDS
 * for medication/prn_stat only — every other type has no interaction surface. Returns the detail row
 * and refTable; callers insert the ledger row themselves (create, renew, modify and order-set
 * placement each need slightly different ledger fields).
 */
async function insertOrderDetail(db, req, b) {
    /** @type {import('../lib/cds/schemas.js').CdsAlert[] | null} */
    let cdsAlerts = null;
    /** @type {string | null} */
    let cdsOverrideReason = null;
    let detail;
    const refTable = DETAIL_TABLES[b.orderType];

    if (b.orderType === 'medication' || b.orderType === 'prn_stat') {
        const candidateName = b.orderType === 'medication' ? b.name : b.medicationName;
        const rxnormCode = b.rxnormCode ?? null;
        cdsAlerts = await checkInteractions(db, { tenantId: req.user.tenantId, patientId: b.patientId, candidates: [{ name: candidateName, rxnormCode }] });
        if (requiresOverride(cdsAlerts) && !b.cdsOverride) {
            throw new ApiError(409, 'Clinical decision support override required', { alerts: cdsAlerts }, 'CDS_OVERRIDE_REQUIRED');
        }
        if (b.cdsOverride) cdsOverrideReason = b.cdsOverride.reason;
    }

    if (b.orderType === 'medication') {
        detail = (await db.query(
            `INSERT INTO medications (tenant_id, patient_id, encounter_id, name, dose, route, frequency, next_scheduled_time, rxnorm_code, priority)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.name, b.dose ?? null, b.route ?? null, b.frequency ?? null, b.nextScheduledTime ?? null, b.rxnormCode ?? null, b.priority],
        )).rows[0];
    } else if (b.orderType === 'prn_stat') {
        detail = (await db.query(
            `INSERT INTO prn_stat_orders (tenant_id, patient_id, encounter_id, medication_name, order_type, indication, last_given_time, dose_interval, max_dose,
                                          ordered_time, urgency_level, given_by, doctor_approval, remarks, rxnorm_code)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.medicationName, b.type, b.indication, b.lastGivenTime || null, b.interval ?? null, b.maxDose ?? null,
             b.orderedTime, b.urgencyLevel ?? null, b.givenBy, b.doctorApproval ?? null, b.remarks ?? null, b.rxnormCode ?? null],
        )).rows[0];
    } else if (b.orderType === 'lab') {
        const labTests = await resolveLabTestCodes(db, b.labTests);
        detail = (await db.query(
            `INSERT INTO lab_orders (tenant_id, patient_id, encounter_id, lab_tests, order_date, priority, ordering_provider_name, office_notes, patient_contact_notes, created_by, clinical_indication)
             VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10,$11) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, JSON.stringify(labTests), b.orderDate ?? null, b.priority, b.orderingProviderName || req.user.name || null, b.officeNotes || null, b.patientContactNotes || null, req.user.id, b.clinicalIndication || null],
        )).rows[0];
    } else if (b.orderType === 'radiology') {
        detail = (await db.query(
            `INSERT INTO radiology_orders (tenant_id, patient_id, encounter_id, modality, body_region, laterality, contrast, clinical_indication, icd10_codes,
                                           priority, special_instructions, pregnancy_status, contrast_allergy, transport_required, scheduled_for, ordered_by, ordered_by_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.modality, b.bodyRegion, b.laterality || null, b.contrast || null, b.clinicalIndication, JSON.stringify(b.icd10Codes),
             b.priority, b.specialInstructions || null, b.pregnancyStatus || null, b.contrastAllergy || null, b.transportRequired, b.scheduledFor ?? null, req.user.id, req.user.name || req.user.email],
        )).rows[0];
    } else if (b.orderType === 'dietary') {
        detail = (await db.query(
            `INSERT INTO dietary_orders (tenant_id, patient_id, encounter_id, diet_type, restrictions, notes, priority, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.dietType, b.restrictions || null, b.notes || null, b.priority, req.user.id],
        )).rows[0];
    } else if (b.orderType === 'therapy') {
        detail = (await db.query(
            `INSERT INTO therapy_orders (tenant_id, patient_id, encounter_id, therapy_type, frequency, notes, priority, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.therapyType, b.frequency || null, b.notes || null, b.priority, req.user.id],
        )).rows[0];
    } else if (b.orderType === 'procedure') {
        detail = (await db.query(
            `INSERT INTO procedure_orders (tenant_id, patient_id, encounter_id, procedure_name, laterality, scheduled_for, notes, priority, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.procedureName, b.laterality || null, b.scheduledFor ?? null, b.notes || null, b.priority, req.user.id],
        )).rows[0];
    } else if (b.orderType === 'consult') {
        detail = (await db.query(
            `INSERT INTO consult_orders (tenant_id, patient_id, encounter_id, consulting_service, reason, priority, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.consultingService, b.reason, b.priority, req.user.id],
        )).rows[0];
    } else {
        detail = (await db.query(
            `INSERT INTO nursing_orders (tenant_id, patient_id, encounter_id, nursing_order_type, details, priority, ordered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.user.tenantId, b.patientId, b.encounterId, b.nursingOrderType, b.details || null, b.priority, req.user.id],
        )).rows[0];
    }

    return { refTable, detail, cdsAlerts, cdsOverrideReason };
}

async function insertLedgerRow(db, req, b, { orderSetId = null, replacesOrderId = null, refTable, detailId }) {
    const requiresCosign = !!b.isVerbal;
    const ledger = (await db.query(
        `INSERT INTO orders (tenant_id, patient_id, encounter_id, order_type, ref_table, ref_id, ordered_by, is_verbal, read_back_confirmed, requires_cosign, order_set_id, replaces_order_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId, b.orderType, refTable, detailId, req.user.id, !!b.isVerbal, !!b.readBackConfirmed, requiresCosign, orderSetId, replacesOrderId],
    )).rows[0];
    return ledger;
}

// ----------------------------------------------------------------- write path
ordersRouter.post('/api/orders', writers, h(async (req, res) => {
    const b = parse(orderBody, req.body);

    // Radiology stays physician-only, same as /api/Radiology/order — the router-level gate above
    // is the union of what all order types allow, so this rule applies only here.
    if (b.orderType === 'radiology' && req.user.role !== 'physician' && req.user.role !== 'admin') {
        throw new ApiError(403, 'You do not have permission to perform this action');
    }

    await assertEncounter(req, b.encounterId, b.patientId);

    const out = await withTx(async (db) => {
        const { refTable, detail, cdsAlerts, cdsOverrideReason } = await insertOrderDetail(db, req, b);
        const ledger = await insertLedgerRow(db, req, b, { refTable, detailId: detail.id });

        if (cdsAlerts?.length) {
            await recordCdsAlerts(db, {
                tenantId: req.user.tenantId,
                patientId: b.patientId,
                contextType: 'cpoe_order',
                contextId: ledger.id,
                alerts: cdsAlerts,
                outcome: cdsOverrideReason ? 'overridden' : 'advisory',
                userId: req.user.id,
                overrideReason: cdsOverrideReason,
            });
        }

        return { ledger, detail };
    });

    created(res, { ...row(out.ledger), detail: row(out.detail) });
}));

// ----------------------------------------------------------------- read paths
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

ordersRouter.get('/api/encounters/:encounterId/orders', readers, h(async (req, res) => {
    const enc = await query('SELECT 1 FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.encounterId, req.user.tenantId]);
    if (!enc.rowCount) throw notFound('Encounter not found');
    const ledger = await query('SELECT * FROM orders WHERE encounter_id = $1 AND tenant_id = $2 ORDER BY ordered_at DESC', [req.params.encounterId, req.user.tenantId]);
    ok(res, await hydrateDetails(req, ledger.rows));
}));

ordersRouter.get('/api/orders/:id', readers, h(async (req, res) => {
    const r = await query('SELECT * FROM orders WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Order not found');
    const [out] = await hydrateDetails(req, r.rows);
    ok(res, out);
}));

async function loadOrderForUpdate(db, req, id) {
    const o = (await db.query('SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [id, req.user.tenantId])).rows[0];
    if (!o) throw notFound('Order not found');
    return o;
}

// Status transitions: 'held' and 'active' are both non-terminal (an order can be held and later
// resumed); 'discontinued'/'cancelled' are terminal. A reason is required for every transition away
// from 'active' except resuming — the "why" matters as much for a hold as for a cancel.
ordersRouter.put('/api/orders/:id/status', writers, h(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['active', 'held', 'discontinued', 'cancelled']), reason: optText(500) }), req.body);
    if (b.status !== 'active' && !b.reason) throw badRequest('A reason is required');
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        if (b.status === 'active' && o.status !== 'held') throw conflict('Only a held order can be resumed to active');
        return (await db.query('UPDATE orders SET status = $1, reason = $2 WHERE id = $3 RETURNING *', [b.status, b.reason ?? null, o.id])).rows[0];
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));

// Nurse (or physician/pharmacist) acknowledgement that an order was seen — not a clinical
// attestation like co-sign, just an "I'm aware of this" flag the dashboard's Acknowledge action
// actually has somewhere to call now (closes BUG-02).
ordersRouter.post('/api/orders/:id/acknowledge', readers, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (o.status !== 'active') throw conflict('Only an active order can be acknowledged');
        if (o.acknowledged_at) throw conflict('Order is already acknowledged');
        return (await db.query('UPDATE orders SET acknowledged_by = $1, acknowledged_at = now() WHERE id = $2 RETURNING *', [req.user.id, o.id])).rows[0];
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));
// Same alias style the dashboard already expects.
ordersRouter.post('/api/inpatient/orders/:id/acknowledge', readers, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (o.status !== 'active') throw conflict('Only an active order can be acknowledged');
        if (o.acknowledged_at) throw conflict('Order is already acknowledged');
        return (await db.query('UPDATE orders SET acknowledged_by = $1, acknowledged_at = now() WHERE id = $2 RETURNING *', [req.user.id, o.id])).rows[0];
    });
    const [out2] = await queryDashboardOrders(req, ['o.id = $2'], [out.id]);
    ok(res, toDashboardRow(out2));
}));

// Physician co-sign on a verbal/telephone order — required before the record is complete, same
// pattern as clinical-note co-sign.
ordersRouter.post('/api/orders/:id/cosign', cosigners, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (!o.requires_cosign) throw badRequest('This order does not require a co-signature');
        if (o.cosigned_by) throw conflict('Order is already co-signed');
        return (await db.query('UPDATE orders SET cosigned_by = $1, cosigned_at = now() WHERE id = $2 RETURNING *', [req.user.id, o.id])).rows[0];
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));

/** Shared by renew/modify: completes the old order and inserts a new one with `detailFields`, linked via replaces_order_id. */
async function replaceOrder(db, req, old, detailFields) {
    const reason = detailFields.__renew ? 'Renewed' : 'Modified';
    await db.query(`UPDATE orders SET status = 'completed', reason = $1 WHERE id = $2`, [reason, old.id]);
    const b = { ...detailFields, orderType: old.order_type, patientId: old.patient_id, encounterId: old.encounter_id };
    const { refTable, detail, cdsAlerts, cdsOverrideReason } = await insertOrderDetail(db, req, b);
    const ledger = await insertLedgerRow(db, req, b, { refTable, detailId: detail.id, replacesOrderId: old.id });
    if (cdsAlerts?.length) {
        await recordCdsAlerts(db, {
            tenantId: req.user.tenantId, patientId: old.patient_id, contextType: 'cpoe_order', contextId: ledger.id,
            alerts: cdsAlerts, outcome: cdsOverrideReason ? 'overridden' : 'advisory', userId: req.user.id, overrideReason: cdsOverrideReason,
        });
    }
    return ledger;
}

/** Row -> the plain fields insertOrderDetail()/DETAIL_SCHEMAS expect (camelCase, no tenant/id/timestamps). */
function detailRowToFields(orderType, detailRow) {
    const d = row(detailRow);
    const { id, tenantId, patientId, encounterId, createdAt, orderedBy, ...fields } = d;
    return fields;
}

ordersRouter.post('/api/orders/:id/renew', writers, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Cannot renew a${o.status === 'active' ? 'n' : ''} ${o.status} order`);
        const detailRow = (await db.query(`SELECT * FROM ${DETAIL_TABLES[o.order_type]} WHERE id = $1`, [o.ref_id])).rows[0];
        return replaceOrder(db, req, o, { ...detailRowToFields(o.order_type, detailRow), isVerbal: false, readBackConfirmed: false, __renew: true });
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));

ordersRouter.post('/api/orders/:id/modify', writers, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadOrderForUpdate(db, req, req.params.id);
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Cannot modify a${o.status === 'active' ? 'n' : ''} ${o.status} order`);
        const schema = DETAIL_SCHEMAS[o.order_type];
        const b = parse(schema, req.body);
        return replaceOrder(db, req, o, b);
    });
    const [hydrated] = await hydrateDetails(req, [out]);
    ok(res, hydrated);
}));

// ----------------------------------------------------------------- order sets
const orderSetItemBody = z.object({
    orderType: z.enum(Object.keys(DETAIL_TABLES)),
    detail: z.record(z.string(), z.unknown()),
});
const orderSetBody = z.object({
    name: z.string().trim().min(1).max(200),
    description: optText(1000),
    items: z.array(orderSetItemBody).min(1).max(30),
});

/** Validates each item's detail against its type's own order schema — a saved set can't hold garbage that would only fail at placement time. */
function validateOrderSetItems(items) {
    return items.map((item, i) => {
        const schema = DETAIL_SCHEMAS[item.orderType];
        const parsed = schema.safeParse(item.detail);
        if (!parsed.success) throw badRequest(`Item ${i + 1} (${item.orderType}): ${parsed.error.issues[0]?.message ?? 'invalid'}`);
        return { orderType: item.orderType, detail: parsed.data };
    });
}

function orderSetOut(set, items) {
    return { ...row(set), items: (items ?? []).map((i) => ({ orderType: i.order_type, detail: i.detail })) };
}

ordersRouter.get('/api/order-sets', readers, h(async (req, res) => {
    const sets = await query('SELECT * FROM order_sets WHERE tenant_id = $1 AND is_active ORDER BY name', [req.user.tenantId]);
    const items = await query('SELECT * FROM order_set_items WHERE order_set_id = ANY($1::text[]) ORDER BY sort_order', [sets.rows.map((s) => s.id)]);
    const byId = new Map();
    for (const i of items.rows) { if (!byId.has(i.order_set_id)) byId.set(i.order_set_id, []); byId.get(i.order_set_id).push(i); }
    ok(res, sets.rows.map((s) => orderSetOut(s, byId.get(s.id))));
}));

ordersRouter.get('/api/order-sets/:id', readers, h(async (req, res) => {
    const set = (await query('SELECT * FROM order_sets WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!set) throw notFound('Order set not found');
    const items = await query('SELECT * FROM order_set_items WHERE order_set_id = $1 ORDER BY sort_order', [set.id]);
    ok(res, orderSetOut(set, items.rows));
}));

ordersRouter.post('/api/order-sets', writers, h(async (req, res) => {
    const b = parse(orderSetBody, req.body);
    const items = validateOrderSetItems(b.items);
    const out = await withTx(async (db) => {
        let set;
        try {
            set = (await db.query(
                `INSERT INTO order_sets (tenant_id, name, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
                [req.user.tenantId, b.name, b.description || null, req.user.id],
            )).rows[0];
        } catch (e) {
            if (e.code === '23505') throw conflict(`An order set named "${b.name}" already exists`);
            throw e;
        }
        for (let i = 0; i < items.length; i++) {
            await db.query(
                `INSERT INTO order_set_items (order_set_id, order_type, detail, sort_order) VALUES ($1,$2,$3,$4)`,
                [set.id, items[i].orderType, JSON.stringify(items[i].detail), i],
            );
        }
        return set;
    });
    created(res, orderSetOut(out, items.map((it, i) => ({ order_set_id: out.id, order_type: it.orderType, detail: it.detail, sort_order: i }))));
}));

ordersRouter.put('/api/order-sets/:id', writers, h(async (req, res) => {
    const b = parse(orderSetBody.partial().extend({ isActive: z.boolean().optional() }), req.body);
    const items = b.items ? validateOrderSetItems(b.items) : null;
    const out = await withTx(async (db) => {
        const existing = (await db.query('SELECT * FROM order_sets WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, req.user.tenantId])).rows[0];
        if (!existing) throw notFound('Order set not found');
        const set = (await db.query(
            `UPDATE order_sets SET name = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *`,
            [b.name ?? existing.name, b.description !== undefined ? b.description : existing.description, b.isActive ?? existing.is_active, existing.id],
        )).rows[0];
        if (items) {
            await db.query('DELETE FROM order_set_items WHERE order_set_id = $1', [set.id]);
            for (let i = 0; i < items.length; i++) {
                await db.query(`INSERT INTO order_set_items (order_set_id, order_type, detail, sort_order) VALUES ($1,$2,$3,$4)`, [set.id, items[i].orderType, JSON.stringify(items[i].detail), i]);
            }
        }
        return set;
    });
    const itemRows = items ? items.map((it, i) => ({ order_set_id: out.id, order_type: it.orderType, detail: it.detail, sort_order: i })) : (await query('SELECT * FROM order_set_items WHERE order_set_id = $1 ORDER BY sort_order', [out.id])).rows;
    ok(res, orderSetOut(out, itemRows));
}));

// Soft delete — retired, not removed, so a past placement's provenance (order_set_id on the orders
// it created) still resolves to something.
ordersRouter.delete('/api/order-sets/:id', writers, h(async (req, res) => {
    const r = await query('UPDATE order_sets SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Order set not found');
    res.json({ status: 'success', message: 'Order set retired' });
}));

ordersRouter.post('/api/order-sets/:id/place', writers, h(async (req, res) => {
    const b = parse(z.object({ patientId: z.string().min(1), encounterId: z.string().min(1) }), req.body);
    await assertEncounter(req, b.encounterId, b.patientId);
    const set = await query('SELECT * FROM order_sets WHERE id = $1 AND tenant_id = $2 AND is_active', [req.params.id, req.user.tenantId]);
    if (!set.rowCount) throw notFound('Order set not found');
    const items = (await query('SELECT * FROM order_set_items WHERE order_set_id = $1 ORDER BY sort_order', [req.params.id])).rows;

    const placed = await withTx(async (db) => {
        const results = [];
        for (const item of items) {
            const orderBodyForItem = { ...row(item).detail, orderType: item.order_type, patientId: b.patientId, encounterId: b.encounterId };
            if (item.order_type === 'radiology' && req.user.role !== 'physician' && req.user.role !== 'admin') {
                throw new ApiError(403, 'Only a physician can place the radiology order in this set');
            }
            const { refTable, detail, cdsAlerts, cdsOverrideReason } = await insertOrderDetail(db, req, orderBodyForItem);
            const ledger = await insertLedgerRow(db, req, orderBodyForItem, { refTable, detailId: detail.id, orderSetId: set.rows[0].id });
            if (cdsAlerts?.length) {
                await recordCdsAlerts(db, {
                    tenantId: req.user.tenantId, patientId: b.patientId, contextType: 'cpoe_order', contextId: ledger.id,
                    alerts: cdsAlerts, outcome: cdsOverrideReason ? 'overridden' : 'advisory', userId: req.user.id, overrideReason: cdsOverrideReason,
                });
            }
            results.push({ ledger, detail });
        }
        return results;
    });
    created(res, placed.map((p) => ({ ...row(p.ledger), detail: row(p.detail) })));
}));

// ----------------------------------------------------------------- orders dashboard (cross-patient)
// `frontend/src/features/order-dashboard` — a hospital-wide worklist across units, not scoped to one
// encounter, so it needs its own aggregate query rather than GET /api/encounters/:id/orders above.
// It folds `prn_stat` into the `medication` bucket (the dashboard's type system predates this ledger
// and has no separate PRN/STAT type).
const LEDGER_TO_DASHBOARD_TYPE = {
    medication: 'medication', prn_stat: 'medication', lab: 'lab', radiology: 'radiology',
    dietary: 'dietary', therapy: 'therapy', procedure: 'procedure', consult: 'consult', nursing: 'nursing',
};

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
        case 'dietary':
            return d.dietType ? `Diet: ${d.dietType}` : 'Dietary order';
        case 'therapy':
            return d.therapyType || 'Therapy order';
        case 'procedure':
            return d.procedureName || 'Procedure order';
        case 'consult':
            return d.consultingService ? `Consult: ${d.consultingService}` : 'Consult order';
        case 'nursing':
            return d.nursingOrderType || 'Nursing order';
        default:
            return 'Order';
    }
}

// Every type now carries a real `priority` field (lab/radiology use Capitalized values; everything
// else added in this module uses lowercase) except prn_stat, which only distinguishes PRN vs STAT.
function priorityOf(orderType, detail) {
    const d = detail ?? {};
    if (orderType === 'prn_stat') return d.orderType === 'STAT' ? 'stat' : 'routine';
    const p = String(d.priority || '').toLowerCase();
    return p === 'stat' ? 'stat' : p === 'urgent' ? 'urgent' : 'routine';
}

/** 'accepted' is derived from real acknowledgement, not a status the ledger stores directly. */
function dashboardStatus(o) {
    if (o.status === 'completed') return 'completed';
    if (o.status === 'discontinued' || o.status === 'cancelled') return 'cancelled';
    if (o.status === 'held') return 'held';
    return o.acknowledgedAt ? 'accepted' : 'pending';
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
        status: dashboardStatus(o),
        priority: priorityOf(o.orderType, o.detail),
        orderedAt: o.orderedAt,
        orderedByName,
        isVerbal: o.isVerbal ?? false,
        requiresCosign: o.requiresCosign ?? false,
        cosignedBy: o.cosignedBy ?? null,
        reason: o.reason ?? null,
        canAcknowledge: o.status === 'active' && !o.acknowledgedAt,
        canCancel: !TERMINAL_STATUSES.includes(o.status),
        canHold: o.status === 'active',
        canResume: o.status === 'held',
        canRenew: !TERMINAL_STATUSES.includes(o.status),
        canModify: !TERMINAL_STATUSES.includes(o.status),
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

ordersRouter.get('/api/inpatient/orders', readers, h(async (req, res) => {
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

    // BUG-09: status/priority now filter in SQL too, so a unit with >2000 orders in the lookback
    // window can't silently drop matching older rows (and `total` is now the true matching count).
    if (q.statuses) {
        const set = q.statuses.split(',').map((s) => s.trim()).filter(Boolean);
        if (set.length) {
            const ledgerStatuses = set.flatMap((s) => (s === 'cancelled' ? ['discontinued', 'cancelled'] : s === 'pending' || s === 'accepted' ? ['active', 'draft'] : [s]));
            add('o.status = ANY(?::text[])', [...new Set(ledgerStatuses)]);
        }
    }

    const hydrated = await queryDashboardOrders(req, extraWhere, extraParams);
    let items = hydrated.map(toDashboardRow);

    // priority and the pending-vs-accepted split within 'active' are both derived, not stored
    // columns, so they're filtered here rather than in SQL — but now against the full (not
    // pre-2000-capped-then-filtered) set, so this is just a refinement of the SQL status filter
    // above, not the only filter as before.
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

ordersRouter.post('/api/inpatient/orders/:id/cancel', writers, h(async (req, res) => {
    const b = parse(z.object({ reason: optText(500) }), req.body);
    await withTx(async (db) => {
        const o = (await db.query('SELECT status FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, req.user.tenantId])).rows[0];
        if (!o) throw notFound('Order not found');
        if (TERMINAL_STATUSES.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        await db.query('UPDATE orders SET status = $1, reason = $2 WHERE id = $3', ['cancelled', b.reason ?? null, req.params.id]);
    });
    const [out] = await queryDashboardOrders(req, ['o.id = $2'], [req.params.id]);
    if (!out) throw notFound('Order not found');
    ok(res, toDashboardRow(out));
}));
