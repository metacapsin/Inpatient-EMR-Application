import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

/**
 * Lab orders #20 — specimen collection, structured results, critical values, acknowledgement.
 * `POST /lab-orders/:id/results` is shaped so an inbound HL7 ORU adapter (#55) can call it later.
 */
export const labsRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');
const acknowledgers = requireRole('physician', 'nurse');
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const num = (v) => (v === null || v === undefined ? null : Number(v));

export const LAB_TRANSITIONS = {
    Ordered: ['Collected', 'Cancelled'],
    Collected: ['In Progress', 'Resulted', 'Cancelled'],
    'In Progress': ['Resulted', 'Cancelled'],
    Resulted: [],
    Cancelled: [],
};
export function assertLabTransition(from, to) {
    if (from === to) return;
    if (!LAB_TRANSITIONS[from]?.includes(to)) throw conflict(`Lab order cannot move from '${from}' to '${to}'`);
}

export const labResultOut = (r) => ({
    id: r.id,
    _id: r.id,
    labOrderId: r.lab_order_id,
    patientId: r.patient_id,
    testCode: r.test_code ?? '',
    testName: r.test_name,
    loincCode: r.loinc_code ?? '',
    valueNum: num(r.value_num),
    valueText: r.value_text ?? '',
    value: r.value_num !== null && r.value_num !== undefined ? String(Number(r.value_num)) : r.value_text ?? '',
    unit: r.unit ?? '',
    refLow: num(r.ref_low),
    refHigh: num(r.ref_high),
    referenceRange: r.ref_low !== null || r.ref_high !== null ? `${r.ref_low ?? ''}–${r.ref_high ?? ''}`.replace(/^–$/, '') : '',
    abnormalFlag: r.abnormal_flag ?? 'N',
    isCritical: r.is_critical,
    status: r.status,
    resultedAt: iso(r.resulted_at),
    resultedBy: r.resulted_by,
    resultedByName: r.resulted_by_name ?? null,
    acknowledgedBy: r.acknowledged_by,
    acknowledgedByName: r.acknowledged_by_name ?? null,
    acknowledgedAt: iso(r.acknowledged_at),
    comment: r.comment ?? '',
    ...(r.patient_name ? { patientName: r.patient_name, mrn: r.mrn, locationLabel: [r.ward_name, r.room_number, r.bed_label].filter(Boolean).join(' / ') || '', orderStatus: r.order_status, accessionNumber: r.accession_number } : {}),
});
const RESULT_SELECT = `SELECT lr.*, ru.first_name || ' ' || ru.last_name AS resulted_by_name, au.first_name || ' ' || au.last_name AS acknowledged_by_name
                       FROM lab_results lr LEFT JOIN users ru ON ru.id = lr.resulted_by LEFT JOIN users au ON au.id = lr.acknowledged_by`;

async function loadOrder(db, req, id) {
    const r = await db.query('SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Lab order not found');
    return r.rows[0];
}

/**
 * Critical-value limits for common analytes (typical US hospital panic values; tenants can tune later).
 * Keyed by lower-cased test code or name. Values outside [low, high] are critical.
 */
export const CRITICAL_LIMITS = {
    k: [2.8, 6.2], potassium: [2.8, 6.2],
    na: [120, 160], sodium: [120, 160],
    glucose: [40, 500], glu: [40, 500],
    ca: [6.5, 13], calcium: [6.5, 13],
    mg: [1.0, 4.9], magnesium: [1.0, 4.9],
    hgb: [7, 20], hemoglobin: [7, 20], haemoglobin: [7, 20],
    plt: [50, 1000], platelets: [50, 1000],
    wbc: [2, 50],
    inr: [null, 5],
    lactate: [null, 4],
    troponin: [null, 0.4],
    creatinine: [null, 7.4],
    co2: [10, 40], bicarbonate: [10, 40],
    ph: [7.2, 7.6],
};

/**
 * Abnormal flag from the numeric value and reference range (L/H), upgraded to LL/HH when the value crosses a
 * known critical limit or the caller flags it explicitly (`isCritical` / `abnormalFlag`).
 */
