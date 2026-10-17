import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

// Radiology orders (/api/Radiology/*) and code events (/api/CodeEvent/*).
export const clinicalOpsRouter = Router();
const orderer = requireRole('physician');
const clinical = requireRole('physician', 'nurse');

const ts = (v) => (v ? v.toISOString() : undefined);
const optText = (max = 500) => z.string().trim().max(max).optional().nullable();
const isoTs = z.string().datetime({ offset: true }).or(z.string().datetime({ local: true }));

async function assertEncounter(req, encounterId, patientId) {
    const r = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Encounter not found');
    if (patientId && r.rows[0].patient_id !== patientId) throw badRequest('Encounter does not belong to this patient');
    return r.rows[0];
}

// ================================================================= radiology
const radOut = (o) => ({
    id: o.id,
    _id: o.id,
    orderId: o.id,
    patientId: o.patient_id,
    encounterId: o.encounter_id,
    tenantId: o.tenant_id,
    modality: o.modality,
    bodyRegion: o.body_region,
    laterality: o.laterality ?? undefined,
    contrast: o.contrast ?? undefined,
    clinicalIndication: o.clinical_indication,
    icd10Codes: o.icd10_codes,
    priority: o.priority,
    specialInstructions: o.special_instructions ?? undefined,
    transportRequired: o.transport_required,
    scheduledFor: ts(o.scheduled_for) ?? null,
    orderedBy: o.ordered_by ?? '',
    orderedByName: o.ordered_by_name ?? undefined,
    orderedAt: ts(o.ordered_at),
    status: o.status,
    acknowledgedBy: o.acknowledged_by ?? undefined,
    acknowledgedAt: ts(o.acknowledged_at),
    performedAt: ts(o.performed_at),
    radiologistName: o.radiologist_name ?? undefined,
    radiologistId: o.radiologist_id ?? undefined,
    impression: o.impression ?? undefined,
    findings: o.findings ?? undefined,
    criticalValue: o.critical_value,
    criticalValueNotifiedAt: ts(o.critical_value_notified_at),
    criticalValueNotifiedTo: o.critical_value_notified_to ?? undefined,
    dicomStudyUid: o.dicom_study_uid ?? undefined,
    dicomViewerUrl: o.dicom_viewer_url ?? undefined,
    resultedAt: ts(o.resulted_at),
    amendmentReason: o.amendment_reason ?? undefined,
});

async function loadRad(req, id, db = { query }) {
    const r = await db.query('SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Radiology order not found');
    return r.rows[0];
}

