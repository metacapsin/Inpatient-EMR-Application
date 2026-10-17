import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, forbidden, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const inpatientDocsRouter = Router();
const nursingOrMd = requireRole('physician', 'nurse');
const uuid = () => crypto.randomUUID();

/** An encounter id must belong to the caller's tenant before we write clinical data against it. */
async function assertEncounter(req, encounterId) {
    const r = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Encounter not found');
    return r.rows[0];
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const todayYmd = () => new Date().toISOString().slice(0, 10);

// ================================================================ Care plan
const GOAL_STATUSES = ['Not Met', 'Partially Met', 'Met'];
const DX_STATUSES = ['Active', 'Resolved', 'Discontinued'];

const goalSchema = z.object({
    id: z.string().optional(),
    statement: z.string().max(2000).default(''),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().or(z.literal('')),
    status: z.enum(GOAL_STATUSES).default('Not Met'),
    evaluationNote: z.string().max(2000).default(''),
});
const interventionSchema = z.object({
    id: z.string().optional(),
    text: z.string().max(2000).default(''),
    frequency: z.string().max(100).default('Daily'),
    responsibleDiscipline: z.string().max(50).default('RN'),
    status: z.enum(['Active', 'Discontinued']).default('Active'),
});
const diagnosisSchema = z.object({
    id: z.string().optional(),
    nandaCode: z.string().trim().min(1, 'Each diagnosis requires NANDA code and label'),
    nandaLabel: z.string().trim().min(1, 'Each diagnosis requires NANDA code and label'),
    relatedTo: z.string().max(1000).default(''),
    evidencedBy: z.string().max(1000).default(''),
    priority: z.string().max(20).default('Medium'),
    goals: z.array(goalSchema).default([]),
    interventions: z.array(interventionSchema).default([]),
    addedAt: z.string().optional(),
    addedBy: z.string().optional(),
    status: z.enum(DX_STATUSES).default('Active'),
});

function normalizeDiagnoses(list, fallbackName) {
    if (list.length === 0) throw badRequest('Cannot save empty diagnosis list');
    return list.map((d) => {
        for (const g of d.goals) {
            if (g.targetDate && g.targetDate.slice(0, 10) < todayYmd()) {
                // Allow unchanged historical goals; reject only newly-created (id-less) goals dated in the past.
                if (!g.id) throw badRequest('Goal target date cannot be in the past');
            }
        }
        return {
            ...d,
            id: d.id || uuid(),
            goals: d.goals.map((g) => ({ ...g, id: g.id || uuid(), targetDate: g.targetDate || todayYmd() })),
            interventions: d.interventions.map((i) => ({ ...i, id: i.id || uuid() })),
            addedAt: d.addedAt || new Date().toISOString(),
            addedBy: d.addedBy || fallbackName,
        };
    });
}

const planOut = (p) => ({
    id: p.id,
    _id: p.id,
    patientId: p.patient_id,
    encounterId: p.encounter_id,
    tenantId: p.tenant_id,
    diagnoses: p.diagnoses,
    interdisciplinaryNotes: p.interdisciplinary_notes,
    lastReviewedBy: p.last_reviewed_by,
    lastReviewedByName: p.last_reviewed_by_name,
    lastReviewedAt: iso(p.last_reviewed_at),
    version: p.version,
});

inpatientDocsRouter.get('/api/CarePlan/nanda/search', h(async (req, res) => {
    const term = String(req.query.q ?? '').trim().slice(0, 100);
    if (!term) return ok(res, []);
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const r = await query(
        `SELECT code, label, definition FROM nanda_diagnoses WHERE code ILIKE $1 OR label ILIKE $1 OR definition ILIKE $1 ORDER BY label LIMIT 25`,
        [like],
    );
    ok(res, r.rows);
}));

inpatientDocsRouter.post('/api/CarePlan/create', nursingOrMd, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            encounterId: z.string().min(1),
            diagnoses: z.array(diagnosisSchema),
            interdisciplinaryNotes: z.string().max(10000).default(''),
        }),
        req.body,
    );
    const enc = await assertEncounter(req, b.encounterId);
    if (enc.patient_id !== b.patientId) throw badRequest('patientId does not match the encounter');
    const dx = normalizeDiagnoses(b.diagnoses, req.user.name);
    const r = await query(
        `INSERT INTO care_plans (tenant_id, patient_id, encounter_id, diagnoses, interdisciplinary_notes,
                                 last_reviewed_by, last_reviewed_by_name, last_reviewed_at, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),1)
         ON CONFLICT (tenant_id, encounter_id) DO NOTHING RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId, JSON.stringify(dx), b.interdisciplinaryNotes, req.user.id, req.user.name],
    );
    if (!r.rowCount) throw conflict('Care plan already exists for this encounter');
    created(res, planOut(r.rows[0]));
}));

inpatientDocsRouter.get('/api/CarePlan/:encounterId', h(async (req, res) => {
    const r = await query('SELECT * FROM care_plans WHERE tenant_id = $1 AND encounter_id = $2', [req.user.tenantId, req.params.encounterId]);
    if (r.rowCount) return ok(res, planOut(r.rows[0]));
    // No plan yet: version 0 tells the UI to create rather than update.
    ok(res, { id: '', patientId: '', encounterId: req.params.encounterId, tenantId: req.user.tenantId, diagnoses: [], interdisciplinaryNotes: '', lastReviewedBy: '', lastReviewedByName: '', lastReviewedAt: null, version: 0 });
}));

inpatientDocsRouter.put('/api/CarePlan/:planId/goalStatus', nursingOrMd, h(async (req, res) => {
    const b = parse(
        z.object({ diagnosisId: z.string().min(1), goalId: z.string().min(1), status: z.enum(GOAL_STATUSES), evaluationNote: z.string().max(2000).optional() }),
        req.body,
    );
    const out = await withTx(async (db) => {
        const p = (await db.query('SELECT * FROM care_plans WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.planId, req.user.tenantId])).rows[0];
        if (!p) throw notFound('Care plan not found');
        const dx = p.diagnoses.find((d) => d.id === b.diagnosisId);
        if (!dx) throw notFound('Diagnosis not found');
        const goal = dx.goals.find((g) => g.id === b.goalId);
        if (!goal) throw notFound('Goal not found');
        goal.status = b.status;
        if (b.evaluationNote !== undefined) goal.evaluationNote = b.evaluationNote;
        return (
            await db.query(
                `UPDATE care_plans SET diagnoses = $1, last_reviewed_by = $2, last_reviewed_by_name = $3, last_reviewed_at = now(),
                        version = version + 1, updated_at = now() WHERE id = $4 RETURNING *`,
                [JSON.stringify(p.diagnoses), req.user.id, req.user.name, p.id],
            )
        ).rows[0];
    });
    ok(res, planOut(out));
}));

inpatientDocsRouter.put('/api/CarePlan/:planId', nursingOrMd, h(async (req, res) => {
    const b = parse(
        z.object({
            encounterId: z.string().optional(),
            diagnoses: z.array(diagnosisSchema).optional(),
            interdisciplinaryNotes: z.string().max(10000).optional(),
        }),
        req.body,
    );
    const out = await withTx(async (db) => {
        const p = (await db.query('SELECT * FROM care_plans WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.planId, req.user.tenantId])).rows[0];
        if (!p) throw notFound('Care plan not found');
        if (b.encounterId && b.encounterId !== p.encounter_id) throw forbidden('Encounter ownership mismatch');
        const dx = b.diagnoses ? normalizeDiagnoses(b.diagnoses, p.last_reviewed_by_name || req.user.name) : p.diagnoses;
        return (
            await db.query(
                `UPDATE care_plans SET diagnoses = $1, interdisciplinary_notes = $2, last_reviewed_by = $3, last_reviewed_by_name = $4,
                        last_reviewed_at = now(), version = version + 1, updated_at = now() WHERE id = $5 RETURNING *`,
                [JSON.stringify(dx), b.interdisciplinaryNotes ?? p.interdisciplinary_notes, req.user.id, req.user.name, p.id],
            )
        ).rows[0];
    });
    ok(res, planOut(out));
}));

// ================================================================ Intake / Output
const ioBase = {
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    volumeMl: z.coerce.number().min(0).max(20000),
    recordedAt: z.string().datetime({ offset: true }).or(z.string().datetime({ local: true })),
    shift: z.string().max(20).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
};
const ioSchema = z.discriminatedUnion('recordType', [
    z.object({
        ...ioBase,
        recordType: z.literal('Intake'),
        intakeCategory: z.string().trim().min(1).max(100),
        fluidType: z.string().trim().max(100).optional().nullable(),
        ratePerHour: z.coerce.number().min(0).optional().nullable(),
        bagVolumeRemaining: z.coerce.number().min(0).optional().nullable(),
    }),
    z.object({
        ...ioBase,
        recordType: z.literal('Output'),
        outputCategory: z.string().trim().min(1).max(100),
        colorConsistency: z.string().max(200).optional().nullable(),
        device: z.string().max(100).optional().nullable(),
    }),
]);

const ioOut = (r) => ({
    id: r.id,
    _id: r.id,
    patientId: r.patient_id,
    encounterId: r.encounter_id,
    tenantId: r.tenant_id,
    recordType: r.record_type,
    intakeCategory: r.intake_category,
    fluidType: r.fluid_type,
    ratePerHour: r.rate_per_hour,
    bagVolumeRemaining: r.bag_volume_remaining,
    outputCategory: r.output_category,
    colorConsistency: r.color_consistency,
    device: r.device,
    volumeMl: r.volume_ml,
    recordedAt: iso(r.recorded_at),
    shift: r.shift,
    notes: r.notes,
    recordedBy: r.recorded_by,
    recordedByName: r.recorded_by_name,
});

inpatientDocsRouter.post('/api/IORecord/add', nursingOrMd, h(async (req, res) => {
    const b = parse(ioSchema, req.body);
    const enc = await assertEncounter(req, b.encounterId);
    if (enc.patient_id !== b.patientId) throw badRequest('patientId does not match the encounter');
    const r = await query(
        `INSERT INTO io_records (tenant_id, patient_id, encounter_id, record_type, intake_category, fluid_type, rate_per_hour, bag_volume_remaining,
                                 output_category, color_consistency, device, volume_ml, recorded_at, shift, notes, recorded_by, recorded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId, b.recordType, b.intakeCategory ?? null, b.fluidType ?? null, b.ratePerHour ?? null, b.bagVolumeRemaining ?? null,
         b.outputCategory ?? null, b.colorConsistency ?? null, b.device ?? null, b.volumeMl, b.recordedAt, b.shift ?? null, b.notes ?? null, req.user.id, req.user.name],
    );
    created(res, ioOut(r.rows[0]));
}));

