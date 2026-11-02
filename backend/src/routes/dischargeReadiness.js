import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { ApiError, conflict, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { computeDischargeGates, ensureChecklist } from '../lib/dischargeGates.js';
import { completedRecLines, keptLines } from '../lib/medRec.js';
import { medLineText } from '../lib/medLine.js';
import { historyByPatient, runForPatient } from '../lib/eligibility.js';
import { loadPatientOut } from './patients.js';

/**
 * Discharge summary + nursing checklist + readiness hub (#13). Implements the REST contract that
 * `services/dischargeReadiness.service.ts` documented in its header. Charges / claim-prep stay client-side
 * (VITE_CHARGE_CAPTURE_MOCK) until charge capture (#39) lands: those sections are returned as `null` with
 * `sections.<name>.available=false`.
 */
export const dischargeReadinessRouter = Router();
const physician = requireRole('physician');
const nursing = requireRole('physician', 'nurse');
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

async function loadEncounter(req, id) {
    const e = (await query(
        `SELECT e.*, p.first_name, p.last_name, p.mrn, b.label AS bed_label, r.room_number, w.name AS ward_name,
                u.first_name || ' ' || u.last_name AS attending_name
         FROM encounters e JOIN patients p ON p.id = e.patient_id
         LEFT JOIN beds b ON b.id = e.bed_id LEFT JOIN rooms r ON r.id = b.room_id LEFT JOIN wards w ON w.id = r.ward_id
         LEFT JOIN users u ON u.id = e.attending_physician_id
         WHERE e.id = $1 AND e.tenant_id = $2`,
        [id, req.user.tenantId],
    )).rows[0];
    if (!e) throw notFound('Encounter not found');
    return e;
}

const summaryOut = (s) => ({
    status: s?.status ?? 'draft',
    admissionDiagnosis: s?.admission_diagnosis ?? '',
    hospitalCourse: s?.hospital_course ?? '',
    procedures: s?.procedures ?? '',
    finalDiagnoses: s?.final_diagnoses ?? '',
    disposition: s?.disposition ?? 'Home',
    conditionAtDischarge: s?.condition_at_discharge ?? '',
    dischargeMedications: s?.discharge_medications_text ?? '',
    dischargeMedicationLines: s?.discharge_medications ?? [],
    followUpInstructions: s?.follow_up_instructions ?? '',
    signedAt: iso(s?.signed_at),
    signedBy: s?.signed_by ?? null,
    signedByName: s?.signed_by_name ?? null,
    updatedAt: iso(s?.updated_at),
});
const taskOut = (t) => ({ id: t.id, label: t.label, completed: t.completed, blocksDischarge: t.blocks_discharge, notes: t.notes ?? '', ownerRole: t.owner_role, completedAt: iso(t.completed_at), completedBy: t.completed_by });

/** 271 history rows → the EligibilityRecord shape the Insurance tab renders. */
const eligibilityOut = (c) => ({
    id: c.id,
    requestedAt: iso(c.checkedAt),
    expiresAt: null,
    status: ['active', 'inactive', 'error'].includes(c.status) ? c.status : 'unknown',
    displaySummary: c.error || c.coverageSummary || c.summaryText || (c.status === 'active' ? `Active coverage — ${c.payerName ?? 'payer'}` : c.status === 'skipped' ? 'Eligibility check skipped (payer connection not configured)' : `Status: ${c.status}`),
    planName: c.planName ?? c.payerName ?? null,
    memberId: c.subscriberId ?? null,
    copayNote: c.copay ?? c.copayNote ?? null,
    deductibleNote: c.deductible ?? c.deductibleNote ?? null,
    priorAuthRequired: c.priorAuthRequired ?? null,
    errorCode: c.errorCode ?? (c.status === 'error' ? 'ELIGIBILITY_ERROR' : null),
});

async function buildView(req, enc) {
    await ensureChecklist({ query }, req.user.tenantId, enc.id);
    const summary = (await query('SELECT * FROM discharge_summaries WHERE encounter_id = $1', [enc.id])).rows[0];
    const tasks = (await query('SELECT * FROM discharge_checklist_tasks WHERE encounter_id = $1 ORDER BY sort_order', [enc.id])).rows;
    const gates = await computeDischargeGates({ query }, req.user.tenantId, enc.id);
    const elig = await historyByPatient(req.user.tenantId, enc.patient_id, 10);
    return {
        context: {
            encounterId: enc.id,
            patientId: enc.patient_id,
            patientName: `${enc.first_name} ${enc.last_name}`,
            mrn: enc.mrn,
            admitDate: iso(enc.admitted_at),
            locationLabel: [enc.ward_name, enc.room_number, enc.bed_label].filter(Boolean).join(' / ') || '—',
            attendingName: enc.attending_name ?? '—',
            encounterStatus: enc.status,
            dischargeSigned: summary?.status === 'signed',
            disposition: enc.disposition ?? summary?.disposition ?? null,
        },
        summary: summaryOut(summary),
        checklist: tasks.map(taskOut),
        eligibilityHistory: elig.map(eligibilityOut),
        charges: null,
        claimPrep: null,
        sections: { charges: { available: false, reason: 'Charge capture (#39) not built yet' }, claimPrep: { available: false, reason: 'Charge capture (#39) not built yet' }, eligibility: { available: true } },
        gates: gates.gates,
        clinicalReady: !gates.blocked,
        medRecComplete: gates.medRecComplete,
    };
}

// GET /api/encounters/:id/discharge-readiness
dischargeReadinessRouter.get('/api/encounters/:id/discharge-readiness', h(async (req, res) => {
    ok(res, await buildView(req, await loadEncounter(req, req.params.id)));
}));

// GET /api/discharges/readiness/:id — the flags the finalize flow polls (dischargeFinalizeReadiness.service.ts)
dischargeReadinessRouter.get('/api/discharges/readiness/:id', h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.id);
    const g = await computeDischargeGates({ query }, req.user.tenantId, enc.id);
    const elig = await historyByPatient(req.user.tenantId, enc.patient_id, 1);
    ok(res, {
        dischargeSummaryCompleted: g.summarySigned,
        medicationCompleted: g.medRecComplete,
        insuranceVerified: elig[0]?.status === 'active',
        checklistCompleted: !g.gates.find((x) => x.id === 'gate-nursing-checklist' && !x.resolved),
        blocked: g.blocked,
        gates: g.gates,
    });
}));