export function computeFlags({ valueNum, refLow, refHigh, abnormalFlag, isCritical, testCode, testName }) {
    if (abnormalFlag) return { abnormalFlag, isCritical: isCritical ?? ['LL', 'HH'].includes(abnormalFlag) };
    if (valueNum === null || valueNum === undefined) return { abnormalFlag: 'N', isCritical: Boolean(isCritical) };
    const limits = CRITICAL_LIMITS[String(testCode ?? '').toLowerCase()] ?? CRITICAL_LIMITS[String(testName ?? '').toLowerCase()] ?? null;
    const critLow = limits && limits[0] !== null && valueNum < limits[0];
    const critHigh = limits && limits[1] !== null && valueNum > limits[1];
    const low = (refLow != null && valueNum < refLow) || critLow;
    const high = (refHigh != null && valueNum > refHigh) || critHigh;
    const critical = isCritical === true || (isCritical !== false && (critLow || critHigh));
    if (low) return { abnormalFlag: critical ? 'LL' : 'L', isCritical: Boolean(critical) };
    if (high) return { abnormalFlag: critical ? 'HH' : 'H', isCritical: Boolean(critical) };
    return { abnormalFlag: 'N', isCritical: Boolean(isCritical) };
}

async function notifyCritical(db, req, order, results) {
    const p = (await db.query('SELECT first_name, last_name, mrn FROM patients WHERE id = $1', [order.patient_id])).rows[0];
    const who = p ? `${p.first_name} ${p.last_name} (${p.mrn})` : 'Patient';
    for (const r of results) {
        const msg = `CRITICAL ${r.test_name}: ${r.value_num ?? r.value_text ?? ''} ${r.unit ?? ''} for ${who} — acknowledgement required`.replace(/\s+/g, ' ').trim();
        await db.query(
            `INSERT INTO notifications (tenant_id, user_id, type, action, message, metadata, created_by)
             SELECT $1, id, 'lab', 'critical_result', $2, $3::jsonb, $4 FROM users WHERE tenant_id = $1 AND is_active AND role IN ('physician','nurse')`,
            [req.user.tenantId, msg, JSON.stringify({ labOrderId: order.id, labResultId: r.id, patientId: order.patient_id }), req.user.id],
        );
    }
}

// POST /lab-orders/:id/collect
labsRouter.post('/lab-orders/:id/collect', clinical, h(async (req, res) => {
    const b = parse(z.object({ specimenType: z.string().trim().max(100).optional().nullable(), collectedAt: z.string().datetime({ offset: true }).optional().nullable() }), req.body ?? {});
    const order = await withTx(async (db) => {
        const o = await loadOrder(db, req, req.params.id);
        if (o.order_status !== 'Ordered') throw conflict(`Specimen can only be collected for an 'Ordered' lab order (status: ${o.order_status})`);
        const n = (await db.query(
            `INSERT INTO lab_accession_counters (tenant_id, last_value) VALUES ($1, 1)
             ON CONFLICT (tenant_id) DO UPDATE SET last_value = lab_accession_counters.last_value + 1 RETURNING last_value`,
            [req.user.tenantId],
        )).rows[0].last_value;
        const accession = `ACC${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(n).padStart(5, '0')}`;
        const specimen = b.specimenType ?? (o.lab_tests.find((t) => t.specimen)?.specimen ?? null);
        return (await db.query(
            `UPDATE lab_orders SET order_status = 'Collected', accession_number = $1, specimen_type = $2, collected_at = COALESCE($3::timestamptz, now()), collected_by = $4, updated_at = now() WHERE id = $5 RETURNING *`,
            [accession, specimen, b.collectedAt ?? null, req.user.id, o.id],
        )).rows[0];
    });
    ok(res, { id: order.id, orderStatus: order.order_status, accessionNumber: order.accession_number, specimenType: order.specimen_type, collectedAt: iso(order.collected_at), collectedBy: order.collected_by });
}));

const resultBody = z.object({
    testCode: z.string().trim().max(30).optional().nullable(),
    testName: z.string().trim().min(1).max(200),
    loincCode: z.string().trim().max(20).optional().nullable(),
    valueNum: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable()),
    valueText: z.string().trim().max(500).optional().nullable(),
    unit: z.string().trim().max(30).optional().nullable(),
    refLow: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable()),
    refHigh: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable()),
    abnormalFlag: z.enum(['N', 'L', 'H', 'LL', 'HH', 'A']).optional().nullable(),
    isCritical: z.boolean().optional().nullable(),
    status: z.enum(['preliminary', 'final']).default('final'),
    comment: z.string().trim().max(2000).optional().nullable(),
    resultedAt: z.string().datetime({ offset: true }).optional().nullable(),
});