clinicalOpsRouter.post('/api/Radiology/order', orderer, h(async (req, res) => {
    const b = parse(
        z.object({
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
            scheduledFor: isoTs.optional().nullable(),
        }),
        req.body,
    );
    await assertEncounter(req, b.encounterId, b.patientId);
    const r = await query(
        `INSERT INTO radiology_orders (tenant_id, patient_id, encounter_id, modality, body_region, laterality, contrast, clinical_indication, icd10_codes,
                                       priority, special_instructions, transport_required, scheduled_for, ordered_by, ordered_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId, b.modality, b.bodyRegion, b.laterality || null, b.contrast || null, b.clinicalIndication, JSON.stringify(b.icd10Codes),
         b.priority, b.specialInstructions || null, b.transportRequired, b.scheduledFor ?? null, req.user.id, req.user.name || req.user.email],
    );
    created(res, radOut(r.rows[0]));
}));

clinicalOpsRouter.get('/api/Radiology/encounter/:encounterId', h(async (req, res) => {
    const r = await query('SELECT * FROM radiology_orders WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY ordered_at DESC', [req.user.tenantId, req.params.encounterId]);
    ok(res, r.rows.map(radOut));
}));

clinicalOpsRouter.get('/api/Radiology/order/:orderId', h(async (req, res) => {
    const r = await query('SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2', [req.params.orderId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Radiology order not found');
    ok(res, radOut(r.rows[0]));
}));

const CLOSED = ['Final', 'Amended', 'Cancelled'];

clinicalOpsRouter.put('/api/Radiology/order/:orderId/acknowledge', clinical, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadRad(req, req.params.orderId, db);
        if (CLOSED.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        const r = await db.query(
            `UPDATE radiology_orders SET acknowledged_by = $1, acknowledged_at = now(), status = CASE WHEN status = 'Ordered' THEN 'Scheduled' ELSE status END
             WHERE id = $2 RETURNING *`,
            [req.user.name || req.user.email, o.id],
        );
        return r.rows[0];
    });
    ok(res, radOut(out));
}));

clinicalOpsRouter.put('/api/Radiology/order/:orderId/result', orderer, h(async (req, res) => {
    const b = parse(
        z.object({
            impression: optText(4000),
            findings: optText(8000),
            radiologistName: optText(200),
            radiologistId: optText(100),
            performedAt: isoTs.optional().nullable(),
            dicomStudyUid: optText(128),
            dicomViewerUrl: z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL').optional().nullable(),
            resultedAt: isoTs.optional().nullable(),
            amendmentReason: optText(1000),
        }),
        req.body,
    );
    if (!b.impression && !b.findings) throw badRequest('impression or findings is required');
    const out = await withTx(async (db) => {
        const o = await loadRad(req, req.params.orderId, db);
        if (o.status === 'Cancelled') throw conflict('Order is cancelled');
        const amending = o.status === 'Final' || o.status === 'Amended';
        if (amending && !b.amendmentReason) throw badRequest('amendmentReason is required to amend a final report');
        const r = await db.query(
            `UPDATE radiology_orders SET impression = COALESCE($1, impression), findings = COALESCE($2, findings), radiologist_name = COALESCE($3, radiologist_name),
                    radiologist_id = COALESCE($4, radiologist_id), performed_at = COALESCE($5::timestamptz, performed_at, now()), dicom_study_uid = COALESCE($6, dicom_study_uid),
                    dicom_viewer_url = COALESCE($7, dicom_viewer_url), resulted_at = COALESCE($8::timestamptz, now()),
                    status = $9, amendment_reason = COALESCE($10, amendment_reason)
             WHERE id = $11 RETURNING *`,
            [b.impression ?? null, b.findings ?? null, b.radiologistName || req.user.name || null, b.radiologistId || req.user.id, b.performedAt ?? null, b.dicomStudyUid ?? null,
             b.dicomViewerUrl ?? null, b.resultedAt ?? null, amending ? 'Amended' : 'Final', b.amendmentReason ?? null, o.id],
        );
        return r.rows[0];
    });
    ok(res, radOut(out));
}));

clinicalOpsRouter.put('/api/Radiology/order/:orderId/cancel', orderer, h(async (req, res) => {
    const out = await withTx(async (db) => {
        const o = await loadRad(req, req.params.orderId, db);
        if (CLOSED.includes(o.status)) throw conflict(`Order is already ${o.status}`);
        return (await db.query(`UPDATE radiology_orders SET status = 'Cancelled', amendment_reason = 'Order cancelled' WHERE id = $1 RETURNING *`, [o.id])).rows[0];
    });
    ok(res, radOut(out));
}));

clinicalOpsRouter.put('/api/Radiology/order/:orderId/critical', clinical, h(async (req, res) => {
    const b = parse(z.object({ criticalValue: z.boolean(), criticalValueNotifiedTo: optText(200) }), req.body);
    if (b.criticalValue && !b.criticalValueNotifiedTo) throw badRequest('criticalValueNotifiedTo is required when flagging a critical value');
    const out = await withTx(async (db) => {
        const o = await loadRad(req, req.params.orderId, db);
        if (o.status === 'Cancelled') throw conflict('Order is cancelled');
        return (
            await db.query(
                `UPDATE radiology_orders SET critical_value = $1, critical_value_notified_to = $2, critical_value_notified_at = CASE WHEN $1 THEN now() ELSE NULL END,
                        status = CASE WHEN status = 'Ordered' THEN 'Preliminary' ELSE status END
                 WHERE id = $3 RETURNING *`,
                [b.criticalValue, b.criticalValue ? b.criticalValueNotifiedTo : null, o.id],
            )
        ).rows[0];
    });
    ok(res, radOut(out));
}));

// ================================================================= code events
const TYPES = ['Code Blue', 'Rapid Response', 'Code Stroke', 'Code STEMI', 'Code Sepsis', 'Code OB'];
const OUTCOMES = ['ROSC', 'Patient Expired', 'Transferred to ICU', 'Transferred to Cath Lab', 'Stable — Continued Same Unit', 'Transported to OR'];
const DISPOSITIONS = ['ICU', 'Step-Down', 'Cath Lab', 'OR', 'Same Unit', 'Morgue'];
const TEAM_ROLES = ['MD', 'RN', 'RT', 'Pharmacist', 'Charge Nurse', 'Other'];
const ENTRY_TYPES = ['Rhythm Check', 'CPR Started', 'CPR Stopped', 'Defibrillation', 'Cardioversion', 'Medication Given', 'Airway Established', 'IV Access', 'IO Access', 'Lab Drawn', 'Imaging', 'ROSC', 'Patient Expired', 'Family Notified', 'Other'];

const CE_SELECT = `SELECT ce.*, trim(p.first_name || ' ' || p.last_name) AS patient_name, p.mrn AS patient_mrn FROM code_events ce JOIN patients p ON p.id = ce.patient_id`;

const ceOut = (e) => ({
    id: e.id,
    patientId: e.patient_id,
    encounterId: e.encounter_id,
    tenantId: e.tenant_id,
    patientName: e.patient_name,
    patientMrn: e.patient_mrn,
    eventType: e.event_type,
    location: e.location,
    calledBy: e.called_by,
    calledByName: e.called_by_name,
    calledAt: e.called_at.toISOString(),
    teamLeadId: e.team_lead_id,
    teamLeadName: e.team_lead_name,
    teamMembers: e.team_members,
    timeline: e.timeline,
    status: e.status,
    endTime: e.end_time ? e.end_time.toISOString() : null,
    outcome: e.outcome,
    postEventDisposition: e.post_event_disposition,
    debriefNotes: e.debrief_notes,
    totalDurationMinutes: e.total_duration_minutes,
    unitId: e.unit_id ?? undefined,
    announceToUnit: e.announce_to_unit,
});

async function loadCe(db, req, id, lock = false) {
    const r = await db.query(`${CE_SELECT} WHERE ce.id = $1 AND ce.tenant_id = $2 ${lock ? 'FOR UPDATE OF ce' : ''}`, [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Code event not found');
    return r.rows[0];
}

clinicalOpsRouter.post('/api/CodeEvent/activate', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            encounterId: z.string().min(1),
            eventType: z.enum(TYPES),
            location: z.string().trim().min(1).max(200),
            calledAt: isoTs.optional(),
            teamLeadId: z.string().trim().max(100).default(''),
            teamLeadName: z.string().trim().max(200).default(''),
            announceToUnit: z.boolean().default(false),
        }),
        req.body,
    );
    await assertEncounter(req, b.encounterId, b.patientId);
    // The unit of a code is the ward the patient's bed is in.
    const unit = await query(
        `SELECT rm.ward_id FROM encounters e JOIN beds bd ON bd.id = e.bed_id JOIN rooms rm ON rm.id = bd.room_id WHERE e.id = $1`,
        [b.encounterId],
    );
    let id;
    try {
        const r = await query(
            `INSERT INTO code_events (tenant_id, patient_id, encounter_id, unit_id, event_type, location, called_by, called_by_name, called_at, team_lead_id, team_lead_name, announce_to_unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, now()),$10,$11,$12) RETURNING id`,
            [req.user.tenantId, b.patientId, b.encounterId, unit.rows[0]?.ward_id ?? null, b.eventType, b.location, req.user.id, req.user.name || req.user.email, b.calledAt ?? null, b.teamLeadId, b.teamLeadName, b.announceToUnit],
        );
        id = r.rows[0].id;
    } catch (e) {
        if (e.code === '23505') throw conflict('Patient already has an active code event');
        throw e;
    }
    created(res, ceOut(await loadCe({ query }, req, id)));
}));

// `all` (and the frontend's default placeholder `unit-1`) means every unit of the tenant.
clinicalOpsRouter.get('/api/CodeEvent/active/:unitId', h(async (req, res) => {
    const u = req.params.unitId;
    const all = u === 'all' || u === 'unit-1';
    const r = await query(`${CE_SELECT} WHERE ce.tenant_id = $1 AND ce.status = 'active' ${all ? '' : 'AND ce.unit_id = $2'} ORDER BY ce.called_at DESC`, all ? [req.user.tenantId] : [req.user.tenantId, u]);
    ok(res, r.rows.map(ceOut).map(({ id, patientId, patientName, patientMrn, eventType, location, status, calledAt, teamLeadName }) => ({ id, patientId, patientName, patientMrn, eventType, location, status, calledAt, teamLeadName })));
}));

clinicalOpsRouter.get('/api/CodeEvent/patient/:patientId', h(async (req, res) => {
    // The active event if there is one, otherwise the most recent.
    const r = await query(`${CE_SELECT} WHERE ce.tenant_id = $1 AND ce.patient_id = $2 ORDER BY (ce.status = 'active') DESC, ce.called_at DESC LIMIT 1`, [req.user.tenantId, req.params.patientId]);
    if (!r.rowCount) throw notFound('No code event for this patient');
    ok(res, ceOut(r.rows[0]));
}));

clinicalOpsRouter.get('/api/CodeEvent/:id', h(async (req, res) => ok(res, ceOut(await loadCe({ query }, req, req.params.id)))));

clinicalOpsRouter.put('/api/CodeEvent/:id/timeline', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            timeline: z
                .array(
                    z.object({
                        id: z.string().trim().min(1).max(100),
                        timestamp: isoTs,
                        entryType: z.enum(ENTRY_TYPES),
                        medication: z.object({ name: z.string().trim().max(200), dose: z.string().trim().max(100), route: z.string().trim().max(50) }).optional().nullable(),
                        joules: z.number().min(0).max(1000).optional().nullable(),
                        notes: optText(1000),
                        enteredBy: z.string().trim().max(200).default(''),
                    }),
                )
                .max(500),
        }),
        req.body,
    );
    const out = await withTx(async (db) => {
        const e = await loadCe(db, req, req.params.id, true);
        if (e.status === 'closed') throw conflict('Code event is closed');
        await db.query('UPDATE code_events SET timeline = $1 WHERE id = $2', [JSON.stringify(b.timeline.map((t) => ({ ...t, enteredBy: t.enteredBy || req.user.name || req.user.email }))), e.id]);
        return loadCe(db, req, e.id);
    });
    ok(res, ceOut(out));
}));

clinicalOpsRouter.put('/api/CodeEvent/:id/team', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            teamMembers: z.array(z.object({ userId: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200), role: z.enum(TEAM_ROLES), arrivedAt: isoTs })).max(60),
            teamLeadId: z.string().trim().max(100).optional(),
            teamLeadName: z.string().trim().max(200).optional(),
        }),
        req.body,
    );
    const out = await withTx(async (db) => {
        const e = await loadCe(db, req, req.params.id, true);
        if (e.status === 'closed') throw conflict('Code event is closed');
        await db.query(
            `UPDATE code_events SET team_members = $1, team_lead_id = COALESCE($2, team_lead_id), team_lead_name = COALESCE($3, team_lead_name) WHERE id = $4`,
            [JSON.stringify(b.teamMembers), b.teamLeadId ?? null, b.teamLeadName ?? null, e.id],
        );
        return loadCe(db, req, e.id);
    });
    ok(res, ceOut(out));
}));

clinicalOpsRouter.put('/api/CodeEvent/:id/close', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            endTime: isoTs,
            outcome: z.enum(OUTCOMES),
            postEventDisposition: z.enum(DISPOSITIONS),
            debriefNotes: z.string().trim().max(5000).default(''),
        }),
        req.body,
    );
    const out = await withTx(async (db) => {
        const e = await loadCe(db, req, req.params.id, true);
        if (e.status === 'closed') throw conflict('Code event is already closed');
        const end = new Date(b.endTime);
        if (end < e.called_at) throw badRequest('endTime cannot be before the event was called');
        // Duration is derived server-side rather than trusted from the client.
        const minutes = Math.round((end - e.called_at) / 60_000);
        await db.query(
            `UPDATE code_events SET status = 'closed', end_time = $1, outcome = $2, post_event_disposition = $3, debrief_notes = $4, total_duration_minutes = $5 WHERE id = $6`,
            [end, b.outcome, b.postEventDisposition, b.debriefNotes, minutes, e.id],
        );
        return loadCe(db, req, e.id);
    });
    ok(res, ceOut(out));
}));

clinicalOpsRouter.get('/api/CodeEvent/:id/generate-note', h(async (req, res) => {
    const e = ceOut(await loadCe({ query }, req, req.params.id));
    const lines = [
        `CODE EVENT DOCUMENTATION — ${e.eventType}`,
        `Patient: ${e.patientName} · MRN ${e.patientMrn ?? '—'}`,
        `Location: ${e.location}`,
        `Called: ${e.calledAt} by ${e.calledByName}`,
        `Team lead: ${e.teamLeadName || '—'}`,
        e.teamMembers.length ? `Team: ${e.teamMembers.map((m) => `${m.name} (${m.role})`).join(', ')}` : '',
        '',
        'Timeline:',
        ...[...e.timeline]
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .map((t) => `  ${t.timestamp} — ${t.entryType}${t.medication?.name ? ` (${t.medication.name} ${t.medication.dose} ${t.medication.route})` : ''}${t.joules != null ? ` · ${t.joules} J` : ''}${t.notes ? ` — ${t.notes}` : ''}`),
        '',
        e.status === 'closed'
            ? `Outcome: ${e.outcome ?? '—'} · Disposition: ${e.postEventDisposition ?? '—'} · Duration: ${e.totalDurationMinutes ?? '—'} min`
            : 'Event still active.',
        e.debriefNotes ? `\nDebrief:\n${e.debriefNotes}` : '',
    ];
    ok(res, { noteText: lines.join('\n').replace(/\n{3,}/g, '\n\n') });
}));