const summaryBody = z.object({
    admissionDiagnosis: z.string().max(5000).optional().nullable(),
    hospitalCourse: z.string().max(20000).optional().nullable(),
    procedures: z.string().max(5000).optional().nullable(),
    finalDiagnoses: z.string().max(5000).optional().nullable(),
    disposition: z.string().max(200).optional().nullable(),
    conditionAtDischarge: z.string().max(500).optional().nullable(),
    dischargeMedications: z.string().max(10000).optional().nullable(),
    followUpInstructions: z.string().max(10000).optional().nullable(),
});

// PUT /api/encounters/:id/discharge-summary — upsert, draft only
dischargeReadinessRouter.put('/api/encounters/:id/discharge-summary', physician, h(async (req, res) => {
    const b = parse(summaryBody, req.body);
    const enc = await loadEncounter(req, req.params.id);
    const existing = (await query('SELECT status FROM discharge_summaries WHERE encounter_id = $1', [enc.id])).rows[0];
    if (existing?.status === 'signed') throw conflict('Signed discharge summary cannot be edited');
    const v = (k) => (b[k] === undefined ? null : b[k]);
    await query(
        `INSERT INTO discharge_summaries (tenant_id, encounter_id, admission_diagnosis, hospital_course, procedures, final_diagnoses, disposition, condition_at_discharge, discharge_medications_text, follow_up_instructions, author_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (encounter_id) DO UPDATE SET
            admission_diagnosis = COALESCE($3, discharge_summaries.admission_diagnosis), hospital_course = COALESCE($4, discharge_summaries.hospital_course),
            procedures = COALESCE($5, discharge_summaries.procedures), final_diagnoses = COALESCE($6, discharge_summaries.final_diagnoses),
            disposition = COALESCE($7, discharge_summaries.disposition), condition_at_discharge = COALESCE($8, discharge_summaries.condition_at_discharge),
            discharge_medications_text = COALESCE($9, discharge_summaries.discharge_medications_text), follow_up_instructions = COALESCE($10, discharge_summaries.follow_up_instructions),
            updated_at = now()`,
        [req.user.tenantId, enc.id, v('admissionDiagnosis'), v('hospitalCourse'), v('procedures'), v('finalDiagnoses'), v('disposition'), v('conditionAtDischarge'), v('dischargeMedications'), v('followUpInstructions'), req.user.id],
    );
    ok(res, await buildView(req, enc));
}));

