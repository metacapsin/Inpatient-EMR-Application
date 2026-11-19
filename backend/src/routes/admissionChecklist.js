import { Router } from 'express';
import { query } from '../db/pool.js';
import { h, notFound, ok } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { medRecComplete } from '../lib/medRec.js';

/**
 * Admission checklist (Bucket C of the admission/discharge/beds module): computed from real data,
 * the same pattern as computeDischargeGates — never a manually self-checked list, since an unverified
 * checkbox is exactly the kind of false assurance this app has been removing elsewhere (e.g. the
 * flowsheet's old "break-glass enforced server-side" claim). Fall/Braden/pain risk screens are
 * deliberately left off: there's no real data behind them yet (they belong to the not-yet-built
 * Nursing documentation module), and a fake green check would be worse than no check at all.
 */
export const admissionChecklistRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

async function loadEncounter(req, encounterId) {
    const e = (await query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId])).rows[0];
    if (!e) throw notFound('Encounter not found');
    return e;
}

// GET /api/admissions/:encounterId/checklist
admissionChecklistRouter.get('/api/admissions/:encounterId/checklist', clinical, h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.encounterId);
    const allergyCount = (await query('SELECT COUNT(*)::int AS n FROM patient_allergies WHERE patient_id = $1 AND is_active', [enc.patient_id])).rows[0].n;
    const allergiesOk = allergyCount > 0 || Boolean(enc.allergies_reviewed_at);
    const medRecOk = await medRecComplete({ query }, enc.id, 'admission');
    const vitalsOk = Boolean(
        (await query('SELECT 1 FROM health_metrics WHERE patient_id = $1 AND recorded_at >= $2 LIMIT 1', [enc.patient_id, enc.admitted_at])).rowCount,
    );
    const consentOk = Boolean(
        (await query(`SELECT 1 FROM consents WHERE encounter_id = $1 AND status = 'Signed' LIMIT 1`, [enc.id])).rowCount,
    );
    const hpDeadline = new Date(new Date(enc.admitted_at).getTime() + 24 * 3600_000);
    const hpNote = (await query(`SELECT created_at FROM clinical_notes WHERE encounter_id = $1 AND note_type = 'hp' AND status = 'signed' ORDER BY created_at LIMIT 1`, [enc.id])).rows[0];
    const hpOk = Boolean(hpNote);
    const hpOverdue = !hpOk && Date.now() > hpDeadline.getTime();

    const items = [
        { id: 'allergies', label: 'Allergies reviewed', completed: allergiesOk, detail: allergyCount > 0 ? `${allergyCount} on file` : enc.allergies_reviewed_at ? 'Reviewed — no known allergies' : 'Not yet reviewed' },
        { id: 'med-rec', label: 'Admission medication reconciliation', completed: medRecOk },
        { id: 'vitals', label: 'Vitals recorded', completed: vitalsOk },
        { id: 'consent', label: 'Consent on file', completed: consentOk },
        { id: 'hp', label: 'History & physical documented', completed: hpOk, overdue: hpOverdue, deadline: hpDeadline.toISOString() },
    ];
    ok(res, {
        encounterId: enc.id,
        items,
        completedCount: items.filter((i) => i.completed).length,
        totalCount: items.length,
    });
}));

// POST /api/admissions/:encounterId/allergies-reviewed — attests "reviewed, no known allergies" when
// there's nothing to list (a patient legitimately having none wouldn't otherwise show as reviewed).
admissionChecklistRouter.post('/api/admissions/:encounterId/allergies-reviewed', clinical, h(async (req, res) => {
    const enc = await loadEncounter(req, req.params.encounterId);
    await query('UPDATE encounters SET allergies_reviewed_at = now(), allergies_reviewed_by = $1 WHERE id = $2', [req.user.id, enc.id]);
    ok(res, { encounterId: enc.id, allergiesReviewedAt: new Date().toISOString() });
}));