// POST /lab-orders/:id/results — bulk result entry (manual now; HL7 ORU adapter later)
labsRouter.post('/lab-orders/:id/results', clinical, h(async (req, res) => {
    const b = parse(z.object({ results: z.array(resultBody).min(1).max(100) }), req.body);
    for (const r of b.results) if (r.valueNum === null && !r.valueText) throw badRequest(`${r.testName}: a numeric or text value is required`);
    const out = await withTx(async (db) => {
        const o = await loadOrder(db, req, req.params.id);
        if (['Resulted', 'Cancelled'].includes(o.order_status)) throw conflict(`Results cannot be added to a '${o.order_status}' order`);
        if (o.order_status === 'Ordered') throw conflict('Collect the specimen before entering results');
        const inserted = [];
        for (const r of b.results) {
            const flags = computeFlags({ valueNum: r.valueNum, refLow: r.refLow, refHigh: r.refHigh, abnormalFlag: r.abnormalFlag ?? null, isCritical: r.isCritical ?? undefined, testCode: r.testCode, testName: r.testName });
            inserted.push((await db.query(
                `INSERT INTO lab_results (tenant_id, lab_order_id, patient_id, test_code, test_name, loinc_code, value_num, value_text, unit, ref_low, ref_high, abnormal_flag, is_critical, status, resulted_at, resulted_by, comment)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15::timestamptz, now()),$16,$17) RETURNING *`,
                [req.user.tenantId, o.id, o.patient_id, r.testCode ?? null, r.testName, r.loincCode ?? null, r.valueNum, r.valueText ?? null, r.unit ?? null, r.refLow, r.refHigh, flags.abnormalFlag, flags.isCritical, r.status, r.resultedAt ?? null, req.user.id, r.comment ?? null],
            )).rows[0]);
        }
        // Resulted once every ordered test has a final result; otherwise In Progress.
        const finals = (await db.query(`SELECT DISTINCT lower(test_name) AS n FROM lab_results WHERE lab_order_id = $1 AND status IN ('final','corrected')`, [o.id])).rows.map((x) => x.n);
        const ordered = o.lab_tests.map((t) => String(t.name ?? '').toLowerCase()).filter(Boolean);
        const allDone = ordered.length > 0 && ordered.every((n) => finals.includes(n));
        const next = allDone ? 'Resulted' : 'In Progress';
        const upd = (await db.query(`UPDATE lab_orders SET order_status = $1, resulted_at = CASE WHEN $1 = 'Resulted' THEN now() ELSE resulted_at END, updated_at = now() WHERE id = $2 RETURNING *`, [next, o.id])).rows[0];
        await db.query(`UPDATE orders SET status = CASE WHEN $1 = 'Resulted' THEN 'completed' ELSE status END WHERE ref_table = 'lab_orders' AND ref_id = $2`, [next, o.id]);
        const criticals = inserted.filter((r) => r.is_critical);
        if (criticals.length) await notifyCritical(db, req, o, criticals);
        return { order: upd, inserted };
    });
    created(res, { orderId: out.order.id, orderStatus: out.order.order_status, results: out.inserted.map(labResultOut) });
}));

// GET /lab-orders/:id/results
labsRouter.get('/lab-orders/:id/results', h(async (req, res) => {
    await loadOrder({ query }, req, req.params.id);
    const r = await query(`${RESULT_SELECT} WHERE lr.lab_order_id = $1 ORDER BY lr.resulted_at, lr.test_name`, [req.params.id]);
    ok(res, r.rows.map(labResultOut));
}));

// GET /lab-results/by-patient/:patientId
labsRouter.get('/lab-results/by-patient/:patientId', h(async (req, res) => {
    const r = await query(`${RESULT_SELECT} JOIN lab_orders lo ON lo.id = lr.lab_order_id WHERE lr.tenant_id = $1 AND lr.patient_id = $2 ORDER BY lr.resulted_at DESC, lr.test_name LIMIT 500`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(labResultOut));
}));

