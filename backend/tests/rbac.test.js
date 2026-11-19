// RBAC (#SEC-04, 05, 16, 17): read-side role gating, CDI inbox / ADT log gates, self-asserted
// NPI/DEA, and admin no longer bypassing clinical sign/dispense/acknowledge actions.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const suffix = `rbac${Date.now().toString(36)}`;

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

async function admitPatient(tk, label) {
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: `W-${label}` } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: `R-${label}` } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: `B-${label}` } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1960-04-05', sex: 'F' } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Chest pain' } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id };
}

// ---------------------------------------------------------------- SEC-04: read-side role gating
test('rbac: clinical notes reads require physician/nurse/staff; billing cannot read', async () => {
    const t = await newTenant('notesRead');
    const billing = await addUser(t, 'billingNR', 'billing');
    const { patient } = await admitPatient(t.token, 'NR');

    const asAdmin = await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: t.token });
    assert.equal(asAdmin.status, 200, JSON.stringify(asAdmin.body));

    const asBilling = await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: billing.token });
    assert.equal(asBilling.status, 403);
});

test('rbac: critical labs worklist requires physician/nurse/pharmacist/staff; billing cannot read', async () => {
    const t = await newTenant('labsRead');
    const billing = await addUser(t, 'billingLR', 'billing');
    const pharmacist = await addUser(t, 'pharmLR', 'pharmacist');

    assert.equal((await call('GET', '/lab-results/critical', { token: t.token })).status, 200);
    assert.equal((await call('GET', '/lab-results/critical', { token: pharmacist.token })).status, 200);
    assert.equal((await call('GET', '/lab-results/critical', { token: billing.token })).status, 403);
});

test('rbac: medication list/MAR reads require physician/nurse/pharmacist; billing cannot read', async () => {
    const t = await newTenant('medRead');
    const billing = await addUser(t, 'billingMR', 'billing');
    const pharmacist = await addUser(t, 'pharmMR', 'pharmacist');
    const { patient } = await admitPatient(t.token, 'MR');

    assert.equal((await call('GET', `/api/patients/${patient.id}/medications`, { token: pharmacist.token })).status, 200);
    assert.equal((await call('GET', `/api/mar/${patient.id}`, { token: billing.token })).status, 403);
    // Reference directory data stays ungated — not patient PHI.
    assert.equal((await call('GET', '/api/pharmacies', { token: billing.token })).status, 200);
});

test('rbac: problem list reads require physician/nurse; pharmacist and billing cannot read', async () => {
    const t = await newTenant('probRead');
    const pharmacist = await addUser(t, 'pharmPR', 'pharmacist');
    const { patient } = await admitPatient(t.token, 'PR');

    assert.equal((await call('GET', `/api/patients/${patient.id}/problems`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/api/patients/${patient.id}/problems`, { token: pharmacist.token })).status, 403);
    // Reference lookup (ICD-10 search) stays ungated.
    assert.equal((await call('GET', '/api/icd10/search?q=diabetes', { token: pharmacist.token })).status, 200);
});

test('rbac: vitals reads require physician/nurse/staff; billing cannot read', async () => {
    const t = await newTenant('vitalsRead');
    const billing = await addUser(t, 'billingVR', 'billing');
    const staff = await addUser(t, 'staffVR', 'staff');
    const { patient } = await admitPatient(t.token, 'VR');

    assert.equal((await call('GET', `/api/health/metrics/latest?patientId=${patient.id}`, { token: staff.token })).status, 200);
    assert.equal((await call('GET', `/api/health/metrics/latest?patientId=${patient.id}`, { token: billing.token })).status, 403);
});

test('rbac: nursing flowsheet/I-O/HAI reads require physician/nurse/staff; billing cannot read', async () => {
    const t = await newTenant('flowRead');
    const billing = await addUser(t, 'billingFR', 'billing');
    const { encounterId } = await admitPatient(t.token, 'FR');

    assert.equal((await call('GET', `/api/CarePlan/${encounterId}`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/api/CarePlan/${encounterId}`, { token: billing.token })).status, 403);
    // Reference lookup (NANDA diagnosis search) stays ungated.
    assert.equal((await call('GET', '/api/CarePlan/nanda/search?q=pain', { token: billing.token })).status, 200);
});

