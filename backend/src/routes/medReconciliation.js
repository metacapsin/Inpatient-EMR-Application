import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { medLineSchema, medLineOut } from '../lib/medLine.js';
import { keptLines } from '../lib/medRec.js';
import { ensureChecklist } from '../lib/dischargeGates.js';

/**
 * Medication reconciliation (#19): home-medication source + admission / transfer / discharge reconciliation.
 * Home meds reuse the `medications` table with source='home'. A reconciliation is a draft list of MedLines
 * each carrying an action (continue / modify / stop / new); completing an admission reconciliation creates
 * the inpatient active-medication rows, completing a discharge reconciliation writes the existing
 * `discharge_medications` document so DischargeMedsTab and the discharge-summary sign step keep working.
 */
export const medReconciliationRouter = Router();
const clinical = requireRole('physician', 'nurse', 'pharmacist');
const REC_TYPES = ['admission', 'transfer', 'discharge'];
const ACTIONS = ['continue', 'modify', 'stop', 'new'];
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

async function assertPatient(req, patientId) {
    const r = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
}

// ------------------------------------------------------------ home medications
const homeMedOut = (m) => ({
    id: m.id, _id: m.id, patientId: m.patient_id, name: m.name, dose: m.dose ?? '', route: m.route ?? '', frequency: m.frequency ?? '',
    instructions: m.instructions ?? '', rxnormCode: m.rxnorm_code ?? '', lastTakenAt: iso(m.last_taken_at), reportedBy: m.reported_by ?? '',
    source: m.source, isActive: m.is_active, createdAt: iso(m.created_at),
});
const homeMedBody = z.object({
    name: z.string().trim().min(1).max(200),
    dose: z.string().trim().max(100).optional().nullable(),
    route: z.string().trim().max(50).optional().nullable(),
    frequency: z.string().trim().max(100).optional().nullable(),
    instructions: z.string().trim().max(1000).optional().nullable(),
    rxnormCode: z.string().trim().max(20).optional().nullable(),
    lastTakenAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')),
    reportedBy: z.enum(['patient', 'family', 'pharmacy', 'PDMP', 'other']).optional().nullable(),
});

medReconciliationRouter.get('/api/patients/:patientId/home-medications', h(async (req, res) => {
    await assertPatient(req, req.params.patientId);
    const r = await query(`SELECT * FROM medications WHERE tenant_id = $1 AND patient_id = $2 AND source = 'home' AND is_active ORDER BY name`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(homeMedOut));
}));

medReconciliationRouter.post('/api/patients/:patientId/home-medications', clinical, h(async (req, res) => {
    const b = parse(homeMedBody, req.body);
    await assertPatient(req, req.params.patientId);
    const r = await query(
        `INSERT INTO medications (tenant_id, patient_id, name, dose, route, frequency, instructions, rxnorm_code, last_taken_at, reported_by, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'home') RETURNING *`,
        [req.user.tenantId, req.params.patientId, b.name, b.dose ?? null, b.route ?? null, b.frequency ?? null, b.instructions ?? null, b.rxnormCode ?? null, b.lastTakenAt || null, b.reportedBy ?? null],
    );
    created(res, homeMedOut(r.rows[0]));
}));

