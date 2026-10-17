import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const medicationRouter = Router();
const nurseOrMd = requireRole('physician', 'nurse');
const pharmacy = requireRole('pharmacist', 'physician');
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? undefined);
const ts = z.string().datetime({ offset: true }).or(z.string().datetime({ local: true }));

async function assertPatient(req, patientId) {
    const r = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
}

// ------------------------------------------------------------ medication list
const medOut = (m) => ({ id: m.id, name: m.name, dose: m.dose ?? undefined, route: m.route ?? undefined, frequency: m.frequency ?? undefined, nextScheduledTime: iso(m.next_scheduled_time) });

medicationRouter.get('/api/patients/:patientId/medications', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM medications WHERE tenant_id = $1 AND patient_id = $2 AND is_active ORDER BY name`,
        [req.user.tenantId, req.params.patientId],
    );
    ok(res, r.rows.map(medOut));
}));

medicationRouter.post('/api/patients/:patientId/medications', requireRole('physician'), h(async (req, res) => {
    const b = parse(
        z.object({ name: z.string().trim().min(1).max(200), dose: z.string().max(100).optional(), route: z.string().max(50).optional(), frequency: z.string().max(100).optional(), nextScheduledTime: ts.optional() }),
        req.body,
    );
    await assertPatient(req, req.params.patientId);
    const r = await query(
        `INSERT INTO medications (tenant_id, patient_id, name, dose, route, frequency, next_scheduled_time) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.tenantId, req.params.patientId, b.name, b.dose ?? null, b.route ?? null, b.frequency ?? null, b.nextScheduledTime ?? null],
    );
    created(res, medOut(r.rows[0]));
}));

medicationRouter.delete('/api/patients/:patientId/medications/:id', requireRole('physician'), h(async (req, res) => {
    const r = await query(`UPDATE medications SET is_active = false WHERE id = $1 AND patient_id = $2 AND tenant_id = $3`, [req.params.id, req.params.patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Medication not found');
    res.json({ status: 'success', message: 'Medication discontinued' });
}));

// ------------------------------------------------------------ MAR
const marOut = (m) => ({
    id: m.id,
    medicationId: m.medication_id,
    medicationName: m.medication_name,
    scheduledTime: iso(m.scheduled_time),
    givenTime: iso(m.given_time),
    givenBy: m.given_by ?? undefined,
    status: m.status,
    remarks: m.remarks ?? undefined,
});

const listMar = async (req, patientId) =>
    (await query(`SELECT * FROM mar_entries WHERE tenant_id = $1 AND patient_id = $2 ORDER BY scheduled_time`, [req.user.tenantId, patientId])).rows.map(marOut);

medicationRouter.get('/api/mar/:patientId', h(async (req, res) => ok(res, await listMar(req, req.params.patientId))));

medicationRouter.post('/api/mar', nurseOrMd, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            medicationId: z.string().min(1),
            scheduledTime: ts,
            givenTime: ts,
            givenBy: z.string().trim().min(1).max(200),
            status: z.string().trim().min(1).max(30),
            remarks: z.string().max(1000).optional(),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    await withTx(async (db) => {
        const upd = await db.query(
            `UPDATE mar_entries SET given_time = $1, given_by = $2, status = $3, remarks = $4
             WHERE tenant_id = $5 AND patient_id = $6 AND medication_id = $7 AND scheduled_time = $8::timestamptz AND status = 'due'`,
            [b.givenTime, b.givenBy, b.status, b.remarks ?? null, req.user.tenantId, b.patientId, b.medicationId, b.scheduledTime],
        );
        if (upd.rowCount) return;
        const med = (await db.query('SELECT name FROM medications WHERE id = $1 AND patient_id = $2 AND tenant_id = $3', [b.medicationId, b.patientId, req.user.tenantId])).rows[0];
        await db.query(
            `INSERT INTO mar_entries (tenant_id, patient_id, medication_id, medication_name, scheduled_time, given_time, given_by, status, remarks)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [req.user.tenantId, b.patientId, b.medicationId, med?.name ?? b.medicationId, b.scheduledTime, b.givenTime, b.givenBy, b.status, b.remarks ?? null],
        );
    });
    ok(res, await listMar(req, b.patientId));
}));

// ------------------------------------------------------------ PRN / STAT
const prnOut = (p) => ({
    id: p.id,
    patientId: p.patient_id,
    medicationName: p.medication_name,
    type: p.order_type,
    indication: p.indication,
    lastGivenTime: iso(p.last_given_time),
    interval: p.dose_interval ?? undefined,
    maxDose: p.max_dose ?? undefined,
    orderedTime: iso(p.ordered_time),
    urgencyLevel: p.urgency_level ?? undefined,
    givenBy: p.given_by,
    doctorApproval: p.doctor_approval ?? undefined,
    remarks: p.remarks ?? undefined,
    createdAt: iso(p.created_at),
});

medicationRouter.get('/api/prn-stat/:patientId', h(async (req, res) => {
    const r = await query(`SELECT * FROM prn_stat_orders WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(prnOut));
}));

medicationRouter.post('/api/prn-stat', nurseOrMd, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
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
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO prn_stat_orders (tenant_id, patient_id, medication_name, order_type, indication, last_given_time, dose_interval, max_dose,
                                      ordered_time, urgency_level, given_by, doctor_approval, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [req.user.tenantId, b.patientId, b.medicationName, b.type, b.indication, b.lastGivenTime || null, b.interval ?? null, b.maxDose ?? null,
         b.orderedTime, b.urgencyLevel ?? null, b.givenBy, b.doctorApproval ?? null, b.remarks ?? null],
    );
    created(res, prnOut(r.rows[0]));
}));