inpatientDocsRouter.get('/api/IORecord/balance/:encounterId', h(async (req, res) => {
    const r = await query(
        `SELECT
           COALESCE(sum(volume_ml) FILTER (WHERE record_type='Intake' AND recorded_at >= now() - interval '8 hours'),0) AS intake8,
           COALESCE(sum(volume_ml) FILTER (WHERE record_type='Output' AND recorded_at >= now() - interval '8 hours'),0) AS output8,
           COALESCE(sum(volume_ml) FILTER (WHERE record_type='Intake' AND recorded_at >= now() - interval '24 hours'),0) AS intake24,
           COALESCE(sum(volume_ml) FILTER (WHERE record_type='Output' AND recorded_at >= now() - interval '24 hours'),0) AS output24,
           COALESCE(sum(volume_ml) FILTER (WHERE record_type='Output' AND output_category='Urine' AND recorded_at >= now() - interval '1 hour'),0) AS urine1
         FROM io_records WHERE tenant_id = $1 AND encounter_id = $2 AND recorded_at <= now() + interval '5 minutes'`,
        [req.user.tenantId, req.params.encounterId],
    );
    const x = r.rows[0];
    ok(res, {
        intake8hMl: x.intake8, output8hMl: x.output8, balance8hMl: x.intake8 - x.output8,
        intake24hMl: x.intake24, output24hMl: x.output24, balance24hMl: x.intake24 - x.output24,
        urineOutputLastHourMl: x.urine1,
    });
}));

