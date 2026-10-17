import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, h, notFound, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

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

async function lockBed(db, bedId, tenantId) {
    const bed = (await db.query('SELECT * FROM beds WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [bedId, tenantId])).rows[0];
    if (!bed) throw notFound('Bed not found');
    return bed;
}

async function assertBedFree(db, bed, exceptEncounterId) {
    if (['maintenance', 'blocked', 'dirty'].includes(bed.status)) throw conflict(`Bed is ${bed.status} and cannot be assigned`);
    const occ = await db.query(
        `SELECT id FROM encounters WHERE bed_id = $1 AND status <> 'discharged' AND id <> COALESCE($2,'')`,
        [bed.id, exceptEncounterId ?? null],
    );
    if (occ.rowCount) throw conflict('That bed is already assigned to another patient');
}

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
        await assertBedFree(db, bed);
        const e = (
            await db.query(
                `INSERT INTO encounters (tenant_id, patient_id, bed_id, admission_type, source_of_admission, attending_physician_id, diagnosis)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [req.user.tenantId, b.patientId, b.bedId, b.admissionType, b.sourceOfAdmission ?? null, b.attendingPhysicianId ?? null, b.diagnosis ?? null],
            )
        ).rows[0];
        await db.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [b.bedId]);
        return e;
    });
    const who = (await query(`SELECT first_name || ' ' || last_name AS n FROM patients WHERE id = $1`, [enc.patient_id])).rows[0]?.n ?? 'Patient';
    await notifyStaff(req, 'admitted', `${who} was admitted`, { encounterId: enc.id, patientId: enc.patient_id, bedId: enc.bed_id });
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

// POST /api/transfers
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
    const out = await withTx(async (db) => {
        const e = (await db.query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [b.encounterId, req.user.tenantId])).rows[0];
        if (!e) throw notFound('Encounter not found');
        if (e.status === 'discharged') throw conflict('Encounter is already discharged');
        if (e.bed_id === b.newBedId) throw conflict('Patient is already in that bed');
        const bed = await lockBed(db, b.newBedId, req.user.tenantId);
        await assertBedFree(db, bed, e.id);
        await db.query('UPDATE encounters SET bed_id = $1 WHERE id = $2', [b.newBedId, e.id]);
        if (e.bed_id) await db.query(`UPDATE beds SET status = 'available' WHERE id = $1`, [e.bed_id]);
        await db.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [b.newBedId]);
        const t = (
            await db.query(
                `INSERT INTO bed_transfers (encounter_id, from_bed_id, to_bed_id, transfer_type, reason, transferred_by)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                [e.id, e.bed_id, b.newBedId, b.transferType ?? null, b.reason ?? null, req.user.id],
            )
        ).rows[0];
        return { encounterId: e.id, currentBedId: b.newBedId, transfer: { id: t.id, fromBedId: t.from_bed_id, toBedId: t.to_bed_id, transferType: t.transfer_type, reason: t.reason, transferredAt: t.transferred_at.toISOString() } };
    });
    success(res, 'Patient transferred', out);
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
        // Free the bed (the discharged encounter keeps its bed_id for history).
        if (e.bed_id) await db.query(`UPDATE beds SET status = 'available' WHERE id = $1`, [e.bed_id]);
        return { encounterId: d.id, dischargeTimestamp: d.discharged_at.toISOString(), patientId: d.patient_id };
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