// POST /api/encounters/:id/discharge-summary/sign
dischargeReadinessRouter.post('/api/encounters/:id/discharge-summary/sign', physician, h(async (req, res) => {
    const b = parse(z.object({ signedByName: z.string().trim().max(200).optional() }).passthrough(), req.body ?? {});
    const enc = await loadEncounter(req, req.params.id);
    await withTx(async (db) => {
        const s = (await db.query('SELECT * FROM discharge_summaries WHERE encounter_id = $1 FOR UPDATE', [enc.id])).rows[0];
        if (!s) throw new ApiError(400, 'Save the discharge summary before signing');
        if (s.status === 'signed') throw conflict('Discharge summary is already signed');
        const missing = [['admission_diagnosis', 'Admission diagnosis'], ['hospital_course', 'Hospital course'], ['final_diagnoses', 'Final diagnoses'], ['follow_up_instructions', 'Follow-up instructions']]
            .filter(([col]) => !String(s[col] ?? '').trim()).map(([, label]) => label);
        if (missing.length) throw new ApiError(400, `Complete required sections before signing: ${missing.join(', ')}`);
        if (!/\b[A-Z][0-9]{2}(\.[0-9A-Z]+)*\b/.test(String(s.final_diagnoses).toUpperCase())) throw new ApiError(400, 'Final diagnoses must include at least one ICD-10-CM code (e.g. J18.9)');
        const lines = await completedRecLines(db, enc.id, 'discharge');
        const recDone = (await db.query(`SELECT 1 FROM medication_reconciliations WHERE encounter_id = $1 AND type = 'discharge' AND status = 'completed'`, [enc.id])).rowCount > 0;
        if (!recDone) throw new ApiError(409, 'Complete the discharge medication reconciliation before signing the discharge summary', undefined, 'MED_REC_INCOMPLETE');
        const kept = keptLines(lines);
        const medsText = String(s.discharge_medications_text ?? '').trim() || kept.map(medLineText).join('\n');
        const signedByName = b.signedByName?.trim() || req.user.name || null;
        await db.query(
            `UPDATE discharge_summaries SET status = 'signed', signed_at = now(), signed_by = $1, signed_by_name = $2, discharge_medications = $3, discharge_medications_text = $4, updated_at = now() WHERE id = $5`,
            [req.user.id, signedByName, JSON.stringify(kept), medsText, s.id],
        );
        // Plain-text rollup keeps existing consumers (ADT discharge payload, future C-CDA) working.
        const rollup = [
            `DISCHARGE SUMMARY — signed by ${signedByName ?? req.user.id} on ${new Date().toISOString()}`,
            `Admission diagnosis: ${s.admission_diagnosis}`,
            `Hospital course: ${s.hospital_course}`,
            s.procedures ? `Procedures: ${s.procedures}` : null,
            `Final diagnoses: ${s.final_diagnoses}`,
            `Disposition: ${s.disposition ?? ''}`,
            s.condition_at_discharge ? `Condition at discharge: ${s.condition_at_discharge}` : null,
            `Discharge medications:\n${medsText}`,
            `Follow-up: ${s.follow_up_instructions}`,
        ].filter(Boolean).join('\n');
        await db.query(`UPDATE encounters SET discharge_summary = $1, disposition = COALESCE(disposition, $2) WHERE id = $3`, [rollup, s.disposition ?? null, enc.id]);
    });
    ok(res, await buildView(req, enc));
}));

// PATCH /api/encounters/:id/discharge-checklist/tasks/:taskId
dischargeReadinessRouter.patch('/api/encounters/:id/discharge-checklist/tasks/:taskId', nursing, h(async (req, res) => {
    const b = parse(z.object({ completed: z.boolean().optional(), notes: z.string().max(2000).optional() }), req.body);
    const enc = await loadEncounter(req, req.params.id);
    const r = await query(
        `UPDATE discharge_checklist_tasks SET completed = COALESCE($1, completed), notes = COALESCE($2, notes),
                completed_by = CASE WHEN $1 = true THEN $3 WHEN $1 = false THEN NULL ELSE completed_by END,
                completed_at = CASE WHEN $1 = true THEN now() WHEN $1 = false THEN NULL ELSE completed_at END
         WHERE id = $4 AND encounter_id = $5 AND tenant_id = $6`,
        [b.completed ?? null, b.notes ?? null, req.user.id, req.params.taskId, enc.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Checklist task not found');
    ok(res, await buildView(req, enc));
}));

// POST /api/encounters/:id/discharge-checklist/seed — idempotent default task list
dischargeReadinessRouter.post('/api/encounters/:id/discharge-checklist/seed', nursing, h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.id);
    const seeded = await ensureChecklist({ query }, req.user.tenantId, enc.id);
    ok(res, { seeded, ...(await buildView(req, enc)) });
}));

// POST /api/encounters/:id/eligibility — re-run 270/271 for the encounter's patient and refresh history
dischargeReadinessRouter.post('/api/encounters/:id/eligibility', requireRole('billing', 'staff', 'nurse', 'physician'), h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.id);
    const patient = await loadPatientOut(req.user.tenantId, enc.patient_id);
    if (!patient) throw notFound('Patient not found');
    try {
        await runForPatient({ patient, tenantId: req.user.tenantId, userId: req.user.id });
    } catch (e) {
        throw new ApiError(502, `Eligibility check failed: ${e.message}`);
    }
    ok(res, await buildView(req, enc));
}));