inpatientDocsRouter.get('/api/IORecord/timeline/:encounterId', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM io_records WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY recorded_at DESC LIMIT 500`,
        [req.user.tenantId, req.params.encounterId],
    );
    ok(res, r.rows.map(ioOut));
}));

// ================================================================ Nursing flowsheet
const flowsheetSchema = z
    .object({
        patientId: z.string().min(1),
        encounterId: z.string().min(1),
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'shiftDate must be YYYY-MM-DD'),
        shiftType: z.string().trim().min(1).max(30),
        signedBy: z.string().nullable().optional(),
        signedByName: z.string().nullable().optional(),
        signedAt: z.string().nullable().optional(),
    })
    .passthrough();

const SECTION_KEYS = ['neurological', 'cardiovascular', 'respiratory', 'gastrointestinal', 'genitourinary', 'integumentary', 'ivAccess', 'pain', 'musculoskeletal', 'psychosocial'];

function flowsheetOut(f) {
    return {
        ...f.data,
        id: f.id,
        patientId: f.patient_id,
        encounterId: f.encounter_id,
        tenantId: f.tenant_id,
        shiftDate: f.shift_date,
        shiftType: f.shift_type,
        chartStatus: f.chart_status,
        version: f.version,
        updatedAtIso: iso(f.updated_at),
        createdAtIso: iso(f.created_at),
    };
}

inpatientDocsRouter.post('/api/NursingFlowsheet/save', nursingOrMd, h(async (req, res) => {
    const body = parse(flowsheetSchema, req.body);
    const enc = await assertEncounter(req, body.encounterId);
    if (enc.patient_id !== body.patientId) throw badRequest('patientId does not match the encounter');
    const date = body.shiftDate.slice(0, 10);
    const data = {};
    for (const k of [...SECTION_KEYS, 'signedBy', 'signedByName', 'signerCredentials', 'signedAt', 'isAmended', 'amendedBy', 'amendedAt', 'amendmentReason']) {
        if (body[k] !== undefined) data[k] = body[k];
    }
    const signed = Boolean(body.signedAt);
    const status = signed ? (body.isAmended ? 'amended' : 'signed') : 'draft';
    const out = await withTx(async (db) => {
        const existing = (
            await db.query(
                `SELECT * FROM nursing_flowsheets WHERE tenant_id=$1 AND encounter_id=$2 AND shift_date=$3 AND shift_type=$4 FOR UPDATE`,
                [req.user.tenantId, body.encounterId, date, body.shiftType],
            )
        ).rows[0];
        if (existing?.chart_status === 'signed' && !body.isAmended) throw conflict('This flowsheet is signed; submit an amendment with a reason');
        if (body.isAmended && !body.amendmentReason) throw badRequest('amendmentReason is required for amendments');
        let f;
        if (existing) {
            f = (
                await db.query(
                    `UPDATE nursing_flowsheets SET data = $1, chart_status = $2, version = version + 1, updated_at = now() WHERE id = $3 RETURNING *`,
                    [JSON.stringify(data), status, existing.id],
                )
            ).rows[0];
        } else {
            f = (
                await db.query(
                    `INSERT INTO nursing_flowsheets (tenant_id, patient_id, encounter_id, shift_date, shift_type, chart_status, data)
                     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                    [req.user.tenantId, body.patientId, body.encounterId, date, body.shiftType, status, JSON.stringify(data)],
                )
            ).rows[0];
        }
        await db.query(
            `INSERT INTO nursing_flowsheet_versions (flowsheet_id, version, status, saved_by_name, summary) VALUES ($1,$2,$3,$4,$5)`,
            [f.id, f.version, status, req.user.name, body.isAmended ? `Amended: ${body.amendmentReason}` : signed ? 'Signed' : 'Draft saved'],
        );
        return f;
    });
    ok(res, flowsheetOut(out));
}));