// GET /lab-results/critical?unitId= — unacknowledged critical worklist
labsRouter.get('/lab-results/critical', h(async (req, res) => {
    const q = parse(z.object({ unitId: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    const params = [req.user.tenantId];
    let where = 'lr.tenant_id = $1 AND lr.is_critical AND lr.acknowledged_at IS NULL';
    if (q.unitId) { params.push(q.unitId); where += ` AND w.id = $${params.length}`; }
    params.push(q.limit);
    const r = await query(
        `SELECT lr.*, ru.first_name || ' ' || ru.last_name AS resulted_by_name, NULL AS acknowledged_by_name,
                p.first_name || ' ' || p.last_name AS patient_name, p.mrn, w.name AS ward_name, rm.room_number, b.label AS bed_label, lo.order_status, lo.accession_number
         FROM lab_results lr
         JOIN lab_orders lo ON lo.id = lr.lab_order_id
         JOIN patients p ON p.id = lr.patient_id
         LEFT JOIN users ru ON ru.id = lr.resulted_by
         LEFT JOIN encounters e ON e.patient_id = lr.patient_id AND e.status <> 'discharged'
         LEFT JOIN beds b ON b.id = e.bed_id LEFT JOIN rooms rm ON rm.id = b.room_id LEFT JOIN wards w ON w.id = rm.ward_id
         WHERE ${where} ORDER BY lr.resulted_at DESC LIMIT $${params.length}`,
        params,
    );
    ok(res, r.rows.map(labResultOut));
}));

// PUT /lab-orders/:id/results/:rid — correction keeps the prior value in the comment audit line
labsRouter.put('/lab-orders/:id/results/:rid', clinical, h(async (req, res) => {
    const b = parse(resultBody.partial().extend({ testName: z.string().trim().min(1).max(200).optional() }), req.body);
    const out = await withTx(async (db) => {
        const o = await loadOrder(db, req, req.params.id);
        const r = (await db.query('SELECT * FROM lab_results WHERE id = $1 AND lab_order_id = $2 FOR UPDATE', [req.params.rid, o.id])).rows[0];
        if (!r) throw notFound('Lab result not found');
        const valueNum = b.valueNum !== undefined ? b.valueNum : num(r.value_num);
        const valueText = b.valueText !== undefined ? b.valueText : r.value_text;
        const refLow = b.refLow !== undefined ? b.refLow : num(r.ref_low);
        const refHigh = b.refHigh !== undefined ? b.refHigh : num(r.ref_high);
        const flags = computeFlags({ valueNum, refLow, refHigh, abnormalFlag: b.abnormalFlag ?? null, isCritical: b.isCritical ?? undefined, testCode: r.test_code, testName: r.test_name });
        const prior = `Corrected ${new Date().toISOString()} by ${req.user.name ?? req.user.id}: previous value ${r.value_num ?? r.value_text ?? ''} ${r.unit ?? ''}`.trim();
        const comment = [r.comment, prior, b.comment].filter(Boolean).join('\n');
        const upd = (await db.query(
            `UPDATE lab_results SET value_num = $1, value_text = $2, unit = COALESCE($3, unit), ref_low = $4, ref_high = $5, abnormal_flag = $6, is_critical = $7,
                    status = 'corrected', comment = $8, resulted_at = now(), resulted_by = $9, acknowledged_by = CASE WHEN $7 AND NOT is_critical THEN NULL ELSE acknowledged_by END,
                    acknowledged_at = CASE WHEN $7 AND NOT is_critical THEN NULL ELSE acknowledged_at END
             WHERE id = $10 RETURNING *`,
            [valueNum, valueText ?? null, b.unit ?? null, refLow, refHigh, flags.abnormalFlag, flags.isCritical, comment, req.user.id, r.id],
        )).rows[0];
        if (upd.is_critical && !r.is_critical) await notifyCritical(db, req, o, [upd]);
        return upd;
    });
    ok(res, labResultOut(out));
}));

// POST /lab-results/:rid/acknowledge
labsRouter.post('/lab-results/:rid/acknowledge', acknowledgers, h(async (req, res) => {
    const r = await query(
        `UPDATE lab_results SET acknowledged_by = $1, acknowledged_at = now() WHERE id = $2 AND tenant_id = $3 AND acknowledged_at IS NULL RETURNING *`,
        [req.user.id, req.params.rid, req.user.tenantId],
    );
    if (!r.rowCount) {
        const exists = await query('SELECT 1 FROM lab_results WHERE id = $1 AND tenant_id = $2', [req.params.rid, req.user.tenantId]);
        if (!exists.rowCount) throw notFound('Lab result not found');
        throw conflict('Result is already acknowledged');
    }
    ok(res, labResultOut(r.rows[0]));
}));