medReconciliationRouter.put('/api/patients/:patientId/home-medications/:id', clinical, h(async (req, res) => {
    const b = parse(homeMedBody.partial(), req.body);
    const r = await query(
        `UPDATE medications SET name = COALESCE($1, name), dose = COALESCE($2, dose), route = COALESCE($3, route), frequency = COALESCE($4, frequency),
                instructions = COALESCE($5, instructions), rxnorm_code = COALESCE($6, rxnorm_code), last_taken_at = COALESCE($7, last_taken_at), reported_by = COALESCE($8, reported_by)
         WHERE id = $9 AND patient_id = $10 AND tenant_id = $11 AND source = 'home' RETURNING *`,
        [b.name ?? null, b.dose ?? null, b.route ?? null, b.frequency ?? null, b.instructions ?? null, b.rxnormCode ?? null, b.lastTakenAt || null, b.reportedBy ?? null, req.params.id, req.params.patientId, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Home medication not found');
    ok(res, homeMedOut(r.rows[0]));
}));

medReconciliationRouter.delete('/api/patients/:patientId/home-medications/:id', clinical, h(async (req, res) => {
    const r = await query(`UPDATE medications SET is_active = false WHERE id = $1 AND patient_id = $2 AND tenant_id = $3 AND source = 'home'`, [req.params.id, req.params.patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Home medication not found');
    res.json({ status: 'success', message: 'Home medication removed' });
}));

// ------------------------------------------------------------ reconciliation
const recLine = medLineSchema.extend({
    id: z.string().optional(),
    action: z.enum(ACTIONS).optional().nullable(),
    reason: z.string().trim().max(500).optional().nullable(),
    originalMedicationId: z.string().optional().nullable(),
});
const lineOut = (l, i) => ({ id: l.id ?? `line-${i + 1}`, ...medLineOut(l), action: l.action ?? null, reason: l.reason ?? '', originalMedicationId: l.originalMedicationId ?? null });
const recOut = (r) => ({
    id: r.id, _id: r.id, encounterId: r.encounter_id, patientId: r.patient_id, type: r.type, status: r.status,
    lines: (r.lines ?? []).map(lineOut), completedBy: r.completed_by, completedByName: r.completed_by_name ?? null,
    completedAt: iso(r.completed_at), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const REC_SELECT = `SELECT r.*, e.patient_id, u.first_name || ' ' || u.last_name AS completed_by_name
                    FROM medication_reconciliations r JOIN encounters e ON e.id = r.encounter_id LEFT JOIN users u ON u.id = r.completed_by`;

async function loadEncounter(req, id) {
    const e = (await query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId])).rows[0];
    if (!e) throw notFound('Encounter not found');
    return e;
}

const medToLine = (m, source) => ({
    id: `${source}-${m.id}`, name: m.name, dose: m.dose ?? '', route: m.route ?? '', frequency: m.frequency ?? '', duration: '', instructions: m.instructions ?? '',
    rxnormCode: m.rxnorm_code ?? '', source, action: null, reason: '', originalMedicationId: m.id,
});

/** Proposed lines when a reconciliation is opened for the first time (plan §19). */
async function proposeLines(req, enc, type) {
    const home = (await query(`SELECT * FROM medications WHERE tenant_id = $1 AND patient_id = $2 AND source = 'home' AND is_active ORDER BY name`, [req.user.tenantId, enc.patient_id])).rows;
    const inpatient = (await query(`SELECT * FROM medications WHERE tenant_id = $1 AND patient_id = $2 AND source = 'inpatient' AND is_active ORDER BY name`, [req.user.tenantId, enc.patient_id])).rows;
    if (type === 'admission') return home.map((m) => medToLine(m, 'home'));
    if (type === 'transfer') return inpatient.map((m) => medToLine(m, 'inpatient'));
    const names = new Set(inpatient.map((m) => m.name.trim().toLowerCase()));
    return [...inpatient.map((m) => medToLine(m, 'inpatient')), ...home.filter((m) => !names.has(m.name.trim().toLowerCase())).map((m) => medToLine(m, 'home'))];
}

async function currentRec(req, encounterId, type) {
    const r = await query(`${REC_SELECT} WHERE r.encounter_id = $1 AND r.type = $2 AND r.tenant_id = $3 ORDER BY r.created_at DESC LIMIT 1`, [encounterId, type, req.user.tenantId]);
    return r.rows[0] ?? null;
}

// GET /api/encounters/:id/med-reconciliation  → status overview of all three types
medReconciliationRouter.get('/api/encounters/:id/med-reconciliation', h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.id);
    const r = await query(`${REC_SELECT} WHERE r.encounter_id = $1 AND r.tenant_id = $2 ORDER BY r.created_at DESC`, [enc.id, req.user.tenantId]);
    ok(res, r.rows.map(recOut));
}));

// GET /api/encounters/:id/med-reconciliation/:type → the current reconciliation, auto-built on first open
medReconciliationRouter.get('/api/encounters/:id/med-reconciliation/:type', h(async (req, res) => {
    const type = parse(z.enum(REC_TYPES), req.params.type);
    const enc = await loadEncounter(req, req.params.id);
    let rec = await currentRec(req, enc.id, type);
    if (!rec) {
        const lines = await proposeLines(req, enc, type);
        await query(`INSERT INTO medication_reconciliations (tenant_id, encounter_id, type, lines) VALUES ($1,$2,$3,$4)`, [req.user.tenantId, enc.id, type, JSON.stringify(lines)]);
        rec = await currentRec(req, enc.id, type);
    } else if (rec.status === 'draft' && (rec.lines ?? []).length === 0) {
        // An untouched empty draft is re-proposed, so home meds recorded after the first open still flow in.
        const lines = await proposeLines(req, enc, type);
        if (lines.length) {
            await query(`UPDATE medication_reconciliations SET lines = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(lines), rec.id]);
            rec = await currentRec(req, enc.id, type);
        }
    }
    ok(res, recOut(rec));
}));

// PUT /api/encounters/:id/med-reconciliation/:type → save lines (draft only)
medReconciliationRouter.put('/api/encounters/:id/med-reconciliation/:type', clinical, h(async (req, res) => {
    const type = parse(z.enum(REC_TYPES), req.params.type);
    const b = parse(z.object({ lines: z.array(recLine).max(200) }), req.body);
    const enc = await loadEncounter(req, req.params.id);
    let rec = await currentRec(req, enc.id, type);
    if (rec && rec.status === 'completed') {
        if (type !== 'transfer') throw conflict('This reconciliation is already completed');
        rec = null; // transfers may be reconciled again
    }
    const lines = b.lines.map((l, i) => ({ ...lineOut(l, i), source: l.source ?? null }));
    if (rec) {
        await query(`UPDATE medication_reconciliations SET lines = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(lines), rec.id]);
    } else {
        await query(`INSERT INTO medication_reconciliations (tenant_id, encounter_id, type, lines) VALUES ($1,$2,$3,$4)`, [req.user.tenantId, enc.id, type, JSON.stringify(lines)]);
    }
    ok(res, recOut(await currentRec(req, enc.id, type)));
}));

// POST /api/encounters/:id/med-reconciliation/:type/complete
medReconciliationRouter.post('/api/encounters/:id/med-reconciliation/:type/complete', clinical, h(async (req, res) => {
    const type = parse(z.enum(REC_TYPES), req.params.type);
    const b = parse(z.object({ lines: z.array(recLine).max(200).optional() }), req.body ?? {});
    const enc = await loadEncounter(req, req.params.id);
    if (enc.status === 'discharged') throw conflict('Encounter is already discharged');
    const out = await withTx(async (db) => {
        let rec = (await db.query(`SELECT * FROM medication_reconciliations WHERE encounter_id = $1 AND type = $2 AND tenant_id = $3 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [enc.id, type, req.user.tenantId])).rows[0];
        if (rec && rec.status === 'completed' && type !== 'transfer') throw conflict('This reconciliation is already completed');
        let lines = b.lines ? b.lines.map((l, i) => ({ ...lineOut(l, i), source: l.source ?? null })) : rec?.lines ?? [];
        if (!b.lines && rec?.status === 'completed') lines = [];
        const missing = lines.filter((l) => !l.action).map((l) => l.name);
        if (missing.length) throw badRequest(`Choose an action for every medication: ${missing.join(', ')}`, missing.map((m) => ({ path: 'lines', message: `${m}: action required` })));
        if (rec && rec.status !== 'completed') {
            await db.query(`UPDATE medication_reconciliations SET lines = $1, status = 'completed', completed_by = $2, completed_at = now(), updated_at = now() WHERE id = $3`, [JSON.stringify(lines), req.user.id, rec.id]);
        } else {
            rec = (await db.query(`INSERT INTO medication_reconciliations (tenant_id, encounter_id, type, lines, status, completed_by, completed_at) VALUES ($1,$2,$3,$4,'completed',$5,now()) RETURNING *`, [req.user.tenantId, enc.id, type, JSON.stringify(lines), req.user.id])).rows[0];
        }
        if (type === 'admission') {
            // continue / modify / new → inpatient active medication rows (the MAR source of truth)
            for (const l of lines) {
                if (l.action === 'stop') continue;
                await db.query(
                    `INSERT INTO medications (tenant_id, patient_id, encounter_id, name, dose, route, frequency, instructions, rxnorm_code, source)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inpatient')`,
                    [req.user.tenantId, enc.patient_id, enc.id, l.name, l.dose || null, l.route || null, l.frequency || null, l.instructions || null, l.rxnormCode || null],
                );
            }
            // Advisory-only CDS: never blocks nursing reconciliation; physician sees hard stops at order entry.
            try {
                const { checkInteractions, recordCdsAlerts } = await import('../lib/cds/check.js');
                const candidates = lines
                    .filter((l) => l.action !== 'stop')
                    .map((l) => ({ name: l.name, rxnormCode: l.rxnormCode || null }));
                if (candidates.length) {
                    const alerts = await checkInteractions(db, {
                        tenantId: req.user.tenantId,
                        patientId: enc.patient_id,
                        candidates,
                    });
                    if (alerts.length) {
                        await recordCdsAlerts(db, {
                            tenantId: req.user.tenantId,
                            patientId: enc.patient_id,
                            contextType: 'med_rec',
                            contextId: rec.id,
                            alerts,
                            outcome: 'advisory',
                            userId: req.user.id,
                        });
                    }
                }
            } catch (e) {
                // Table may not exist yet on old DBs; never fail reconciliation on CDS advisory.
                if (e?.code !== '42P01') console.warn('[med-rec] CDS advisory skipped:', e?.message || e);
            }
        }
        if (type === 'discharge') {
            const kept = keptLines(lines).map((l) => ({ name: l.name, dose: l.dose, route: l.route, frequency: l.frequency, duration: l.duration, instructions: l.instructions, rxnormCode: l.rxnormCode, source: l.source }));
            await db.query(
                `INSERT INTO discharge_medications (tenant_id, patient_id, encounter_id, medications, prepared_by, reviewed_by, counselling_done)
                 VALUES ($1,$2,$3,$4,$5,'',false)
                 ON CONFLICT (tenant_id, encounter_id) WHERE encounter_id IS NOT NULL
                 DO UPDATE SET medications = EXCLUDED.medications, prepared_by = COALESCE(NULLIF(discharge_medications.prepared_by,''), EXCLUDED.prepared_by), updated_at = now()`,
                [req.user.tenantId, enc.patient_id, enc.id, JSON.stringify(kept), req.user.name ?? ''],
            );
            // Stopped inpatient meds are discontinued; the nursing checklist item for med rec is satisfied.
            for (const l of lines) {
                if (l.action === 'stop' && l.originalMedicationId) await db.query(`UPDATE medications SET is_active = false WHERE id = $1 AND tenant_id = $2 AND source = 'inpatient'`, [l.originalMedicationId, req.user.tenantId]);
            }
            await ensureChecklist(db, req.user.tenantId, enc.id);
            await db.query(
                `UPDATE discharge_checklist_tasks SET completed = true, completed_by = $1, completed_at = now() WHERE encounter_id = $2 AND NOT completed AND label ILIKE '%medication reconciliation%'`,
                [req.user.id, enc.id],
            );
        }
        return rec.id;
    });
    const rec = (await query(`${REC_SELECT} WHERE r.id = $1`, [out])).rows[0];
    ok(res, recOut(rec));
}));