inpatientDocsRouter.get('/api/NursingFlowsheet/history/:encounterId', h(async (req, res) => {
    const r = await query(
        `SELECT v.* FROM nursing_flowsheet_versions v JOIN nursing_flowsheets f ON f.id = v.flowsheet_id
         WHERE f.tenant_id = $1 AND f.encounter_id = $2 AND v.saved_at >= now() - interval '7 days' ORDER BY v.saved_at DESC LIMIT 200`,
        [req.user.tenantId, req.params.encounterId],
    );
    res.json(
        r.rows.map((v) => ({ id: v.id, version: v.version, status: v.status, savedAtIso: iso(v.saved_at), savedByDisplay: v.saved_by_name, summary: v.summary })),
    );
}));

// Most recent flowsheet for the encounter ("current shift"). 404 when none, which the UI treats as "start a new one".
inpatientDocsRouter.get('/api/NursingFlowsheet/:encounterId', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM nursing_flowsheets WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY shift_date DESC, updated_at DESC LIMIT 1`,
        [req.user.tenantId, req.params.encounterId],
    );
    if (!r.rowCount) throw notFound('No flowsheet for this encounter');
    res.json(flowsheetOut(r.rows[0]));
}));

// ================================================================ HAI events
const haiOut = (e) => ({ id: e.id, encounterId: e.encounter_id, unitId: e.unit_id, eventType: e.event_type, occurredAt: iso(e.occurred_at), ...e.data });

inpatientDocsRouter.get('/api/HAIEvent/encounter/:encounterId', h(async (req, res) => {
    const r = await query(`SELECT * FROM hai_events WHERE tenant_id=$1 AND encounter_id=$2 ORDER BY occurred_at DESC LIMIT 500`, [req.user.tenantId, req.params.encounterId]);
    ok(res, r.rows.map(haiOut));
}));

inpatientDocsRouter.post('/api/HAIEvent', requireRole('physician', 'nurse'), h(async (req, res) => {
    const { encounterId, unitId, eventType, occurredAt, ...rest } = parse(
        z.object({
            encounterId: z.string().min(1),
            unitId: z.string().optional(),
            eventType: z.enum(['infection_detected', 'isolation_started', 'severity_updated', 'status_changed', 'infection_resolved']),
            occurredAt: z.string().datetime({ offset: true }).optional(),
            title: z.string().max(200).optional(),
            description: z.string().max(2000).optional(),
            infectionType: z.string().max(100).optional(),
            severity: z.string().max(30).optional(),
            status: z.string().max(30).optional(),
            isolationType: z.string().max(100).optional(),
            patientId: z.string().optional(),
        }),
        req.body,
    );
    await assertEncounter(req, encounterId);
    const r = await query(
        `INSERT INTO hai_events (tenant_id, encounter_id, unit_id, event_type, occurred_at, data) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now()),$6) RETURNING *`,
        [req.user.tenantId, encounterId, unitId ?? null, eventType, occurredAt ?? null, JSON.stringify({ ...rest, recordedBy: req.user.name })],
    );
    created(res, haiOut(r.rows[0]));
}));

// Unit summary derived from the event log: latest event per (encounter, infectionType) decides if it is still active.
inpatientDocsRouter.get('/api/HAIEvent/summary/:unitId', h(async (req, res) => {
    const events = (
        await query(`SELECT * FROM hai_events WHERE tenant_id=$1 AND unit_id=$2 ORDER BY occurred_at`, [req.user.tenantId, req.params.unitId])
    ).rows.map(haiOut);
    const latest = new Map();
    for (const e of events) latest.set(`${e.encounterId}|${e.infectionType ?? ''}`, e);
    const states = [...latest.values()];
    const active = states.filter((e) => e.eventType !== 'infection_resolved');
    const byType = new Map();
    for (const e of active) byType.set(e.infectionType || 'Unspecified', (byType.get(e.infectionType || 'Unspecified') ?? 0) + 1);
    const ward = (await query('SELECT name FROM wards WHERE id = $1 AND tenant_id = $2', [req.params.unitId, req.user.tenantId])).rows[0];
    ok(res, {
        unitId: req.params.unitId,
        unitName: ward?.name ?? 'Unit',
        asOf: new Date().toISOString(),
        totalActiveInfections: active.length,
        isolationPatients: new Set(events.filter((e) => e.eventType === 'isolation_started').map((e) => e.encounterId)).size,
        resolvedCases: states.length - active.length,
        highSeverityCases: active.filter((e) => ['high', 'critical', 'severe'].includes(String(e.severity ?? '').toLowerCase())).length,
        activeByType: [...byType].map(([infectionType, count]) => ({ infectionType, count })),
        recentEvents: events.slice(-10).reverse(),
    });
}));

