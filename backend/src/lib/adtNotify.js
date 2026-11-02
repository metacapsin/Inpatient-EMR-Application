import { query } from '../db/pool.js';
import { boss, QUEUES } from '../db/queue.js';
import { buildAdtMessage, EVENT_LABELS } from './hl7Adt.js';
import { deliverAdt } from './adtTransport.js';

/**
 * Records an ADT event (A01 admission / A02 transfer / A03 discharge) for CMS CoP notifications:
 * one `adt_notification_log` row per enabled recipient (patient's PCP recipient + every post-acute / HIE /
 * other recipient of the tenant; a single stub row when the directory is empty so the message is still
 * visible), then one pg-boss job that delivers them. Best effort — never fails the ADT call.
 */
export async function recordAdtEvent({ tenantId, encounterId, eventType, priorBedId = null }) {
    try {
        const enc = (await query(
            `SELECT e.*, p.mrn, p.first_name, p.last_name, p.dob, p.sex, p.pcp_name, p.pcp_npi, p.pcp_recipient_id,
                    b.label AS bed_label, r.room_number, w.name AS ward_name, u.first_name || ' ' || u.last_name AS attending_name, t.name AS tenant_name
             FROM encounters e JOIN patients p ON p.id = e.patient_id JOIN tenants t ON t.id = e.tenant_id
             LEFT JOIN beds b ON b.id = e.bed_id LEFT JOIN rooms r ON r.id = b.room_id LEFT JOIN wards w ON w.id = r.ward_id
             LEFT JOIN users u ON u.id = e.attending_physician_id
             WHERE e.id = $1 AND e.tenant_id = $2`,
            [encounterId, tenantId],
        )).rows[0];
        if (!enc) return [];
        const prior = priorBedId
            ? (await query(`SELECT b.label AS bed, r.room_number AS room, w.name AS ward FROM beds b JOIN rooms r ON r.id = b.room_id JOIN wards w ON w.id = r.ward_id WHERE b.id = $1`, [priorBedId])).rows[0]
            : null;
        const recipients = (await query(
            `SELECT * FROM notification_recipients WHERE tenant_id = $1 AND enabled AND (kind IN ('post_acute','hie','other') OR id = $2) ORDER BY kind, name`,
            [tenantId, enc.pcp_recipient_id ?? ''],
        )).rows;
        const targets = recipients.length ? recipients : [{ id: null, name: 'Stub recipient (no directory entries yet)', transport: 'stub' }];
        const ids = [];
        for (const rcpt of targets) {
            const message = buildAdtMessage({
                eventType,
                sendingFacility: enc.tenant_name ?? tenantId,
                receivingApp: rcpt.name,
                patient: { mrn: enc.mrn, firstName: enc.first_name, lastName: enc.last_name, dob: enc.dob, sex: enc.sex, pcpName: enc.pcp_name, pcpNpi: enc.pcp_npi },
                encounter: { id: enc.id, admittedAt: enc.admitted_at, dischargedAt: enc.discharged_at, admissionType: enc.admission_type, attendingPhysicianId: enc.attending_physician_id, attendingName: enc.attending_name, disposition: enc.disposition, diagnosis: enc.diagnosis },
                location: { ward: enc.ward_name, room: enc.room_number, bed: enc.bed_label },
                priorLocation: prior,
            });
            const row = (await query(
                `INSERT INTO adt_notification_log (tenant_id, encounter_id, patient_id, event_type, recipient_id, recipient_name, transport, message)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                [tenantId, enc.id, enc.patient_id, eventType, rcpt.id, rcpt.name, rcpt.transport, message],
            )).rows[0];
            ids.push(row.id);
        }
        await boss.send(QUEUES.ADT_NOTIFICATION, { encounterId: enc.id, tenantId, patientId: enc.patient_id, eventType, logIds: ids }, { retryLimit: 5, retryBackoff: true });
        return ids;
    } catch (e) {
        console.error(`[adt-notification] failed to record ${eventType} for encounter ${encounterId}:`, e.message);
        return [];
    }
}

/** Delivers every still-undelivered log row of a job. Throws when any delivery failed so pg-boss retries. */
export async function processAdtNotificationJob(data) {
    const ids = data?.logIds ?? [];
    if (!ids.length) return { sent: 0, failed: 0 };
    const rows = (await query(
        `SELECT l.*, r.endpoint, r.auth_header_secret FROM adt_notification_log l LEFT JOIN notification_recipients r ON r.id = l.recipient_id
         WHERE l.id = ANY($1::text[]) AND l.status <> 'sent'`,
        [ids],
    )).rows;
    let sent = 0, failed = 0;
    for (const row of rows) {
        const rcpt = { name: row.recipient_name, transport: row.transport, endpoint: row.endpoint, auth_header_secret: row.auth_header_secret };
        try {
            await deliverAdt(rcpt, row.message, { subject: `ADT ${row.event_type} ${EVENT_LABELS[row.event_type] ?? ''} notification` });
            await query(`UPDATE adt_notification_log SET status = 'sent', attempts = attempts + 1, sent_at = now(), last_error = NULL WHERE id = $1`, [row.id]);
            sent++;
        } catch (e) {
            await query(`UPDATE adt_notification_log SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1`, [row.id, String(e.message).slice(0, 1000)]);
            failed++;
        }
    }
    if (failed) throw new Error(`${failed} ADT notification delivery(ies) failed`);
    return { sent, failed };
}
