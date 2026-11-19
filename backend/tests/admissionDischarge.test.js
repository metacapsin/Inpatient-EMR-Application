// Admission / discharge / beds (#SAF-12, 14, 20, 21, 22, 24, BUG-12, BUG-14, + AMA/deceased/admission
// checklist): bug fixes (Bucket A), physician-only discharge confirm (Bucket B), and the three new
// Bucket C workflows.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { buildAdtMessage } from '../src/lib/hl7Adt.js';

let server;
let base;
const tenantIds = [];
const suffix = `ad${Date.now().toString(36)}`;

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    for (const id of tenantIds) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    await new Promise((r) => server.close(r));
    await pool.end();
});

async function call(method, path, { body, token } = {}) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json };
}

async function newTenant(label) {
    const email = `${label}-${suffix}@test.example`;
    const password = 'Test-passw0rd!';
    const r = await call('POST', '/auth/register', { body: { username: `${label}${suffix}`, email, password, organization: `Org ${label}` } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    tenantIds.push(r.body.user.tenant.id);
    return { ...r.body, email, password };
}

async function addUser(admin, label, role) {
    const email = `${label}-${suffix}@test.example`;
    const mk = await call('POST', '/auth/register-user', { token: admin.token, body: { email, password: 'Staff-passw0rd', role, firstName: label, lastName: 'User' } });
    assert.equal(mk.status, 201, JSON.stringify(mk.body));
    const login = await call('POST', '/login', { body: { username: email, password: 'Staff-passw0rd' } });
    assert.equal(login.status, 200);
    return { token: login.body.token, id: login.body.user.id ?? login.body.user._id };
}

async function makeBed(tk, label) {
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: `W-${label}` } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: `R-${label}` } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: `B-${label}` } })).body.data;
    return { ward, room, bed };
}

async function admitPatient(tk, label, extra = {}) {
    const { ward, room, bed } = await makeBed(tk, label);
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1960-04-05', sex: 'F' } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Chest pain', ...extra } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id, ward, room, bed };
}

/** Drives an encounter to "ready to confirm" (signed summary, completed discharge med-rec, open
 * nursing tasks done) without touching disposition-specific gates. Returns the physician { token, id }. */
