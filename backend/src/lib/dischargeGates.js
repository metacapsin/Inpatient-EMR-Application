import { medRecComplete } from './medRec.js';

export const DEFAULT_CHECKLIST = [
    { label: 'Medication reconciliation completed', blocksDischarge: true, ownerRole: 'nursing' },
    { label: 'Patient / caregiver education documented', blocksDischarge: true, ownerRole: 'nursing' },
    { label: 'Durable medical equipment arranged (if applicable)', blocksDischarge: false, ownerRole: 'nursing' },
    { label: 'Follow-up appointments scheduled or given', blocksDischarge: true, ownerRole: 'nursing' },
    { label: 'Discharge instructions packet printed / given', blocksDischarge: true, ownerRole: 'nursing' },
];

/** Seeds the default nursing discharge checklist once per encounter (idempotent). Returns true when it seeded. */
export async function ensureChecklist(db, tenantId, encounterId) {
    const existing = await db.query('SELECT 1 FROM discharge_checklist_tasks WHERE encounter_id = $1 LIMIT 1', [encounterId]);
    if (existing.rowCount) return false;
    for (const [i, t] of DEFAULT_CHECKLIST.entries()) {
        await db.query(`INSERT INTO discharge_checklist_tasks (tenant_id, encounter_id, label, owner_role, blocks_discharge, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`, [tenantId, encounterId, t.label, t.ownerRole, t.blocksDischarge, i]);
    }
    return true;
}

/**
 * Server-side discharge gates (plan §2c). Hard gates block POST /api/discharges/confirm; the readiness endpoint
 * surfaces all of them. `db` is any object with .query (pool or tx client).
 */
export async function computeDischargeGates(db, tenantId, encounterId) {
    const enc = (await db.query('SELECT id, status FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, tenantId])).rows[0];
    const summary = (await db.query('SELECT status FROM discharge_summaries WHERE encounter_id = $1', [encounterId])).rows[0];
    const signed = summary?.status === 'signed';
    const medRec = await medRecComplete(db, encounterId, 'discharge');
    const openTasks = (await db.query(
        `SELECT label FROM discharge_checklist_tasks WHERE encounter_id = $1 AND blocks_discharge AND NOT completed ORDER BY sort_order`,
        [encounterId],
    )).rows.map((r) => r.label);
    const gates = [
        {
            id: 'gate-summary-signed', category: 'clinical', severity: 'hard', ownerRole: 'provider', resolved: signed,
            message: signed ? 'Discharge summary is signed' : 'Discharge summary must be signed by a provider',
        },
        {
            id: 'gate-med-reconciliation', category: 'clinical', severity: 'hard', ownerRole: 'nursing', resolved: medRec,
            message: medRec ? 'Discharge medication reconciliation is complete' : 'Discharge medication reconciliation must be completed',
        },
        {
            id: 'gate-nursing-checklist', category: 'operational', severity: openTasks.length ? 'hard' : 'soft', ownerRole: 'nursing', resolved: openTasks.length === 0,
            message: openTasks.length === 0 ? 'All required nursing discharge tasks are complete' : `Incomplete nursing tasks: ${openTasks.join('; ')}`,
        },
        {
            id: 'gate-encounter-status', category: 'operational', severity: 'hard', ownerRole: 'nursing', resolved: Boolean(enc) && enc.status !== 'discharged',
            message: !enc ? 'Encounter not found' : enc.status === 'discharged' ? 'Encounter is already discharged' : 'Encounter is active',
        },
    ];
    const blocking = gates.filter((g) => g.severity === 'hard' && !g.resolved);
    return { gates, blocking, blocked: blocking.length > 0, summarySigned: signed, medRecComplete: medRec, encounter: enc ?? null };
}
