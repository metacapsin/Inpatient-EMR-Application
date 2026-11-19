import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, h, notFound, parse } from '../lib/http.js';
import { requireRole, requireClinicalRole } from '../middleware/auth.js';
import { assertBedFree, fulfillReservations, lockBed, performTransfer, vacateBed } from '../lib/bedManagement.js';
import { recordAdtEvent } from '../lib/adtNotify.js';
import { computeDischargeGates } from '../lib/dischargeGates.js';
import { isValidDispositionCode } from '../lib/dispositionCodes.js';

/**
 * CMS CoP 42 CFR 482.24(d) notifications: one log row per recipient + a delivery job (see lib/adtNotify.js).
 * Best effort — never fails the ADT call.
 */
const enqueueAdtNotification = (req, encounterId, eventType, extra = {}) => recordAdtEvent({ tenantId: req.user.tenantId, encounterId, eventType, ...extra });

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

// GET /api/physicians — minimal active-physician list for pickers (attending, pronouncing physician on
// a death record, etc.). Open to any clinical role, unlike the admin-only /tenants/users directory.
adtRouter.get('/api/physicians', clinical, h(async (req, res) => {
    const r = await query(
        `SELECT id, first_name || ' ' || last_name AS name FROM users WHERE tenant_id = $1 AND is_active AND role = 'physician' ORDER BY last_name, first_name`,
        [req.user.tenantId],
    );
    success(res, '', r.rows.map((u) => ({ id: u.id, name: u.name })));
}));

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
        // SAF-21: attending_physician_id was previously unvalidated free text — confirm it's an active
        // physician in this tenant before it's attributed as the attending of record.
        if (b.attendingPhysicianId) {
            const att = await db.query(`SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active AND role = 'physician'`, [b.attendingPhysicianId, req.user.tenantId]);
            if (!att.rowCount) throw notFound('Attending physician not found');
        }
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
    await enqueueAdtNotification(req, enc.id, 'A01');
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
    await enqueueAdtNotification(req, out.encounterId, 'A02', { priorBedId: out.transfer?.fromBedId ?? null });
    success(res, 'Patient transferred', rest);
}));

