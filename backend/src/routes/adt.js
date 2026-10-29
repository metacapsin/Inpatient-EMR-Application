import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, h, notFound, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { boss, QUEUES } from '../db/queue.js';
import { assertBedFree, fulfillReservations, lockBed, performTransfer, vacateBed } from '../lib/bedManagement.js';

/** Best-effort: queues the CMS CoP admission notification. Never fails the admission if the queue is down. */
async function enqueueAdtNotification(req, enc, patient) {
    try {
        await boss.send(QUEUES.ADT_NOTIFICATION, {
            encounterId: enc.id,
            tenantId: req.user.tenantId,
            patientId: enc.patient_id,
            mrn: patient.mrn,
            patientName: `${patient.first_name} ${patient.last_name}`,
            dob: patient.dob,
            bedId: enc.bed_id,
            admissionType: enc.admission_type,
            attendingPhysicianId: enc.attending_physician_id,
            diagnosis: enc.diagnosis,
            admittedAt: enc.admitted_at?.toISOString?.() ?? enc.admitted_at,
        });
    } catch (e) {
        console.error('[adt-notification] failed to enqueue:', e.message);
    }
}

/** Tell every other active staff member in the tenant about a bed-flow event (best effort; never fails the ADT call). */
async function notifyStaff(req, action, message, metadata) {
    try {
        await query(
            `INSERT INTO notifications (tenant_id, user_id, type, action, message, metadata, created_by)
             SELECT $1, id, 'adt', $2, $3, $4::jsonb, $5 FROM users WHERE tenant_id = $1 AND is_active AND id <> $5`,
            [req.user.tenantId, action, message, JSON.stringify(metadata), req.user.id],
        );
    } catch (e) {
        console.error('[notify] failed:', e.message);
    }
}

export const adtRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

const encounterOut = (e) => ({
    id: e.id,
    _id: e.id,
    patientId: e.patient_id,
    bedId: e.bed_id,
    currentBedId: e.bed_id,
    status: e.status,
    admissionType: e.admission_type,
    sourceOfAdmission: e.source_of_admission,
    attendingPhysicianId: e.attending_physician_id,
    diagnosis: e.diagnosis,
    admissionTimestamp: e.admitted_at?.toISOString?.() ?? e.admitted_at,
    dischargeInitiatedAt: e.discharge_initiated_at?.toISOString?.() ?? null,
    dischargeTimestamp: e.discharged_at?.toISOString?.() ?? null,
    disposition: e.disposition,
    ...(e.patient_name ? { patientName: e.patient_name } : {}),
});

const success = (res, message, data, code = 200) => res.status(code).json({ status: 'success', message, data });

