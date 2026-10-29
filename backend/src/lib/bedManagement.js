// Shared bed-lifecycle primitives used by ADT, reservations, EVS and transfer requests.
// Every function takes a `db` with `.query` (a pool, or a transaction client from withTx).
import { conflict, notFound } from './http.js';

/**
 * SQL boolean: does encounter `encAlias` have an isolation precaution that has not been resolved?
 * Derived from the hai_events log: an 'isolation_started' event with no later 'infection_resolved'
 * for the same infectionType (mirrors inpatientDocs.js's unit summary logic).
 */
export const activeIsolationSql = (encAlias) => `EXISTS (
    SELECT 1 FROM hai_events hs
    WHERE hs.tenant_id = ${encAlias}.tenant_id AND hs.encounter_id = ${encAlias}.id AND hs.event_type = 'isolation_started'
      AND NOT EXISTS (
          SELECT 1 FROM hai_events hr
          WHERE hr.encounter_id = hs.encounter_id AND hr.event_type = 'infection_resolved'
            AND hr.occurred_at >= hs.occurred_at
            AND COALESCE(hr.data->>'infectionType','') = COALESCE(hs.data->>'infectionType','')
      )
)`;

export const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

export async function lockBed(db, bedId, tenantId) {
    const bed = (await db.query('SELECT * FROM beds WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [bedId, tenantId])).rows[0];
    if (!bed) throw notFound('Bed not found');
    return bed;
}

/** Marks any active reservation on the bed whose expires_at has passed as expired (returns count). */
export async function expireStaleReservationsForBed(db, bedId) {
    const r = await db.query(
        `UPDATE bed_reservations SET status = 'expired', resolved_at = now()
         WHERE bed_id = $1 AND status = 'active' AND expires_at <= now()`,
        [bedId],
    );
    return r.rowCount;
}

/**
 * Reverts a 'hold' bed once nothing holds it any more: back to 'dirty' if a cleaning job is still
 * open on it, otherwise 'available'. No-op if the bed is not on hold or another active reservation exists.
 */
export async function releaseHold(db, bedId) {
    const r = await db.query(
        `UPDATE beds b
         SET status = CASE WHEN EXISTS (SELECT 1 FROM evs_queue q WHERE q.bed_id = b.id AND q.status <> 'clean') THEN 'dirty' ELSE 'available' END
         WHERE b.id = $1 AND b.status = 'hold'
           AND NOT EXISTS (SELECT 1 FROM bed_reservations r WHERE r.bed_id = b.id AND r.status = 'active')
         RETURNING status`,
        [bedId],
    );
    return r.rows[0]?.status ?? null;
}

/** Expires every overdue active reservation tenant-wide and frees the beds. Returns how many expired. */
export async function sweepExpiredReservations(db) {
    const expired = await db.query(
        `UPDATE bed_reservations SET status = 'expired', resolved_at = now()
         WHERE status = 'active' AND expires_at <= now() RETURNING bed_id`,
    );
    for (const row of expired.rows) await releaseHold(db, row.bed_id);
    return expired.rowCount;
}

/**
 * Can this bed take a new patient? Blocks maintenance/blocked/dirty, open cleaning jobs, and holds —
 * unless the placement is the one the hold was made for (same patient or encounter).
 */
export async function assertBedFree(db, bed, { exceptEncounterId, patientId, encounterId } = {}) {
    if (['maintenance', 'blocked', 'dirty'].includes(bed.status)) throw conflict(`Bed is ${bed.status} and cannot be assigned`);
    const cleaning = await db.query(`SELECT status FROM evs_queue WHERE bed_id = $1 AND status <> 'clean' LIMIT 1`, [bed.id]);
    if (cleaning.rowCount) throw conflict('Bed is still in the housekeeping queue and cannot be assigned until it is approved clean');
    if (bed.status === 'hold') {
        await expireStaleReservationsForBed(db, bed.id);
        const res = (await db.query(`SELECT * FROM bed_reservations WHERE bed_id = $1 AND status = 'active'`, [bed.id])).rows[0];
        if (!res) throw conflict('Bed is on manual hold; release it from facility settings before assigning');
        const mine = (patientId && res.patient_id === patientId) || (encounterId && res.encounter_id === encounterId);
        if (!mine) throw conflict(`Bed is held for another patient until ${iso(res.expires_at)}`);
    }
    const occ = await db.query(
        `SELECT id FROM encounters WHERE bed_id = $1 AND status <> 'discharged' AND id <> COALESCE($2,'')`,
        [bed.id, exceptEncounterId ?? null],
    );
    if (occ.rowCount) throw conflict('That bed is already assigned to another patient');
}

/** The placement that a reservation was waiting for has happened. */
export async function fulfillReservations(db, bedId) {
    await db.query(`UPDATE bed_reservations SET status = 'fulfilled', resolved_at = now() WHERE bed_id = $1 AND status = 'active'`, [bedId]);
}

/** Opens a cleaning job for a bed (no-op if one is already open). */
export async function enqueueEvs(db, { tenantId, bedId, encounterId = null, cleaningType = 'Discharge' }) {
    const r = await db.query(
        `INSERT INTO evs_queue (tenant_id, bed_id, encounter_id, cleaning_type)
         SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM evs_queue WHERE bed_id = $2 AND status <> 'clean')
         RETURNING *`,
        [tenantId, bedId, encounterId, cleaningType],
    );
    return r.rows[0] ?? null;
}

/**
 * A patient has left this bed (discharge or transfer): the bed becomes 'dirty' and a cleaning job is
 * queued — 'Isolation' clean if the encounter had an active isolation precaution.
 */
export async function vacateBed(db, { tenantId, bedId, encounterId, defaultCleaningType = 'Discharge' }) {
    const iso = encounterId
        ? (await db.query(`SELECT ${activeIsolationSql('e')} AS isolation FROM encounters e WHERE e.id = $1`, [encounterId])).rows[0]?.isolation
        : false;
    await db.query(`UPDATE beds SET status = 'dirty' WHERE id = $1 AND status IN ('occupied','available')`, [bedId]);
    return enqueueEvs(db, { tenantId, bedId, encounterId, cleaningType: iso ? 'Isolation' : defaultCleaningType });
}

/**
 * Moves an active encounter to another bed inside the caller's transaction. Shared by
 * POST /api/transfers and transfer-request fulfilment.
 */
export async function performTransfer(db, { tenantId, userId, encounterId, newBedId, transferType, reason }) {
    const e = (await db.query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [encounterId, tenantId])).rows[0];
    if (!e) throw notFound('Encounter not found');
    if (e.status === 'discharged') throw conflict('Encounter is already discharged');
    if (e.bed_id === newBedId) throw conflict('Patient is already in that bed');
    const bed = await lockBed(db, newBedId, tenantId);
    await assertBedFree(db, bed, { exceptEncounterId: e.id, patientId: e.patient_id, encounterId: e.id });
    await db.query('UPDATE encounters SET bed_id = $1 WHERE id = $2', [newBedId, e.id]);
    if (e.bed_id) await vacateBed(db, { tenantId, bedId: e.bed_id, encounterId: e.id, defaultCleaningType: 'Routine' });
    await db.query(`UPDATE beds SET status = 'occupied' WHERE id = $1`, [newBedId]);
    await fulfillReservations(db, newBedId);
    // Any open transfer request for this encounter that asked for this ward (or any ward) is now satisfied.
    await db.query(
        `UPDATE transfer_requests tr SET status = 'fulfilled', fulfilled_bed_id = $1, resolved_at = now(), resolved_by = $3
         WHERE tr.encounter_id = $2 AND tr.status = 'open'
           AND (tr.requested_ward_id IS NULL OR tr.requested_ward_id = (SELECT r.ward_id FROM beds b JOIN rooms r ON r.id = b.room_id WHERE b.id = $1))`,
        [newBedId, e.id, userId],
    );
    const t = (
        await db.query(
            `INSERT INTO bed_transfers (encounter_id, from_bed_id, to_bed_id, transfer_type, reason, transferred_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [e.id, e.bed_id, newBedId, transferType ?? null, reason ?? null, userId],
        )
    ).rows[0];
    return {
        encounterId: e.id,
        patientId: e.patient_id,
        currentBedId: newBedId,
        transfer: { id: t.id, fromBedId: t.from_bed_id, toBedId: t.to_bed_id, transferType: t.transfer_type, reason: t.reason, transferredAt: iso(t.transferred_at) },
    };
}
