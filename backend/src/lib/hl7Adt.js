/**
 * HL7 v2.5 ADT message builder (CMS CoP 42 CFR 482.24(d) admission / transfer / discharge notifications).
 * Segments: MSH, EVN, PID, PV1 (PV1-3 assigned location, PV1-6 prior location on A02, PV1-36 discharge
 * disposition and PV1-45 discharge time on A03), plus PD1-4 for the PCP when known.
 */
const ts = (d) => (d ? new Date(d) : new Date()).toISOString().replace(/[-:T]/g, '').slice(0, 14);
const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[|^~\\&\r\n]/g, ' ').trim());
const dob = (d) => (d ? String(d).slice(0, 10).replace(/-/g, '') : '');

export const EVENT_LABELS = { A01: 'Admission', A02: 'Transfer', A03: 'Discharge', A08: 'Update' };

/**
 * @param {object} o
 * @param {'A01'|'A02'|'A03'|'A08'} o.eventType
 * @param {string} o.sendingFacility   tenant id / name
 * @param {string} o.receivingApp      recipient name
 * @param {object} o.patient           { mrn, firstName, lastName, dob, sex, pcpName, pcpNpi }
 * @param {object} o.encounter         { id, admittedAt, dischargedAt, admissionType, attendingPhysicianId, attendingName, disposition, diagnosis }
 * @param {object} o.location          { ward, room, bed }
 * @param {object} [o.priorLocation]   { ward, room, bed }  (A02)
 */
export function buildAdtMessage(o) {
    const now = ts();
    const controlId = `${o.encounter.id}-${o.eventType}-${now}`.slice(0, 199);
    const loc = (l) => (l ? [esc(l.ward), esc(l.room), esc(l.bed)].join('^') : '');
    const msh = ['MSH', '^~\\&', 'EMR', esc(o.sendingFacility), esc(o.receivingApp || 'PCP'), 'RECIPIENT', now, '', `ADT^${o.eventType}^ADT_${o.eventType === 'A02' ? 'A02' : o.eventType === 'A03' ? 'A03' : 'A01'}`, controlId, 'P', '2.5'].join('|');
    const evn = ['EVN', o.eventType, now, '', '', '', ts(o.eventType === 'A03' ? o.encounter.dischargedAt : o.encounter.admittedAt)].join('|');
    const pid = ['PID', '1', '', `${esc(o.patient.mrn)}^^^EMR^MR`, '', `${esc(o.patient.lastName)}^${esc(o.patient.firstName)}`, '', dob(o.patient.dob), esc(o.patient.sex)].join('|');
    const pd1 = o.patient.pcpName ? ['PD1', '', '', '', `${esc(o.patient.pcpNpi)}^${esc(o.patient.pcpName)}^^^^^^^NPI`].join('|') : null;
    const pv1Fields = new Array(45).fill('');
    pv1Fields[0] = 'PV1';
    pv1Fields[1] = '1';
    pv1Fields[2] = 'I';
    pv1Fields[3] = loc(o.location);
    pv1Fields[4] = esc(o.encounter.admissionType);
    pv1Fields[6] = o.eventType === 'A02' ? loc(o.priorLocation) : '';
    pv1Fields[7] = o.encounter.attendingName ? `${esc(o.encounter.attendingPhysicianId)}^${esc(o.encounter.attendingName)}` : esc(o.encounter.attendingPhysicianId);
    pv1Fields[10] = esc(o.encounter.diagnosis);
    pv1Fields[19] = esc(o.encounter.id);
    pv1Fields[36] = o.eventType === 'A03' ? esc(o.encounter.disposition) : '';
    pv1Fields[44] = ts(o.encounter.admittedAt);
    pv1Fields[45] = o.eventType === 'A03' ? ts(o.encounter.dischargedAt) : '';
    const pv1 = pv1Fields.join('|').replace(/\|+$/, '');
    return [msh, evn, pid, pd1, pv1].filter(Boolean).join('\r');
}

/** Parses an HL7 ACK and returns MSA-1 (AA/CA = accepted). */
export function parseAck(raw) {
    const seg = String(raw ?? '').split(/\r?\n|\r/).find((s) => s.startsWith('MSA|'));
    if (!seg) return { accepted: false, code: null, text: 'No MSA segment in response' };
    const f = seg.split('|');
    return { accepted: ['AA', 'CA'].includes(f[1]), code: f[1] ?? null, text: f[3] ?? '' };
}