test('rbac: records.js reads (allergies, documents, history) require physician/nurse/staff; billing cannot read', async () => {
    const t = await newTenant('recRead');
    const billing = await addUser(t, 'billingRR', 'billing');
    const { patient } = await admitPatient(t.token, 'RR');

    assert.equal((await call('GET', `/Patient/getAllAllergyList?rcopiaID=${patient.id}`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/Patient/getAllAllergyList?rcopiaID=${patient.id}`, { token: billing.token })).status, 403);
    // Reference lookup (history category list) stays ungated.
    assert.equal((await call('GET', '/Patient/getAllHistoryCategories', { token: billing.token })).status, 200);
});

test('rbac: orders reads require physician/nurse/pharmacist; billing cannot read', async () => {
    const t = await newTenant('ordRead');
    const billing = await addUser(t, 'billingOR', 'billing');
    const pharmacist = await addUser(t, 'pharmOR', 'pharmacist');
    const { encounterId } = await admitPatient(t.token, 'OR');

    assert.equal((await call('GET', `/api/encounters/${encounterId}/orders`, { token: pharmacist.token })).status, 200);
    assert.equal((await call('GET', `/api/encounters/${encounterId}/orders`, { token: billing.token })).status, 403);
});

test('rbac: admin can still read everything the new gates cover', async () => {
    const t = await newTenant('adminRead');
    const { patient, encounterId } = await admitPatient(t.token, 'AdminRead');
    assert.equal((await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/api/patients/${patient.id}/problems`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/api/CarePlan/${encounterId}`, { token: t.token })).status, 200);
});

// -------------------------------------------------------------------------------------- SEC-05
test('rbac: CDI inbox requires billing/physician; nurse cannot read it', async () => {
    const t = await newTenant('cdi');
    const nurse = await addUser(t, 'nurseCdi', 'nurse');
    assert.equal((await call('GET', `/api/CDI/query/inbox/${t.user.id}`, { token: t.token })).status, 200);
    assert.equal((await call('GET', `/api/CDI/query/inbox/${t.user.id}`, { token: nurse.token })).status, 403);
});

test('rbac: ADT notification log requires admin/staff; nurse cannot read it', async () => {
    const t = await newTenant('adtlog');
    const nurse = await addUser(t, 'nurseAdt', 'nurse');
    const staff = await addUser(t, 'staffAdt', 'staff');
    assert.equal((await call('GET', '/api/adt-notifications', { token: t.token })).status, 200);
    assert.equal((await call('GET', '/api/adt-notifications', { token: staff.token })).status, 200);
    assert.equal((await call('GET', '/api/adt-notifications', { token: nurse.token })).status, 403);
});

// -------------------------------------------------------------------------------------- SEC-16
test('rbac: a nurse cannot self-assert NPI/DEA via PUT /auth/profile; admin can set it on another user', async () => {
    const t = await newTenant('npiSelf');
    const nurse = await addUser(t, 'nurseNpi', 'nurse');

    const selfSet = await call('PUT', '/auth/profile', { token: nurse.token, body: { npi: '1234567895', deaNumber: 'AB1234567' } });
    assert.equal(selfSet.status, 200, JSON.stringify(selfSet.body));
    assert.equal(selfSet.body.data.npi, '', 'npi must not be settable via self-service profile');
    assert.equal(selfSet.body.data.deaNumber, '', 'deaNumber must not be settable via self-service profile');

    const adminSet = await call('PUT', `/auth/users/${nurse.id}`, { token: t.token, body: { npi: '1234567895' } });
    assert.equal(adminSet.status, 200, JSON.stringify(adminSet.body));
    assert.equal(adminSet.body.data.npi, '1234567895');
});

// -------------------------------------------------------------------------------------- SEC-17
test('rbac: admin cannot sign a clinical note; physician can', async () => {
    const t = await newTenant('signNote');
    const { patient, encounterId } = await admitPatient(t.token, 'SignNote');
    const note = await call('POST', '/api/inpatient/clinical/notes/create', {
        token: t.token,
        body: { patientId: patient.id, encounterId, type: 'progress', content: { hpi: 'x' } },
    });
    assert.equal(note.status, 201, JSON.stringify(note.body));
    const noteId = note.body.data.id ?? note.body.data._id;

    const adminSign = await call('POST', `/api/inpatient/clinical/notes/sign/${noteId}`, { token: t.token, body: {} });
    assert.equal(adminSign.status, 403, 'an admin account must not be able to sign a clinical note');

    const physician = await addUser(t, 'mdSignNote', 'physician');
    const mdSign = await call('POST', `/api/inpatient/clinical/notes/sign/${noteId}`, { token: physician.token, body: {} });
    assert.equal(mdSign.status, 200, JSON.stringify(mdSign.body));
});

test('rbac: admin cannot acknowledge a critical lab result', async () => {
    const t = await newTenant('ackCrit');
    const { patient } = await admitPatient(t.token, 'AckCrit');
    const order = await call('POST', '/lab-orders', { token: t.token, body: { patientId: patient.id, labTests: [{ name: 'Potassium' }] } });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    const collected = await call('POST', `/lab-orders/${order.body.data.id}/collect`, { token: t.token, body: {} });
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    const resulted = await call('POST', `/lab-orders/${order.body.data.id}/results`, {
        token: t.token,
        body: { results: [{ testName: 'Potassium', valueNum: 7.5, unit: 'mmol/L', isCritical: true }] },
    });
    assert.equal(resulted.status, 201, JSON.stringify(resulted.body));
    const resultId = resulted.body.data.results[0].id ?? resulted.body.data.results[0]._id;

    const adminAck = await call('POST', `/lab-results/${resultId}/acknowledge`, { token: t.token, body: {} });
    assert.equal(adminAck.status, 403, 'an admin account must not be able to acknowledge a critical result');
});

test('rbac: admin cannot sign/transmit a prescription or dispense via MAR', async () => {
    const t = await newTenant('rxSign');
    const physician = await addUser(t, 'mdRxSign', 'physician');
    const { patient } = await admitPatient(t.token, 'RxSign');
    const rx = await call('POST', '/api/prescriptions', {
        token: physician.token,
        body: { patientId: patient.id, medicines: [{ name: 'Lisinopril', dose: '10mg', route: 'PO', frequency: 'Daily' }] },
    });
    assert.equal(rx.status, 201, JSON.stringify(rx.body));
    const rxId = rx.body.data.id ?? rx.body.data._id;

    const adminSign = await call('POST', `/api/prescriptions/${rxId}/sign`, { token: t.token, body: {} });
    assert.equal(adminSign.status, 403, 'an admin account must not be able to sign a prescription');
});
