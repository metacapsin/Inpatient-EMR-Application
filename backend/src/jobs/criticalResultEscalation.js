import { boss, QUEUES } from '../db/queue.js';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { resolveChargeNurse } from '../lib/criticalNotify.js';

/**
 * SAF-06: a critical lab result that nobody has acknowledged within
 * `config.criticalResultEscalationMinutes` gets escalated to the ward's charge nurse — once per
 * result (`escalated_at` marks it so a re-run doesn't double-notify). Runs every 5 minutes; the
 * window itself only needs minute-ish precision, so this doesn't need to be a cron-exact job.
 */
export async function sweepUnacknowledgedCriticals() {
    const due = await query(
        `SELECT lr.*, lo.encounter_id FROM lab_results lr JOIN lab_orders lo ON lo.id = lr.lab_order_id
         WHERE lr.is_critical AND lr.acknowledged_at IS NULL AND lr.escalated_at IS NULL
           AND lr.resulted_at < now() - ($1 || ' minutes')::interval`,
        [config.criticalResultEscalationMinutes],
    );
    let escalated = 0;
    for (const r of due.rows) {
        const chargeNurseId = await resolveChargeNurse({ tenantId: r.tenant_id, patientId: r.patient_id });
        const p = (await query('SELECT first_name, last_name, mrn FROM patients WHERE id = $1', [r.patient_id])).rows[0];
        const who = p ? `${p.first_name} ${p.last_name} (${p.mrn})` : 'Patient';
        const msg = `ESCALATED — unacknowledged ${config.criticalResultEscalationMinutes}+ min: CRITICAL ${r.test_name} for ${who}`;
        const metadata = JSON.stringify({ labOrderId: r.lab_order_id, labResultId: r.id, patientId: r.patient_id });
        if (chargeNurseId) {
            await query(
                `INSERT INTO notifications (tenant_id, user_id, type, action, message, metadata) VALUES ($1,$2,'lab','critical_result_escalated',$3,$4::jsonb)`,
                [r.tenant_id, chargeNurseId, msg, metadata],
            );
        } else {
            // No charge nurse resolvable for this ward/shift — re-broadcast rather than let it go
            // completely unescalated.
            await query(
                `INSERT INTO notifications (tenant_id, user_id, type, action, message, metadata)
                 SELECT $1, id, 'lab', 'critical_result_escalated', $2, $3::jsonb FROM users WHERE tenant_id = $1 AND is_active AND role IN ('physician','nurse')`,
                [r.tenant_id, msg, metadata],
            );
        }
        await query('UPDATE lab_results SET escalated_at = now() WHERE id = $1', [r.id]);
        escalated++;
    }
    return escalated;
}

export async function registerCriticalResultEscalationWorker() {
    await boss.work(QUEUES.CRITICAL_RESULT_ESCALATION, async () => {
        const n = await sweepUnacknowledgedCriticals();
        if (n) console.log(`[critical-result-escalation] escalated ${n} unacknowledged critical result(s)`);
    });
    await boss.schedule(QUEUES.CRITICAL_RESULT_ESCALATION, '*/5 * * * *');
}
