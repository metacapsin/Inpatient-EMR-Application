import { medLineOut } from './medLine.js';

/** True when the encounter has a completed reconciliation of the given type. Shared by discharge gates (#13). */
export async function medRecComplete(db, encounterId, type) {
    const r = await db.query(`SELECT 1 FROM medication_reconciliations WHERE encounter_id = $1 AND type = $2 AND status = 'completed' LIMIT 1`, [encounterId, type]);
    return r.rowCount > 0;
}

/** Lines of the completed reconciliation (empty when none). */
export async function completedRecLines(db, encounterId, type) {
    const r = await db.query(`SELECT lines FROM medication_reconciliations WHERE encounter_id = $1 AND type = $2 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`, [encounterId, type]);
    return r.rowCount ? r.rows[0].lines : [];
}

/** Lines kept at discharge (everything not stopped), normalised to the shared MedLine shape. */
export const keptLines = (lines) => lines.filter((l) => l.action !== 'stop').map((l) => ({ ...medLineOut(l), source: 'discharge' }));
