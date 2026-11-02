import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { medLineSchema, medLineOut } from '../lib/medLine.js';
import * as erx from '../lib/erx.js';

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
const medOut = (m) => ({ id: m.id, _id: m.id, name: m.name, dose: m.dose ?? undefined, route: m.route ?? undefined, frequency: m.frequency ?? undefined, instructions: m.instructions ?? undefined, source: m.source ?? 'inpatient', encounterId: m.encounter_id ?? undefined, nextScheduledTime: iso(m.next_scheduled_time), createdAt: iso(m.created_at) });

// ?source=inpatient (default — the MAR list) | home | all
medicationRouter.get('/api/patients/:patientId/medications', h(async (req, res) => {
    const q = parse(z.object({ source: z.enum(['inpatient', 'home', 'all']).default('inpatient') }), req.query);
    const params = [req.user.tenantId, req.params.patientId];
    let where = 'tenant_id = $1 AND patient_id = $2 AND is_active';
    if (q.source !== 'all') { params.push(q.source); where += ` AND source = $${params.length}`; }
    const r = await query(`SELECT * FROM medications WHERE ${where} ORDER BY source, name`, params);
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

// ------------------------------------------------------------ e-prescribing (Phase A) + dispensing
// `medicines` lines use the shared MedLine shape (lib/medLine.js) extended with the legacy pharmacy fields
// (medicineId / strength / quantityOrdered / unitPrice) that the dispense flow and PharmacyTab already read.
const rxLine = medLineSchema.extend({
    medicineId: z.string().trim().min(1).max(100).optional(),
    strength: z.string().trim().max(100).optional().nullable(),
    quantityOrdered: z.coerce.number().int().min(1).optional(),
    unitPrice: z.coerce.number().min(0).optional(),
    controlledSchedule: z.enum(['II', 'III', 'IV', 'V']).optional().nullable(),
});
const normalizeRxLine = (l, i) => {
    const quantity = l.quantity ?? l.quantityOrdered ?? 1;
    return {
        medicineId: l.medicineId ?? `rx-${Date.now().toString(36)}-${i + 1}`,
        ...medLineOut(l),
        strength: l.strength ?? l.dose ?? '',
        quantity,
        quantityOrdered: l.quantityOrdered ?? quantity,
        refills: l.refills ?? 0,
        unitPrice: l.unitPrice ?? 0,
        controlledSchedule: l.controlledSchedule ?? null,
    };
};
const RX_SELECT = `SELECT rx.*, ph.name AS pharmacy_name, u.first_name || ' ' || u.last_name AS prescriber_user_name
                   FROM prescriptions rx LEFT JOIN pharmacies ph ON ph.id = rx.pharmacy_id LEFT JOIN users u ON u.id = rx.prescriber_id`;
const rxOut = (p) => ({
    id: p.id,
    _id: p.id,
    prescriptionId: p.id,
    patientId: p.patient_id,
    encounterId: p.encounter_id ?? null,
    medicines: p.medicines,
    prescriberName: p.prescriber_name ?? p.prescriber_user_name ?? undefined,
    prescriberId: p.prescriber_id ?? null,
    prescriberNpi: p.prescriber_npi ?? '',
    prescriberDea: p.prescriber_dea ?? '',
    pharmacyId: p.pharmacy_id ?? null,
    pharmacyName: p.pharmacy_name ?? '',
    status: p.status ?? 'draft',
    controlledSchedule: p.controlled_schedule ?? null,
    notes: p.notes ?? '',
    orderedAt: iso(p.ordered_at),
    signedAt: iso(p.signed_at),
    transmittedAt: iso(p.transmitted_at),
    transmissionRef: p.transmission_ref ?? null,
    dispensedAt: iso(p.dispensed_at),
    cancelledAt: iso(p.cancelled_at),
    errorMessage: p.error_message ?? null,
    statusHistory: p.status_history ?? [],
});

async function loadRx(db, req, id, lock = false) {
    const r = await db.query(`SELECT * FROM prescriptions WHERE id = $1 AND tenant_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Prescription not found');
    return r.rows[0];
}
const rxFull = async (req, id) => rxOut((await query(`${RX_SELECT} WHERE rx.id = $1 AND rx.tenant_id = $2`, [id, req.user.tenantId])).rows[0]);
const historyEntry = (req, status, extra = {}) => ({ status, at: new Date().toISOString(), by: req.user.id, byName: req.user.name ?? null, ...extra });
async function setRxStatus(db, req, rx, status, sets = '', params = []) {
    const history = [...(rx.status_history ?? []), historyEntry(req, status)];
    await db.query(`UPDATE prescriptions SET status = $1, status_history = $2${sets} WHERE id = $3`, [status, JSON.stringify(history), rx.id, ...params]);
}

// GET /api/prescriptions/:patientId?status=all|draft|signed|transmitted|printed|dispensed|cancelled  (default: open = not dispensed/cancelled)
medicationRouter.get('/api/prescriptions/:patientId', h(async (req, res) => {
    const q = parse(z.object({ status: z.enum(['all', 'open', 'draft', 'signed', 'transmitted', 'printed', 'dispensed', 'cancelled', 'error']).default('open') }), req.query);
    const params = [req.user.tenantId, req.params.patientId];
    let where = 'rx.tenant_id = $1 AND rx.patient_id = $2';
    if (q.status === 'open') where += ` AND rx.status NOT IN ('dispensed','cancelled')`;
    else if (q.status !== 'all') { params.push(q.status); where += ` AND rx.status = $${params.length}`; }
    const r = await query(`${RX_SELECT} WHERE ${where} ORDER BY rx.ordered_at DESC`, params);
    ok(res, r.rows.map(rxOut));
}));

medicationRouter.get('/api/prescriptions/by-id/:id', h(async (req, res) => {
    await loadRx({ query }, req, req.params.id);
    ok(res, await rxFull(req, req.params.id));
}));

// POST /api/prescriptions → draft
medicationRouter.post('/api/prescriptions', requireRole('physician'), h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            encounterId: z.string().optional().nullable(),
            pharmacyId: z.string().optional().nullable(),
            prescriberName: z.string().max(200).optional(),
            notes: z.string().max(2000).optional().nullable(),
            controlledSchedule: z.enum(['II', 'III', 'IV', 'V']).optional().nullable(),
            medicines: z.array(rxLine).min(1).max(50),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    if (b.pharmacyId && !(await query('SELECT 1 FROM pharmacies WHERE id = $1 AND tenant_id = $2 AND active', [b.pharmacyId, req.user.tenantId])).rowCount) throw notFound('Pharmacy not found');
    const medicines = b.medicines.map(normalizeRxLine);
    const controlled = b.controlledSchedule ?? medicines.find((m) => m.controlledSchedule)?.controlledSchedule ?? null;
    const r = await query(
        `INSERT INTO prescriptions (tenant_id, patient_id, encounter_id, medicines, prescriber_name, prescriber_id, pharmacy_id, notes, controlled_schedule, status, status_history)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10) RETURNING id`,
        [req.user.tenantId, b.patientId, b.encounterId || null, JSON.stringify(medicines), b.prescriberName ?? req.user.name, req.user.id, b.pharmacyId || null, b.notes ?? null, controlled, JSON.stringify([historyEntry(req, 'draft')])],
    );
    created(res, await rxFull(req, r.rows[0].id));
}));

// POST /api/prescriptions/:id/sign — physician; copies NPI/DEA; controlled substances blocked until EPCS (Phase B)
medicationRouter.post('/api/prescriptions/:id/sign', requireRole('physician'), h(async (req, res) => {
    await withTx(async (db) => {
        const rx = await loadRx(db, req, req.params.id, true);
        if (rx.status !== 'draft') throw conflict(`Only draft prescriptions can be signed (status: ${rx.status})`);
        const controlled = rx.controlled_schedule || rx.medicines.find((m) => m.controlledSchedule)?.controlledSchedule;
        if (controlled) throw new ApiError(409, `Schedule ${controlled} controlled substance: electronic prescribing of controlled substances (EPCS, DEA 21 CFR 1311) is not enabled`, { controlledSchedule: controlled }, 'EPCS_NOT_ENABLED');
        const prescriber = (await db.query('SELECT npi, dea_number, first_name, last_name FROM users WHERE id = $1', [req.user.id])).rows[0];
        if (!prescriber?.npi && req.user.role !== 'admin') throw new ApiError(409, 'Add your NPI to your profile before signing prescriptions', undefined, 'PRESCRIBER_NPI_MISSING');
        await erx.runBeforeSign({ prescription: rx, user: req.user, db });
        await setRxStatus(db, req, rx, 'signed', `, signed_at = now(), prescriber_id = $4, prescriber_npi = $5, prescriber_dea = $6, prescriber_name = COALESCE(prescriber_name, $7)`,
            [req.user.id, prescriber?.npi ?? null, prescriber?.dea_number ?? null, `${prescriber?.first_name ?? ''} ${prescriber?.last_name ?? ''}`.trim() || req.user.name]);
    });
    ok(res, await rxFull(req, req.params.id));
}));

// POST /api/prescriptions/:id/transmit — signed → transmitted via lib/erx.js (stub mode flips with a fake ref)
medicationRouter.post('/api/prescriptions/:id/transmit', requireRole('physician', 'pharmacist'), h(async (req, res) => {
    const b = parse(z.object({ pharmacyId: z.string().optional().nullable() }), req.body ?? {});
    await withTx(async (db) => {
        const rx = await loadRx(db, req, req.params.id, true);
        if (rx.status !== 'signed') throw conflict(`Only signed prescriptions can be transmitted (status: ${rx.status})`);
        const pharmacyId = b.pharmacyId || rx.pharmacy_id;
        if (!pharmacyId) throw badRequest('Choose a pharmacy before transmitting');
        const pharmacy = (await db.query('SELECT * FROM pharmacies WHERE id = $1 AND tenant_id = $2 AND active', [pharmacyId, req.user.tenantId])).rows[0];
        if (!pharmacy) throw notFound('Pharmacy not found');
        try {
            const t = await erx.transmit({ prescription: rx, pharmacy });
            await setRxStatus(db, req, rx, 'transmitted', `, transmitted_at = now(), transmission_ref = $4, pharmacy_id = $5, error_message = NULL`, [t.ref, pharmacyId]);
        } catch (e) {
            await setRxStatus(db, req, rx, 'error', `, error_message = $4, pharmacy_id = $5`, [e.message, pharmacyId]);
            throw e;
        }
    });
    ok(res, await rxFull(req, req.params.id));
}));

// POST /api/prescriptions/:id/print — paper fallback (signed → printed)
medicationRouter.post('/api/prescriptions/:id/print', requireRole('physician', 'nurse', 'pharmacist'), h(async (req, res) => {
    await withTx(async (db) => {
        const rx = await loadRx(db, req, req.params.id, true);
        if (!['signed', 'error'].includes(rx.status)) throw conflict(`Only signed prescriptions can be printed (status: ${rx.status})`);
        await setRxStatus(db, req, rx, 'printed');
    });
    ok(res, await rxFull(req, req.params.id));
}));

// POST /api/prescriptions/:id/cancel
medicationRouter.post('/api/prescriptions/:id/cancel', requireRole('physician', 'pharmacist'), h(async (req, res) => {
    const b = parse(z.object({ reason: z.string().max(500).optional() }), req.body ?? {});
    await withTx(async (db) => {
        const rx = await loadRx(db, req, req.params.id, true);
        if (['dispensed', 'cancelled'].includes(rx.status)) throw conflict(`Prescription is already ${rx.status}`);
        const history = [...(rx.status_history ?? []), historyEntry(req, 'cancelled', { reason: b.reason ?? null })];
        await db.query(`UPDATE prescriptions SET status = 'cancelled', cancelled_at = now(), status_history = $1, notes = COALESCE(notes, '') || CASE WHEN $2::text IS NULL THEN '' ELSE E'\nCancelled: ' || $2 END WHERE id = $3`, [JSON.stringify(history), b.reason ?? null, rx.id]);
    });
    ok(res, await rxFull(req, req.params.id));
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
        const rx = await loadRx(db, req, b.prescriptionId, true);
        if (rx.dispensed_at || rx.status === 'dispensed') throw conflict('Prescription has already been dispensed');
        if (rx.status === 'cancelled') throw conflict('Prescription was cancelled');
        const ordered = new Map(rx.medicines.map((m) => [m.medicineId, m]));
        for (const line of b.medicines) {
            const o = ordered.get(line.medicineId);
            if (!o) throw badRequest(`Medicine ${line.medicineId} is not on this prescription`);
            if (line.quantityDispensed > (o.quantityOrdered ?? o.quantity ?? 0)) throw badRequest(`Cannot dispense more than ordered for ${o.name}`);
            if (line.expiryDate.slice(0, 10) < new Date().toISOString().slice(0, 10)) throw badRequest(`Batch for ${o.name} is expired`);
        }
        // Cost is recomputed server-side; the client total must agree.
        const computed = b.medicines.reduce((s, l) => s + l.quantityDispensed * l.unitPrice, 0);
        if (Math.abs(computed - b.totalCost) > 0.01) throw badRequest('totalCost does not match the dispensed lines');
        await db.query('INSERT INTO dispenses (tenant_id, prescription_id, medicines, dispensed_by, total_cost) VALUES ($1,$2,$3,$4,$5)', [req.user.tenantId, rx.id, JSON.stringify(b.medicines), b.dispensedBy, computed]);
        await setRxStatus(db, req, rx, 'dispensed', ', dispensed_at = now()');
    });
    ok(res, { ok: true });
}));

// ------------------------------------------------------------ pharmacy directory (tenant)
const pharmacyOut = (p) => ({ id: p.id, _id: p.id, name: p.name, ncpdpId: p.ncpdp_id ?? '', npi: p.npi ?? '', phone: p.phone ?? '', fax: p.fax ?? '', address: p.address ?? {}, isDefault: p.is_default, active: p.active, createdAt: iso(p.created_at) });
const pharmacyBody = z.object({
    name: z.string().trim().min(1).max(200),
    ncpdpId: z.string().trim().max(20).optional().nullable(),
    npi: z.preprocess((v) => (v === null || v === undefined ? v : String(v).replace(/\D/g, '')), z.string().regex(/^$|^[1-9]\d{9}$/, 'NPI must be 10 digits').optional().nullable()),
    phone: z.string().trim().max(30).optional().nullable(),
    fax: z.string().trim().max(30).optional().nullable(),
    address: z.object({ line1: z.string().max(200).optional(), line2: z.string().max(200).optional(), city: z.string().max(100).optional(), state: z.string().max(50).optional(), zip: z.string().max(20).optional() }).partial().optional().nullable(),
    isDefault: z.boolean().optional(),
    active: z.boolean().optional(),
});

medicationRouter.get('/api/pharmacies', h(async (req, res) => {
    const q = parse(z.object({ includeInactive: z.enum(['true', 'false']).default('false') }), req.query);
    const r = await query(`SELECT * FROM pharmacies WHERE tenant_id = $1 ${q.includeInactive === 'true' ? '' : 'AND active'} ORDER BY is_default DESC, name`, [req.user.tenantId]);
    ok(res, r.rows.map(pharmacyOut));
}));

medicationRouter.post('/api/pharmacies', requireRole(), h(async (req, res) => {
    const b = parse(pharmacyBody, req.body);
    const r = await withTx(async (db) => {
        if (b.isDefault) await db.query('UPDATE pharmacies SET is_default = false WHERE tenant_id = $1', [req.user.tenantId]);
        return db.query(
            `INSERT INTO pharmacies (tenant_id, name, ncpdp_id, npi, phone, fax, address, is_default, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [req.user.tenantId, b.name, b.ncpdpId || null, b.npi || null, b.phone || null, b.fax || null, JSON.stringify(b.address ?? {}), b.isDefault ?? false, b.active ?? true],
        );
    });
    created(res, pharmacyOut(r.rows[0]));
}));