async function initiate(req, res, b) {
    // Bucket B / the UI never actually sent a disposition through this call (it's chosen on the
    // discharge summary instead), which meant encounters.disposition — the field HL7 PV1-36 and the
    // AMA/deceased gates below actually read — stayed null forever in practice. Fall back to whatever
    // was saved on the (already-required-to-be-signed-before-confirm) discharge summary.
    let disposition = b.disposition ?? null;
    if (!disposition) {
        const summary = (await query('SELECT disposition FROM discharge_summaries WHERE encounter_id = $1', [b.encounterId])).rows[0];
        disposition = summary?.disposition ?? null;
    }
    const r = await query(
        `UPDATE encounters SET status = 'discharge_initiated', discharge_initiated_at = COALESCE(discharge_initiated_at, now()),
                disposition = COALESCE($1, disposition), discharge_summary = COALESCE($2, discharge_summary)
         WHERE id = $3 AND tenant_id = $4 AND status <> 'discharged' RETURNING *`,
        [disposition, b.dischargeSummary ?? null, b.encounterId, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Active encounter not found');
    success(res, 'Discharge initiated', { encounterId: r.rows[0].id, dischargeInitiatedAt: r.rows[0].discharge_initiated_at.toISOString() });
}

async function confirm(req, res, b) {
    // SAF-12: finalizing a discharge is a physician decision — nurse/staff can still initiate
    // (start the paperwork), but only a physician can confirm it.
    if (req.user.role !== 'physician') {
        throw new ApiError(403, 'Discharge confirmation requires a physician — an administrator or non-physician account cannot perform it.');
    }
    const out = await withTx(async (db) => {
        const e = (await db.query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [b.encounterId, req.user.tenantId])).rows[0];
        if (!e) throw notFound('Encounter not found');
        if (e.status === 'discharged') throw conflict('Encounter is already discharged');
        if (e.status !== 'discharge_initiated') throw new ApiError(409, 'Discharge must be initiated before it can be confirmed');
        // Hard gates (plan §2c): signed discharge summary, completed discharge med reconciliation, blocking checklist tasks.
        const gates = await computeDischargeGates(db, req.user.tenantId, e.id);
        if (gates.blocked) {
            throw new ApiError(409, `Discharge blocked: ${gates.blocking.map((g) => g.message).join('; ')}`, { gates: gates.gates, blocking: gates.blocking }, 'DISCHARGE_BLOCKED');
        }
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
    await enqueueAdtNotification(req, out.encounterId, 'A03');
    success(res, 'Patient discharged', out);
}

const dischargeSchema = z.object({
    phase: z.enum(['initiate', 'confirm']),
    encounterId: z.string().min(1),
    disposition: z.string().refine(isValidDispositionCode, 'Not a recognized discharge disposition code').optional(),
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

// SEC-17-style: recording an AMA discharge or a death is a clinical attestation — not an admin act.
const dischargeAttestor = requireClinicalRole('physician');

// POST /api/encounters/:id/ama-discharge — required before confirm when disposition is AMA ('07').
adtRouter.post('/api/encounters/:id/ama-discharge', dischargeAttestor, h(async (req, res) => {
    const b = parse(
        z.object({
            reason: z.string().trim().min(1).max(2000),
            risksExplained: z.boolean(),
            witnessName: z.string().trim().min(1).max(200),
            patientSignature: z.string().trim().min(1).max(200),
        }),
        req.body,
    );
    const enc = (await query('SELECT id FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!enc) throw notFound('Encounter not found');
    const r = await query(
        `INSERT INTO ama_discharges (tenant_id, encounter_id, reason, risks_explained, witness_name, patient_signature, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (encounter_id) DO UPDATE SET reason = $3, risks_explained = $4, witness_name = $5, patient_signature = $6, recorded_by = $7
         RETURNING *`,
        [req.user.tenantId, enc.id, b.reason, b.risksExplained, b.witnessName, b.patientSignature, req.user.id],
    );
    success(res, 'AMA discharge recorded', { id: r.rows[0].id, encounterId: enc.id, createdAt: r.rows[0].created_at.toISOString() }, 201);
}));

// POST /api/encounters/:id/death-record — required before confirm when disposition is Expired ('20').
adtRouter.post('/api/encounters/:id/death-record', dischargeAttestor, h(async (req, res) => {
    const b = parse(
        z.object({
            diedAt: z.string().datetime({ offset: true }),
            pronouncingPhysicianId: z.string().trim().min(1),
            causeOfDeath: z.string().trim().max(2000).optional(),
        }),
        req.body,
    );
    const enc = (await query('SELECT id, patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!enc) throw notFound('Encounter not found');
    const physician = await query(`SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active AND role = 'physician'`, [b.pronouncingPhysicianId, req.user.tenantId]);
    if (!physician.rowCount) throw notFound('Pronouncing physician not found');
    const out = await withTx(async (db) => {
        const r = await db.query(
            `INSERT INTO death_records (tenant_id, encounter_id, patient_id, died_at, pronouncing_physician_id, cause_of_death, recorded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (encounter_id) DO UPDATE SET died_at = $4, pronouncing_physician_id = $5, cause_of_death = $6, recorded_by = $7
             RETURNING *`,
            [req.user.tenantId, enc.id, enc.patient_id, b.diedAt, b.pronouncingPhysicianId, b.causeOfDeath ?? null, req.user.id],
        );
        await db.query('UPDATE patients SET deceased = TRUE, deceased_at = $1 WHERE id = $2', [b.diedAt, enc.patient_id]);
        return r.rows[0];
    });
    success(res, 'Death recorded', { id: out.id, encounterId: enc.id, diedAt: out.died_at.toISOString() }, 201);
}));
