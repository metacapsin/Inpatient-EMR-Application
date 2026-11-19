import { query } from '../db/pool.js';

/**
 * SAF-06: who a critical finding actually needs to reach — the clinician who ordered it, the
 * encounter's attending physician, and whichever nurse has the patient's current bed on today's
 * shift assignment — instead of broadcasting to every physician and nurse in the tenant.
 *
 * Shift boundaries (24h): day 07:00–15:00, evening 15:00–23:00, night 23:00–07:00. Adjust here if
 * the hospital's actual shift times differ.
 */
function currentShift(now = new Date()) {
    const h = now.getHours();
    if (h >= 7 && h < 15) return 'day';
    if (h >= 15 && h < 23) return 'evening';
    return 'night';
}

/** @param {string} tenantId @param {string} patientId */
async function currentBedAndWard(tenantId, patientId) {
    const bed = (
        await query(
            `SELECT b.id AS bed_id, b.room_id FROM encounters e JOIN beds b ON b.id = e.bed_id
             WHERE e.tenant_id = $1 AND e.patient_id = $2 AND e.status <> 'discharged'
             ORDER BY e.admitted_at DESC LIMIT 1`,
            [tenantId, patientId],
        )
    ).rows[0];
    if (!bed) return null;
    const ward = (await query('SELECT ward_id FROM rooms WHERE id = $1', [bed.room_id])).rows[0];
    return ward ? { bedId: bed.bed_id, wardId: ward.ward_id } : null;
}

/** @param {string} tenantId @param {string} userId */
async function isActiveUser(tenantId, userId) {
    const r = await query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [userId, tenantId]);
    return Boolean(r.rowCount);
}

/**
 * @param {{ tenantId: string, patientId: string, orderingUserId?: string | null, attendingUserId?: string | null }} args
 * @returns {Promise<string[] | null>} user ids to notify, or null if none could be resolved —
 *   callers should fall back to a broadcast in that case rather than notifying no one.
 */
export async function resolveCriticalNotifyTargets({ tenantId, patientId, orderingUserId, attendingUserId }) {
    const targets = new Set();
    for (const id of [orderingUserId, attendingUserId]) {
        if (id && (await isActiveUser(tenantId, id))) targets.add(id);
    }
    const location = await currentBedAndWard(tenantId, patientId);
    if (location) {
        const shift = currentShift();
        const assignment = (
            await query(
                `SELECT id FROM staffing_assignments WHERE tenant_id = $1 AND ward_id = $2 AND assignment_date = CURRENT_DATE AND shift = $3`,
                [tenantId, location.wardId, shift],
            )
        ).rows[0];
        if (assignment) {
            const nurses = await query(
                `SELECT nurse_id FROM staffing_nurse_assignments WHERE assignment_id = $1 AND assigned_bed_ids ? $2`,
                [assignment.id, location.bedId],
            );
            for (const n of nurses.rows) targets.add(n.nurse_id);
        }
    }
    return targets.size ? [...targets] : null;
}

/**
 * Escalation target (SAF-06): the charge nurse for the patient's current ward/shift. Null if it
 * can't be resolved (no active encounter/bed, or no staffing assignment entered for today's shift).
 * @param {{ tenantId: string, patientId: string }} args
 * @returns {Promise<string | null>}
 */
export async function resolveChargeNurse({ tenantId, patientId }) {
    const location = await currentBedAndWard(tenantId, patientId);
    if (!location) return null;
    const r = await query(
        `SELECT charge_nurse_id FROM staffing_assignments WHERE tenant_id = $1 AND ward_id = $2 AND assignment_date = CURRENT_DATE AND shift = $3`,
        [tenantId, location.wardId, currentShift()],
    );
    return r.rows[0]?.charge_nurse_id ?? null;
}