async function satisfyBaseGates(tk, encounterId, disposition) {
    const view = await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: tk });
    assert.equal(view.status, 200, JSON.stringify(view.body));
    for (const t of view.body.data.checklist.filter((x) => x.blocksDischarge && !x.completed)) {
        assert.equal((await call('PATCH', `/api/encounters/${encounterId}/discharge-checklist/tasks/${t.id}`, { token: tk, body: { completed: true } })).status, 200);
    }
    const md = await addUser({ token: tk }, `md${Math.random().toString(36).slice(2, 8)}`, 'physician');
    const rec = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation/discharge`, { token: tk })).body.data;
    const lines = rec.lines.map((l) => ({ ...l, action: 'continue' }));
    assert.equal((await call('POST', `/api/encounters/${encounterId}/med-reconciliation/discharge/complete`, { token: md.token, body: { lines } })).status, 200);
    const summary = { admissionDiagnosis: 'Pneumonia', hospitalCourse: 'Treated.', finalDiagnoses: 'J18.9', dischargeMedications: 'None', followUpInstructions: 'PCP 7d', disposition };
    assert.equal((await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: tk, body: summary })).status, 200);
    const sign = await call('POST', `/api/encounters/${encounterId}/discharge-summary/sign`, { token: md.token, body: {} });
    assert.equal(sign.status, 200, JSON.stringify(sign.body));
    return md;
}

// -------------------------------------------------------------------------------------------- A
test('SAF-21: attendingPhysicianId must resolve to an active physician in the tenant', async () => {
    const t = await newTenant('attend');
    const nurse = await addUser(t, 'nurseattend', 'nurse');
    const { bed } = await makeBed(t.token, 'Attend');
    const p = (await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Attend', lastName: 'Patient', dOB: '1960-04-05', sex: 'F' } })).body.data;

    const bad = await call('POST', '/api/admissions', { token: t.token, body: { patientId: p.id, bedId: bed.id, attendingPhysicianId: 'not-a-real-id' } });
    assert.equal(bad.status, 404, JSON.stringify(bad.body));

    const badRole = await call('POST', '/api/admissions', { token: t.token, body: { patientId: p.id, bedId: bed.id, attendingPhysicianId: nurse.id } });
    assert.equal(badRole.status, 404, 'a nurse is not a valid attending physician');

    const md = await addUser(t, 'mdattend', 'physician');
    const ok = await call('POST', '/api/admissions', { token: t.token, body: { patientId: p.id, bedId: bed.id, attendingPhysicianId: md.id } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.data.encounter.attendingPhysicianId, md.id);
});

test('SAF-22: a dirty bed cannot be reserved (would create a hold that could never be consumed)', async () => {
    const t = await newTenant('dirtyHold');
    const { bed } = await makeBed(t.token, 'DirtyHold');
    assert.equal((await call('PUT', '/Beds/updateBedById', { token: t.token, body: { id: bed.id, status: 'dirty' } })).status, 200);
    const p = (await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'DirtyHold', lastName: 'Patient', dOB: '1960-04-05', sex: 'F' } })).body.data;
    const reserve = await call('POST', `/api/beds/${bed.id}/reserve`, { token: t.token, body: { patientId: p.id, expiresInMinutes: 30 } });
    assert.equal(reserve.status, 409, JSON.stringify(reserve.body));
    assert.match(reserve.body.message, /dirty/);
});

test('SAF-24: HL7 message has a DG1 segment, an MSH-10 within 20 chars, and real escape sequences', () => {
    const msg = buildAdtMessage({
        eventType: 'A01',
        sendingFacility: 'Org',
        receivingApp: 'PCP',
        patient: { mrn: 'MRN000001', firstName: 'Jane', lastName: 'Doe', dob: '1960-04-05', sex: 'F' },
        encounter: { id: 'enc-1', admittedAt: new Date(), admissionType: 'emergency', attendingPhysicianId: null, disposition: null, diagnosis: 'Chest pain | shortness of breath' },
        location: { ward: 'ICU', room: '1', bed: 'A' },
    });
    const segments = msg.split('\r');
    const msh = segments.find((s) => s.startsWith('MSH|')).split('|');
    assert.ok(msh[9].length <= 20, `MSH-10 must be <=20 chars, got ${msh[9].length}`);
    const dg1 = segments.find((s) => s.startsWith('DG1|'));
    assert.ok(dg1, 'DG1 segment must be present when a diagnosis is known');
    assert.match(dg1, /\\F\\/, "the pipe in the diagnosis must be escaped as \\F\\, not replaced with a space");
    const pv1 = segments.find((s) => s.startsWith('PV1|')).split('|');
    assert.equal(pv1[10], '', 'PV1-10 (Hospital Service) must no longer carry the diagnosis');
});

test('BUG-12: an explicit null clears a discharge-summary field; omitting it leaves it alone', async () => {
    const t = await newTenant('nullClear');
    const { encounterId } = await admitPatient(t.token, 'NullClear');
    await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: t.token, body: { admissionDiagnosis: 'Chest pain', procedures: 'None' } });
    const omitted = await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: t.token, body: { hospitalCourse: 'x' } });
    assert.equal(omitted.body.data.summary.admissionDiagnosis, 'Chest pain', 'omitted field must be left alone');
    const cleared = await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: t.token, body: { admissionDiagnosis: null } });
    assert.equal(cleared.body.data.summary.admissionDiagnosis, '', 'explicit null must actually clear the field');
    assert.equal(cleared.body.data.summary.procedures, 'None', 'other fields stay untouched by the clear');
});

test('BUG-14: bed board totalBeds reflects the whole facility, not a bedStatus-filtered subset', async () => {
    const t = await newTenant('totalBeds');
    const { bed: bedA } = await makeBed(t.token, 'TotalA');
    await makeBed(t.token, 'TotalB');
    await call('PUT', '/Beds/updateBedById', { token: t.token, body: { id: bedA.id, status: 'maintenance' } });
    const filtered = await call('GET', '/Beds/getLiveBedBoard?bedStatus=maintenance', { token: t.token });
    assert.equal(filtered.body.data.rows.length, 1, 'the filtered row set is still just the one bed');
    assert.equal(filtered.body.data.summary.totalBeds, 2, 'but totalBeds must count the whole facility');
});

// -------------------------------------------------------------------------------------------- B
test('SAF-12: only a physician can confirm a discharge; nurse/staff/admin cannot', async () => {
    const t = await newTenant('confirmGate');
    const nurse = await addUser(t, 'nurseconfirm', 'nurse');
    const { encounterId } = await admitPatient(t.token, 'ConfirmGate');
    await call('POST', '/api/discharges', { token: t.token, body: { phase: 'initiate', encounterId } });
    const md = await satisfyBaseGates(t.token, encounterId, '01');

    assert.equal((await call('POST', '/api/discharges/confirm', { token: t.token, body: { encounterId } })).status, 403, 'admin cannot confirm');
    assert.equal((await call('POST', '/api/discharges/confirm', { token: nurse.token, body: { encounterId } })).status, 403, 'nurse cannot confirm');
    const ok = await call('POST', '/api/discharges/confirm', { token: md.token, body: { encounterId } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

// -------------------------------------------------------------------------------------------- C
test('Admission checklist: computed from real data, including the manual allergies-reviewed attestation', async () => {
    const t = await newTenant('checklist');
    const nurse = await addUser(t, 'nursechecklist', 'nurse');
    const { patient, encounterId } = await admitPatient(t.token, 'Checklist');

    const before = (await call('GET', `/api/admissions/${encounterId}/checklist`, { token: t.token })).body.data;
    assert.equal(before.items.find((i) => i.id === 'allergies').completed, false);
    assert.equal(before.items.find((i) => i.id === 'med-rec').completed, false);
    assert.equal(before.items.find((i) => i.id === 'vitals').completed, false);
    assert.equal(before.items.find((i) => i.id === 'consent').completed, false);
    assert.equal(before.items.find((i) => i.id === 'hp').completed, false);
    // Risk screens are deliberately not on this list — no real data backs them yet.
    assert.ok(!before.items.some((i) => i.id.includes('risk') || i.label.toLowerCase().includes('risk')));

    await call('POST', `/api/admissions/${encounterId}/allergies-reviewed`, { token: t.token, body: {} });
    const afterAllergy = (await call('GET', `/api/admissions/${encounterId}/checklist`, { token: t.token })).body.data;
    assert.equal(afterAllergy.items.find((i) => i.id === 'allergies').completed, true);

    const allergy = await call('POST', '/Patient/createAllergy', { token: nurse.token, body: { patientId: patient.id, allergyName: 'Penicillin' } });
    assert.equal(allergy.status, 201, JSON.stringify(allergy.body));
    await pool.query(`INSERT INTO health_metrics (tenant_id, patient_id, metric_type, value_primary, unit) VALUES ((SELECT tenant_id FROM patients WHERE id = $1), $1, 'heart_rate', 80, 'bpm')`, [patient.id]);
    const afterVitals = (await call('GET', `/api/admissions/${encounterId}/checklist`, { token: t.token })).body.data;
    assert.equal(afterVitals.items.find((i) => i.id === 'vitals').completed, true);
    assert.match(afterVitals.items.find((i) => i.id === 'allergies').detail, /1 on file/);
});

test('AMA workflow: disposition 07 blocks confirm until an AMA record is on file', async () => {
    const t = await newTenant('ama');
    const { encounterId } = await admitPatient(t.token, 'Ama');
    await call('POST', '/api/discharges', { token: t.token, body: { phase: 'initiate', encounterId } });
    const md = await satisfyBaseGates(t.token, encounterId, '07');

    const blocked = await call('POST', '/api/discharges/confirm', { token: md.token, body: { encounterId } });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.ok(blocked.body.details.blocking.some((g) => g.id === 'gate-ama-record'));

    const nurse = await addUser(t, 'nurseama', 'nurse');
    const nurseAttempt = await call('POST', `/api/encounters/${encounterId}/ama-discharge`, { token: nurse.token, body: { reason: 'x', risksExplained: true, witnessName: 'W', patientSignature: 'Sig' } });
    assert.equal(nurseAttempt.status, 403, 'recording an AMA discharge is a physician attestation');

    const rec = await call('POST', `/api/encounters/${encounterId}/ama-discharge`, {
        token: md.token,
        body: { reason: 'Wants to leave to care for family', risksExplained: true, witnessName: 'Charge Nurse Lee', patientSignature: 'Patient Typed Name' },
    });
    assert.equal(rec.status, 201, JSON.stringify(rec.body));

    const confirmed = await call('POST', '/api/discharges/confirm', { token: md.token, body: { encounterId } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
});

test('Deceased workflow: disposition 20 blocks confirm until a death record is on file and flags the patient deceased', async () => {
    const t = await newTenant('deceased');
    const { patient, encounterId } = await admitPatient(t.token, 'Deceased');
    await call('POST', '/api/discharges', { token: t.token, body: { phase: 'initiate', encounterId } });
    const md = await satisfyBaseGates(t.token, encounterId, '20');

    const blocked = await call('POST', '/api/discharges/confirm', { token: md.token, body: { encounterId } });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.ok(blocked.body.details.blocking.some((g) => g.id === 'gate-death-record'));

    const badPhysician = await call('POST', `/api/encounters/${encounterId}/death-record`, {
        token: md.token,
        body: { diedAt: new Date().toISOString(), pronouncingPhysicianId: 'not-a-real-id' },
    });
    assert.equal(badPhysician.status, 404);

    const diedAt = new Date().toISOString();
    const rec = await call('POST', `/api/encounters/${encounterId}/death-record`, {
        token: md.token,
        body: { diedAt, pronouncingPhysicianId: md.id },
    });
    assert.equal(rec.status, 201, JSON.stringify(rec.body));

    const confirmed = await call('POST', '/api/discharges/confirm', { token: md.token, body: { encounterId } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

    const row = await pool.query('SELECT deceased, deceased_at FROM patients WHERE id = $1', [patient.id]);
    assert.equal(row.rows[0].deceased, true);
    assert.ok(row.rows[0].deceased_at);
});

test('GET /api/physicians lists only active physicians in the tenant', async () => {
    const t = await newTenant('physList');
    const md = await addUser(t, 'mdphyslist', 'physician');
    await addUser(t, 'nursephyslist', 'nurse');
    const r = await call('GET', '/api/physicians', { token: t.token });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.some((p) => p.id === md.id));
    assert.equal(r.body.data.length, 1, 'only the physician, not the nurse');
});