medicationRouter.put('/api/pharmacies/:id', requireRole(), h(async (req, res) => {
    const b = parse(pharmacyBody.partial(), req.body);
    const r = await withTx(async (db) => {
        if (b.isDefault) await db.query('UPDATE pharmacies SET is_default = false WHERE tenant_id = $1 AND id <> $2', [req.user.tenantId, req.params.id]);
        return db.query(
            `UPDATE pharmacies SET name = COALESCE($1, name), ncpdp_id = COALESCE($2, ncpdp_id), npi = COALESCE($3, npi), phone = COALESCE($4, phone), fax = COALESCE($5, fax),
                    address = COALESCE($6::jsonb, address), is_default = COALESCE($7, is_default), active = COALESCE($8, active), updated_at = now()
             WHERE id = $9 AND tenant_id = $10 RETURNING *`,
            [b.name ?? null, b.ncpdpId ?? null, b.npi ?? null, b.phone ?? null, b.fax ?? null, b.address ? JSON.stringify(b.address) : null, b.isDefault ?? null, b.active ?? null, req.params.id, req.user.tenantId],
        );
    });
    if (!r.rowCount) throw notFound('Pharmacy not found');
    ok(res, pharmacyOut(r.rows[0]));
}));

medicationRouter.delete('/api/pharmacies/:id', requireRole(), h(async (req, res) => {
    const r = await query('UPDATE pharmacies SET active = false, is_default = false, updated_at = now() WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Pharmacy not found');
    res.json({ status: 'success', message: 'Pharmacy deactivated' });
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
