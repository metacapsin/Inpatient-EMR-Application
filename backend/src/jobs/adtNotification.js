import { boss, QUEUES } from '../db/queue.js';

/** Minimal HL7 v2-style ADT^A01 message (pipe-delimited, CMS CoP admission-notification shape). */
function buildHl7AdtNotification(payload) {
    const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const msh = `MSH|^~\\&|EMR|${payload.tenantId}|POST_ACUTE_PCP|RECIPIENT|${now}||ADT^A01|${payload.encounterId}|P|2.5`;
    const evn = `EVN|A01|${now}`;
    const pid = `PID|1||${payload.mrn}||${payload.patientName}||${payload.dob ?? ''}`;
    const pv1 = `PV1|1|I|${payload.bedId ?? ''}||||${payload.attendingPhysicianId ?? ''}|||||||||||${payload.admissionType ?? ''}`;
    return [msh, evn, pid, pv1].join('\r');
}

/**
 * Notifies the patient's post-acute/PCP recipient directory of an admission (CMS Conditions of
 * Participation). Stubbed: no real HL7 transport or recipient-directory integration yet — building
 * the payload is real, only the delivery call is a stand-in for the future `fetch()`/transport.
 */
async function deliverAdtNotification(message, payload) {
    console.log(`[adt-notification:stub] would deliver HL7 ADT^A01 for encounter ${payload.encounterId}:\n${message}`);
}

export function registerAdtNotificationWorker() {
    return boss.work(QUEUES.ADT_NOTIFICATION, async ([job]) => {
        const message = buildHl7AdtNotification(job.data);
        await deliverAdtNotification(message, job.data);
    });
}