// POST /api/admissions
adtRouter.post('/api/admissions', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            bedId: z.string().min(1),
            admissionType: z.enum(['emergency', 'elective', 'urgent']).default('elective'),
            sourceOfAdmission: z.string().trim().max(200).optional(),
            attendingPhysicianId: z.string().trim().max(100).optional(),
            diagnosis: z.string().trim().max(1000).optional(),
        }),
        req.body,
    );
    const enc = await withTx(async (db) => {
        const patient = (await db.query('SELECT id, is_active FROM patients WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [b.patientId, req.user.tenantId])).rows[0];
        if (!patient) throw notFound('Patient not found');
        if (!patient.is_active) throw conflict('Patient record is inactive');
        const already = await db.query(`SELECT id FROM encounters WHERE patient_id = $1 AND status <> 'discharged'`, [b.patientId]);
        if (already.rowCount) throw conflict('Patient already has an active admission');
        const bed = await lockBed(db, b.bedId, req.user.tenantId);
        // A bed on 'hold' is only assignable to the patient it was reserved for.
        await assertBedFree(db, bed, { patientId: b.patientId });
        const e = (
            await db.query(
                `INSERT INTO encounters (tenant_id, patient_id, bed_id, admission_type, source_of_admission, attending_physician_id, diagnosis)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [req.user.tenantId, b.patientId, b.bedId, b.admissionType, b.sourceOfAdmission ?? null, b.attendingPhysicianId ?? null, b.diagnosis ?? null],
            )
        ).rows[0];
        await db.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [b.bedId]);
        await fulfillReservations(db, b.bedId);
        return e;
    });
    const patient = (await query(`SELECT mrn, first_name, last_name, dob FROM patients WHERE id = $1 AND tenant_id = $2`, [enc.patient_id, req.user.tenantId])).rows[0];
    const who = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';
    await notifyStaff(req, 'admitted', `${who} was admitted`, { encounterId: enc.id, patientId: enc.patient_id, bedId: enc.bed_id });
    await enqueueAdtNotification(req, enc, patient);
    success(res, 'Patient admitted', { encounter: encounterOut(enc) }, 201);
}));

// GET /api/admissions/active?patientId=&bedId=
adtRouter.get('/api/admissions/active', h(async (req, res) => {
    const params = [req.user.tenantId];
    let sql = `SELECT e.*, p.first_name || ' ' || p.last_name AS patient_name
               FROM encounters e JOIN patients p ON p.id = e.patient_id
               WHERE e.tenant_id = $1 AND e.status <> 'discharged'`;
    if (typeof req.query.patientId === 'string' && req.query.patientId) { params.push(req.query.patientId); sql += ` AND e.patient_id = $${params.length}`; }
    if (typeof req.query.bedId === 'string' && req.query.bedId) { params.push(req.query.bedId); sql += ` AND e.bed_id = $${params.length}`; }
    const r = await query(`${sql} ORDER BY e.admitted_at DESC`, params);
    success(res, 'Active encounters', r.rows.map(encounterOut));
}));

// POST /api/transfers — the vacated bed goes to 'dirty' and into the EVS queue (see lib/bedManagement.js).
adtRouter.post('/api/transfers', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            encounterId: z.string().min(1),
            newBedId: z.string().min(1),
            transferType: z.string().trim().max(100).optional(),
            reason: z.string().trim().max(1000).optional(),
        }),
        req.body,
    );
    const out = await withTx((db) =>
        performTransfer(db, { tenantId: req.user.tenantId, userId: req.user.id, encounterId: b.encounterId, newBedId: b.newBedId, transferType: b.transferType, reason: b.reason }),
    );
    const { patientId, ...rest } = out;
    await notifyStaff(req, 'transferred', 'A patient was transferred', { encounterId: out.encounterId, patientId, bedId: out.currentBedId });
    success(res, 'Patient transferred', rest);
}));

async function initiate(req, res, b) {
    const r = await query(
        `UPDATE encounters SET status = 'discharge_initiated', discharge_initiated_at = COALESCE(discharge_initiated_at, now()),
                disposition = COALESCE($1, disposition), discharge_summary = COALESCE($2, discharge_summary)
         WHERE id = $3 AND tenant_id = $4 AND status <> 'discharged' RETURNING *`,
        [b.disposition ?? null, b.dischargeSummary ?? null, b.encounterId, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Active encounter not found');
    success(res, 'Discharge initiated', { encounterId: r.rows[0].id, dischargeInitiatedAt: r.rows[0].discharge_initiated_at.toISOString() });
}

async function confirm(req, res, b) {
    const out = await withTx(async (db) => {
        const e = (await db.query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [b.encounterId, req.user.tenantId])).rows[0];
        if (!e) throw notFound('Encounter not found');
        if (e.status === 'discharged') throw conflict('Encounter is already discharged');
        if (e.status !== 'discharge_initiated') throw new ApiError(409, 'Discharge must be initiated before it can be confirmed');
        const d = (
            await db.query(
                `UPDATE encounters SET status = 'discharged', discharged_at = now(), bed_id = bed_id WHERE id = $1 RETURNING *`,
                [e.id],
            )
        ).rows[0];
        // The discharged encounter keeps its bed_id for history. The bed is NOT free yet: it is 'dirty'
        // until housekeeping cleans it and an inspector approves it (EVS queue), which is what returns it to 'available'.
        const evs = e.bed_id ? await vacateBed(db, { tenantId: req.user.tenantId, bedId: e.bed_id, encounterId: e.id, defaultCleaningType: 'Discharge' }) : null;
        return { encounterId: d.id, dischargeTimestamp: d.discharged_at.toISOString(), patientId: d.patient_id, bedId: e.bed_id, evsQueueId: evs?.id ?? null };
    });
    await notifyStaff(req, 'discharged', 'A patient was discharged', { encounterId: out.encounterId, patientId: out.patientId });
    success(res, 'Patient discharged', out);
}

const dischargeSchema = z.object({
    phase: z.enum(['initiate', 'confirm']),
    encounterId: z.string().min(1),
    disposition: z.string().trim().max(200).optional(),
    dischargeSummary: z.string().trim().max(10000).optional(),
});

// POST /api/discharges   { phase: 'initiate' | 'confirm' }
adtRouter.post('/api/discharges', clinical, h(async (req, res) => {
    const b = parse(dischargeSchema, req.body);
    return b.phase === 'initiate' ? initiate(req, res, b) : confirm(req, res, b);
}));

// POST /api/discharges/confirm
adtRouter.post('/api/discharges/confirm', clinical, h(async (req, res) => {
    const b = parse(z.object({ encounterId: z.string().min(1) }), req.body);
    return confirm(req, res, b);
}));