// ------------------------------------------------------------ prescriptions + dispensing
const rxOut = (p) => ({ prescriptionId: p.id, patientId: p.patient_id, medicines: p.medicines, prescriberName: p.prescriber_name ?? undefined, orderedAt: iso(p.ordered_at) });

medicationRouter.get('/api/prescriptions/:patientId', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM prescriptions WHERE tenant_id = $1 AND patient_id = $2 AND dispensed_at IS NULL ORDER BY ordered_at DESC`,
        [req.user.tenantId, req.params.patientId],
    );
    ok(res, r.rows.map(rxOut));
}));

medicationRouter.post('/api/prescriptions', requireRole('physician'), h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            prescriberName: z.string().max(200).optional(),
            medicines: z.array(z.object({
                medicineId: z.string().min(1),
                name: z.string().min(1).max(200),
                strength: z.string().max(100).optional(),
                quantityOrdered: z.coerce.number().int().min(1),
                unitPrice: z.coerce.number().min(0),
            })).min(1),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO prescriptions (tenant_id, patient_id, medicines, prescriber_name) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user.tenantId, b.patientId, JSON.stringify(b.medicines), b.prescriberName ?? req.user.name],
    );
    created(res, rxOut(r.rows[0]));
}));

medicationRouter.post('/api/dispense', pharmacy, h(async (req, res) => {
    const b = parse(
        z.object({
            prescriptionId: z.string().min(1),
            medicines: z.array(z.object({
                medicineId: z.string().min(1),
                quantityDispensed: z.coerce.number().int().min(1),
                batchNumber: z.string().trim().min(1).max(100),
                expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
                unitPrice: z.coerce.number().min(0),
            })).min(1),
            dispensedBy: z.string().trim().min(1).max(200),
            totalCost: z.coerce.number().min(0),
        }),
        req.body,
    );
    await withTx(async (db) => {
        const rx = (await db.query('SELECT * FROM prescriptions WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [b.prescriptionId, req.user.tenantId])).rows[0];
        if (!rx) throw notFound('Prescription not found');
        if (rx.dispensed_at) throw conflict('Prescription has already been dispensed');
        const ordered = new Map(rx.medicines.map((m) => [m.medicineId, m]));
        for (const line of b.medicines) {
            const o = ordered.get(line.medicineId);
            if (!o) throw badRequest(`Medicine ${line.medicineId} is not on this prescription`);
            if (line.quantityDispensed > o.quantityOrdered) throw badRequest(`Cannot dispense more than ordered for ${o.name}`);
            if (line.expiryDate.slice(0, 10) < new Date().toISOString().slice(0, 10)) throw badRequest(`Batch for ${o.name} is expired`);
        }
        // Cost is recomputed server-side; the client total must agree.
        const computed = b.medicines.reduce((s, l) => s + l.quantityDispensed * l.unitPrice, 0);
        if (Math.abs(computed - b.totalCost) > 0.01) throw badRequest('totalCost does not match the dispensed lines');
        await db.query('INSERT INTO dispenses (tenant_id, prescription_id, medicines, dispensed_by, total_cost) VALUES ($1,$2,$3,$4,$5)', [req.user.tenantId, rx.id, JSON.stringify(b.medicines), b.dispensedBy, computed]);
        await db.query('UPDATE prescriptions SET dispensed_at = now() WHERE id = $1', [rx.id]);
    });
    ok(res, { ok: true });
}));

// ------------------------------------------------------------ discharge medications
const dischargeOut = (d, fallback = {}) =>
    d
        ? { patientId: d.patient_id, encounterId: d.encounter_id ?? undefined, medications: d.medications, preparedBy: d.prepared_by ?? undefined, reviewedBy: d.reviewed_by ?? undefined, counsellingDone: d.counselling_done }
        : { medications: [], ...fallback };

const dischargeBody = z.object({
    patientId: z.string().optional(),
    medications: z.array(z.object({
        name: z.string().trim().min(1).max(200),
        dose: z.string().max(100).default(''),
        frequency: z.string().max(100).default(''),
        duration: z.string().max(100).default(''),
        instructions: z.string().max(1000).default(''),
    })),
    preparedBy: z.string().trim().min(1).max(200),
    reviewedBy: z.string().trim().min(1).max(200),
    counsellingDone: z.boolean(),
});

medicationRouter.get('/api/discharge/:patientId', h(async (req, res) => {
    const r = await query(`SELECT * FROM discharge_medications WHERE tenant_id = $1 AND patient_id = $2 AND encounter_id IS NULL`, [req.user.tenantId, req.params.patientId]);
    ok(res, dischargeOut(r.rows[0], { patientId: req.params.patientId }));
}));

medicationRouter.post('/api/discharge', nurseOrMd, h(async (req, res) => {
    const b = parse(dischargeBody.extend({ patientId: z.string().min(1) }), req.body);
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO discharge_medications (tenant_id, patient_id, medications, prepared_by, reviewed_by, counselling_done)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, patient_id) WHERE encounter_id IS NULL
         DO UPDATE SET medications = EXCLUDED.medications, prepared_by = EXCLUDED.prepared_by, reviewed_by = EXCLUDED.reviewed_by,
                       counselling_done = EXCLUDED.counselling_done, updated_at = now() RETURNING *`,
        [req.user.tenantId, b.patientId, JSON.stringify(b.medications), b.preparedBy, b.reviewedBy, b.counsellingDone],
    );
    ok(res, dischargeOut(r.rows[0]));
}));

medicationRouter.get('/api/discharges/:encounterId/medications', h(async (req, res) => {
    const r = await query(`SELECT * FROM discharge_medications WHERE tenant_id = $1 AND encounter_id = $2`, [req.user.tenantId, req.params.encounterId]);
    if (r.rowCount) return ok(res, dischargeOut(r.rows[0]));
    const enc = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.encounterId, req.user.tenantId]);
    if (!enc.rowCount) throw notFound('Encounter not found');
    ok(res, dischargeOut(null, { patientId: enc.rows[0].patient_id, encounterId: req.params.encounterId }));
}));

medicationRouter.post('/api/discharges/:encounterId/medications', nurseOrMd, h(async (req, res) => {
    const b = parse(dischargeBody, req.body);
    const enc = (await query('SELECT patient_id, status FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.encounterId, req.user.tenantId])).rows[0];
    if (!enc) throw notFound('Encounter not found');
    if (b.patientId && b.patientId !== enc.patient_id) throw badRequest('patientId does not match the encounter');
    const r = await query(
        `INSERT INTO discharge_medications (tenant_id, patient_id, encounter_id, medications, prepared_by, reviewed_by, counselling_done)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_id, encounter_id) WHERE encounter_id IS NOT NULL
         DO UPDATE SET medications = EXCLUDED.medications, prepared_by = EXCLUDED.prepared_by, reviewed_by = EXCLUDED.reviewed_by,
                       counselling_done = EXCLUDED.counselling_done, updated_at = now() RETURNING *`,
        [req.user.tenantId, enc.patient_id, req.params.encounterId, JSON.stringify(b.medications), b.preparedBy, b.reviewedBy, b.counsellingDone],
    );
    ok(res, dischargeOut(r.rows[0]));
}));
