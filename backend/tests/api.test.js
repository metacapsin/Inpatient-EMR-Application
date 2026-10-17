// Integration tests against the real PostgreSQL database in DATABASE_URL.
// Each run creates its own tenants (via /auth/register) and deletes them at the end, so seeded data is untouched.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const suffix = Date.now().toString(36);

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
    try { json = await res.json(); } catch { /* empty body */ }
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

test('health endpoints and auth gate', async () => {
    assert.equal((await call('GET', '/health')).body.status, 'ok');
    const db = await call('GET', '/health/db');
    assert.equal(db.status, 200);
    assert.equal(db.body.database, 'connected');
    assert.equal((await call('GET', '/Wards/getWardList')).status, 401);
    assert.equal((await call('GET', '/Wards/getWardList', { token: 'garbage' })).status, 401);
});

test('auth: login, refresh rotation, bad credentials, password reset validation', async () => {
    const a = await newTenant('auth');
    assert.equal(a.role, 'admin');
    const bad = await call('POST', '/login', { body: { username: a.email, password: 'wrong-password' } });
    assert.equal(bad.status, 401);
    const login = await call('POST', '/login', { body: { username: a.email, password: a.password } });
    assert.equal(login.status, 200);
    assert.ok(login.body.token && login.body.refreshToken && login.body.user.tenant.id);

    const r1 = await call('POST', '/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
    assert.equal(r1.status, 200);
    assert.notEqual(r1.body.refreshToken, login.body.refreshToken);
    // Rotated token cannot be reused.
    assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: login.body.refreshToken } })).status, 401);

    assert.equal((await call('POST', '/forgotPassword', { body: { email: 'nobody@nowhere.example' } })).status, 200);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: 'x', newPassword: 'short', confirmPassword: 'short' } })).status, 400);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: 'bogus', newPassword: 'longenough1', confirmPassword: 'longenough1' } })).status, 400);

    const profile = await call('PUT', '/auth/profile', { token: login.body.token, body: { firstName: 'Ada', lastName: 'Lovelace' } });
    assert.equal(profile.body.data.firstName, 'Ada');
});

test('role enforcement: nurse cannot manage facility, admin can', async () => {
    const t = await newTenant('roles');
    const mk = await call('POST', '/auth/register-user', { token: t.token, body: { email: `nurse-${suffix}@test.example`, password: 'Nurse-passw0rd', role: 'nurse', firstName: 'N' } });
    assert.equal(mk.status, 201);
    const nurse = await call('POST', '/login', { body: { username: `nurse-${suffix}@test.example`, password: 'Nurse-passw0rd' } });
    assert.equal(nurse.body.role, 'nurse');
    assert.equal((await call('POST', '/Wards/CreateWard', { token: nurse.body.token, body: { name: 'X' } })).status, 403);
    assert.equal((await call('POST', '/Wards/CreateWard', { token: t.token, body: { name: 'X' } })).status, 201);
    assert.equal((await call('GET', '/tenants/users', { token: nurse.body.token })).status, 403);
});

test('facility CRUD, patients, ADT flow and bed board', async () => {
    const t = await newTenant('adt');
    const tk = t.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'ICU', wardName: 'ICU', code: 'ICU' } })).body.data;
    assert.equal(ward.wardName, 'ICU');
    assert.equal((await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'ICU' } })).status, 409, 'duplicate ward name');
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '101', roomType: 'ICU' } })).body.data;
    const bed1 = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'Bed-1' } })).body.data;
    const bed2 = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'Bed-2' } })).body.data;
    assert.equal((await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: 'nope', bedLabel: 'Z' } })).status, 404);

    const upd = await call('PUT', '/Wards/updateWardById', { token: tk, body: { id: ward.id, wardName: 'ICU East' } });
    assert.equal(upd.body.data.wardName, 'ICU East');

    // patients
    assert.equal((await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: '', lastName: 'x' } })).status, 400);
    const p1 = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Jane', lastName: 'Doe', dOB: '1950-02-01', sex: 'F' } })).body.data;
    const p2 = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'John', lastName: 'Roe', dOB: '2015-06-01', sex: 'M' } })).body.data;
    assert.match(p1.mrn, /^MRN/);
    const list = await call('GET', '/Patient/getAllPatientListPaginated?page=1&limit=1&sortField=createdOn&sortOrder=desc', { token: tk });
    assert.equal(list.body.data.total, 2);
    assert.equal(list.body.data.items.length, 1);
    const search = await call('GET', '/Patient/getAllPatientListPaginated?query=jane', { token: tk });
    assert.equal(search.body.data.items.length, 1);
    const seniors = await call('GET', '/Patient/getAllPatientListPaginated?ageRange=65%2B', { token: tk });
    assert.deepEqual(seniors.body.data.items.map((p) => p.firstName), ['Jane']);
    // injection attempt in sort/search is inert
    const inj = await call('GET', "/Patient/getAllPatientListPaginated?sortField=mrn;DROP TABLE patients&query=' OR 1=1 --", { token: tk });
    assert.equal(inj.status, 200);
    assert.equal(inj.body.data.items.length, 0);

    // admit
    const admit = await call('POST', '/api/admissions', { token: tk, body: { patientId: p1.id, bedId: bed1.id, admissionType: 'emergency', diagnosis: 'Pneumonia' } });
    assert.equal(admit.status, 201, JSON.stringify(admit.body));
    const encId = admit.body.data.encounter.id;
    assert.equal((await call('POST', '/api/admissions', { token: tk, body: { patientId: p1.id, bedId: bed2.id } })).status, 409, 'patient already admitted');
    assert.equal((await call('POST', '/api/admissions', { token: tk, body: { patientId: p2.id, bedId: bed1.id } })).status, 409, 'bed occupied');
    assert.equal((await call('DELETE', `/Beds/deleteBedById/${bed1.id}`, { token: tk })).status, 409, 'cannot delete occupied bed');

    const board = (await call('GET', '/Beds/getLiveBedBoard', { token: tk })).body.data;
    assert.equal(board.summary.totalBeds, 2);
    assert.equal(board.summary.byStatus.occupied, 1);
    assert.equal(board.rows.find((r) => r.bed.id === bed1.id).patient.displayName, 'Jane Doe');
    const beds = (await call('GET', '/Beds/getBedList', { token: tk })).body.data;
    assert.equal(beds.find((b) => b.id === bed1.id).patientId, p1.id);
    const pOne = (await call('GET', `/Patient/getPatientById/${p1.id}`, { token: tk })).body.data;
    assert.equal(pOne.bed, 'Bed-1');
    assert.equal(pOne.ward, 'ICU East');

    const active = (await call('GET', `/api/admissions/active?patientId=${p1.id}`, { token: tk })).body.data;
    assert.equal(active.length, 1);

    // transfer
    const tr = await call('POST', '/api/transfers', { token: tk, body: { encounterId: encId, newBedId: bed2.id, reason: 'step-down' } });
    assert.equal(tr.status, 200, JSON.stringify(tr.body));
    assert.equal(tr.body.data.currentBedId, bed2.id);
    const board2 = (await call('GET', '/Beds/getLiveBedBoard', { token: tk })).body.data;
    assert.equal(board2.rows.find((r) => r.bed.id === bed1.id).bed.bedStatus, 'available');

    // discharge: confirm before initiate is rejected
    assert.equal((await call('POST', '/api/discharges/confirm', { token: tk, body: { encounterId: encId } })).status, 409);
    assert.equal((await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId: encId, disposition: 'Home' } })).status, 200);
    const conf = await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: encId } });
    assert.equal(conf.status, 200);
    assert.equal(conf.body.data.patientId, p1.id);
    assert.equal((await call('GET', '/api/admissions/active', { token: tk })).body.data.length, 0);
    assert.equal((await call('GET', '/Beds/getLiveBedBoard', { token: tk })).body.data.summary.byStatus.available, 2);

    // patient soft delete, facility delete
    assert.equal((await call('DELETE', `/Patient/deletePatientById/${p2.id}`, { token: tk })).status, 200);
    assert.equal((await call('GET', '/Patient/getAllPatientListPaginated?status=false', { token: tk })).body.data.total, 1);
    assert.equal((await call('DELETE', `/Wards/deleteWardById/${ward.id}`, { token: tk })).status, 200);
    assert.equal((await call('GET', '/Beds/getBedList', { token: tk })).body.data.length, 0, 'cascade delete');
});

test('visitors, family contacts and vitals', async () => {
    const t = await newTenant('vis');
    const tk = t.token;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Vi', lastName: 'Sitor' } })).body.data;

    const v = (await call('POST', '/Visitors/CreateVisitor', { token: tk, body: { patientId: p.id, firstName: 'Eleanor', checkInAt: new Date().toISOString(), checkOutAt: '', restrictions: '', status: 'checked-in' } })).body.data;
    assert.equal(v.checkOutAt, null);
    const upd = await call('PUT', '/Visitors/updateVisitorById', { token: tk, body: { id: v.id, patientId: p.id, firstName: 'Eleanor', checkInAt: v.checkInAt, checkOutAt: new Date().toISOString(), status: 'checked-out' } });
    assert.equal(upd.body.data.status, 'checked-out');
    assert.ok(upd.body.data.checkOutAt);
    assert.equal((await call('GET', `/Visitors/getVisitorList?patientId=${p.id}`, { token: tk })).body.data.length, 1);
    assert.equal((await call('DELETE', `/Visitors/deleteVisitorById/${v.id}`, { token: tk })).status, 200);
    assert.equal((await call('GET', `/Visitors/getVisitorList?patientId=${p.id}`, { token: tk })).body.data.length, 0);

    const fam = (await call('POST', '/PatientFamily/CreateFamilyContact', { token: tk, body: { patientId: p.id, firstName: 'Tom', lastName: '', mobilePhone: '555', emailAddress: '', relationship: 'Son', isEmergencyContact: true, isAuthorizedForInfo: true, status: true } })).body.data;
    assert.equal(fam.isEmergencyContact, true);
    assert.equal((await call('POST', '/PatientFamily/CreateFamilyContact', { token: tk, body: { patientId: p.id, firstName: 'X', emailAddress: 'not-an-email' } })).status, 400);
    await call('PUT', '/PatientFamily/updateFamilyContactById', { token: tk, body: { id: fam.id, patientId: p.id, firstName: 'Tommy', relationship: 'Son', isEmergencyContact: false } });
    assert.equal((await call('GET', `/PatientFamily/getFamilyContactList?patientId=${p.id}`, { token: tk })).body.data[0].firstName, 'Tommy');
    assert.equal((await call('DELETE', `/PatientFamily/deleteFamilyContactById/${fam.id}`, { token: tk })).status, 200);

    // vitals
    const add = (metricType, valuePrimary, extra = {}) => call('POST', '/api/health/metrics/add', { token: tk, body: { patientId: p.id, metricType, valuePrimary, unit: 'u', ...extra } });
    assert.equal((await add('blood_pressure', 120, { valueSecondary: 80 })).status, 201);
    assert.equal((await add('heart_rate', 72)).status, 201);
    assert.equal((await add('heart_rate', 90)).status, 201);
    assert.equal((await add('bogus_type', 1)).status, 400);
    const latest = (await call('GET', `/api/health/metrics/latest?patientId=${p.id}`, { token: tk })).body.data;
    assert.equal(latest.blood_pressure.valueSecondary, 80);
    assert.equal(latest.heart_rate.valuePrimary, 90);
    const trend = (await call('GET', `/api/health/metrics/trend?patientId=${p.id}&metricType=heart_rate&period=30`, { token: tk })).body.data.trends;
    assert.equal(trend[0].avgPrimary, 81);
    assert.equal((await call('GET', `/api/health/metrics/patient/${p.id}`, { token: tk })).body.data.length, 3);
});

test('care plan, I/O, consents, flowsheet, HAI', async () => {
    const t = await newTenant('clin');
    const tk = t.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'W' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '1' } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'B' } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Cli', lastName: 'Nical' } })).body.data;
    const enc = (await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id } })).body.data.encounter.id;

    // care plan
    const none = (await call('GET', `/api/CarePlan/${enc}`, { token: tk })).body.data;
    assert.equal(none.version, 0);
    const dx = { nandaCode: '00146', nandaLabel: 'Risk for Falls', goals: [{ statement: 'No falls', targetDate: '2099-01-01' }], interventions: [{ text: 'Bed alarm' }] };
    assert.equal((await call('POST', '/api/CarePlan/create', { token: tk, body: { patientId: p.id, encounterId: enc, diagnoses: [] } })).status, 400);
    assert.equal((await call('POST', '/api/CarePlan/create', { token: tk, body: { patientId: p.id, encounterId: enc, diagnoses: [{ ...dx, goals: [{ statement: 'old', targetDate: '2000-01-01' }] }] } })).status, 400, 'past target date');
    const plan = await call('POST', '/api/CarePlan/create', { token: tk, body: { patientId: p.id, encounterId: enc, diagnoses: [dx] } });
    assert.equal(plan.status, 201, JSON.stringify(plan.body));
    assert.equal((await call('POST', '/api/CarePlan/create', { token: tk, body: { patientId: p.id, encounterId: enc, diagnoses: [dx] } })).status, 409);
    const planId = plan.body.data.id;
    const goal = plan.body.data.diagnoses[0].goals[0];
    const gs = await call('PUT', `/api/CarePlan/${planId}/goalStatus`, { token: tk, body: { diagnosisId: plan.body.data.diagnoses[0].id, goalId: goal.id, status: 'Met', evaluationNote: 'done' } });
    assert.equal(gs.body.data.diagnoses[0].goals[0].status, 'Met');
    assert.equal(gs.body.data.version, 2);
    const up = await call('PUT', `/api/CarePlan/${planId}`, { token: tk, body: { encounterId: enc, diagnoses: gs.body.data.diagnoses, interdisciplinaryNotes: 'rounds ok' } });
    assert.equal(up.body.data.version, 3);
    assert.equal(up.body.data.interdisciplinaryNotes, 'rounds ok');
    assert.equal((await call('PUT', `/api/CarePlan/${planId}`, { token: tk, body: { encounterId: 'other' } })).status, 403);
    assert.ok((await call('GET', '/api/CarePlan/nanda/search?q=falls', { token: tk })).body.data.length >= 0);

    // I/O
    const now = new Date().toISOString();
    const io = (b) => call('POST', '/api/IORecord/add', { token: tk, body: { patientId: p.id, encounterId: enc, recordedAt: now, ...b } });
    assert.equal((await io({ recordType: 'Intake', intakeCategory: 'IV', fluidType: 'NS', volumeMl: 1000 })).status, 201);
    assert.equal((await io({ recordType: 'Output', outputCategory: 'Urine', volumeMl: 400 })).status, 201);
    assert.equal((await io({ recordType: 'Output', outputCategory: 'Urine', volumeMl: -5 })).status, 400);
    const bal = (await call('GET', `/api/IORecord/balance/${enc}`, { token: tk })).body.data;
    assert.equal(bal.balance24hMl, 600);
    assert.equal(bal.urineOutputLastHourMl, 400);
    assert.equal((await call('GET', `/api/IORecord/timeline/${enc}`, { token: tk })).body.data.length, 2);

    // consents
    const consent = (type, extra = {}) => ({
        patientId: p.id, encounterId: enc, consentType: type, procedureName: null, templateVersion: 'v1', templateS3Key: null, signedByType: 'Patient', signedByName: 'Cli Nical',
        signedByRelationship: null, patientHasCapacity: true, interpreterUsed: false, interpreterName: null, languageUsed: 'English', patientSignatureData: null, witnessSignatureData: null,
        witnessId: null, witnessName: null, signedAt: null, status: 'Pending', expiryDate: null, revokedAt: null, revokedReason: null, signedPdfS3Key: null, obtainedBy: null, obtainedByName: null, ...extra,
    });
    let comp = (await call('GET', `/api/Consent/completeness/${enc}`, { token: tk })).body;
    assert.deepEqual(comp.missing, ['General Treatment', 'HIPAA NPP']);
    const c1 = (await call('POST', '/api/Consent/create', { token: tk, body: consent('General Treatment') })).body;
    const c2 = (await call('POST', '/api/Consent/create', { token: tk, body: consent('HIPAA NPP') })).body;
    assert.equal(c1.status, 'Pending');
    const sign = { patientSignatureData: 'data:image/png;base64,AAAA', witnessSignatureData: 'data:image/png;base64,BBBB', witnessId: 'w1', witnessName: 'Wit', signedAt: now };
    assert.equal((await call('PUT', `/api/Consent/${c1.consentId}/sign`, { token: tk, body: sign })).body.status, 'Signed');
    assert.equal((await call('PUT', `/api/Consent/${c1.consentId}/sign`, { token: tk, body: sign })).status, 409, 'cannot re-sign');
    await call('PUT', `/api/Consent/${c2.consentId}/sign`, { token: tk, body: sign });
    assert.equal((await call('GET', `/api/Consent/completeness/${enc}`, { token: tk })).body.complete, true);
    assert.equal((await call('PUT', `/api/Consent/${c2.consentId}/revoke`, { token: tk, body: { revokedReason: '' } })).status, 400);
    assert.equal((await call('PUT', `/api/Consent/${c2.consentId}/revoke`, { token: tk, body: { revokedReason: 'patient request' } })).body.status, 'Revoked');
    assert.deepEqual((await call('GET', `/api/Consent/completeness/${enc}`, { token: tk })).body.missing, ['HIPAA NPP']);
    assert.equal((await call('GET', `/api/Consent/encounter/${enc}`, { token: tk })).body.data.length, 2);
    const right = await call('POST', '/api/PatientRights/request', { token: tk, body: { patientId: p.id, requestType: 'Access Request', access: { requestType: 'Records', status: 'Pending' } } });
    assert.equal(right.status, 201);
    assert.equal((await call('GET', `/api/PatientRights/${p.id}`, { token: tk })).body.data.length, 1);

    // flowsheet
    const fs = { patientId: p.id, encounterId: enc, shiftDate: '2026-05-13', shiftType: 'Day', neurological: { loc: 'Alert' }, pain: { score: 3 }, signedBy: null, signedAt: null };
    assert.equal((await call('GET', `/api/NursingFlowsheet/${enc}`, { token: tk })).status, 404);
    const f1 = (await call('POST', '/api/NursingFlowsheet/save', { token: tk, body: fs })).body.data;
    assert.equal(f1.version, 1);
    const f2 = (await call('POST', '/api/NursingFlowsheet/save', { token: tk, body: { ...fs, pain: { score: 5 } } })).body.data;
    assert.equal(f2.version, 2);
    assert.equal(f2.id, f1.id, 'upsert per shift');
    const signed = await call('POST', '/api/NursingFlowsheet/save', { token: tk, body: { ...fs, signedBy: 'me', signedAt: now } });
    assert.equal(signed.body.data.chartStatus, 'signed');
    assert.equal((await call('POST', '/api/NursingFlowsheet/save', { token: tk, body: fs })).status, 409, 'signed chart is locked');
    assert.equal((await call('POST', '/api/NursingFlowsheet/save', { token: tk, body: { ...fs, isAmended: true, signedAt: now } })).status, 400, 'amendment needs a reason');
    assert.equal((await call('GET', `/api/NursingFlowsheet/${enc}`, { token: tk })).body.pain.score, 3);
    assert.equal((await call('GET', `/api/NursingFlowsheet/history/${enc}`, { token: tk })).body.length, 3);

    // HAI
    assert.equal((await call('POST', '/api/HAIEvent', { token: tk, body: { encounterId: enc, unitId: ward.id, eventType: 'infection_detected', infectionType: 'CLABSI', severity: 'high' } })).status, 201);
    const sum = (await call('GET', `/api/HAIEvent/summary/${ward.id}`, { token: tk })).body.data;
    assert.equal(sum.totalActiveInfections, 1);
    assert.equal(sum.highSeverityCases, 1);
    assert.equal((await call('GET', `/api/HAIEvent/encounter/${enc}`, { token: tk })).body.data.length, 1);
});

test('medication management, CDI and denials', async () => {
    const t = await newTenant('med');
    const tk = t.token;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Med', lastName: 'Patient' } })).body.data;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'W' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '1' } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'B' } })).body.data;
    const enc = (await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id } })).body.data.encounter.id;

    const med = (await call('POST', `/api/patients/${p.id}/medications`, { token: tk, body: { name: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily' } })).body.data;
    assert.equal((await call('GET', `/api/patients/${p.id}/medications`, { token: tk })).body.data.length, 1);
    const sched = new Date(Date.now() + 3600e3).toISOString();
    const given = new Date().toISOString();
    const mar = await call('POST', '/api/mar', { token: tk, body: { patientId: p.id, medicationId: med.id, scheduledTime: sched, givenTime: given, givenBy: 'RN Priya', status: 'given' } });
    assert.equal(mar.body.data[0].medicationName, 'Lisinopril');
    assert.equal(mar.body.data[0].status, 'given');
    assert.equal((await call('POST', '/api/mar', { token: tk, body: { patientId: p.id, medicationId: med.id, scheduledTime: 'not-a-date', givenTime: given, givenBy: 'x', status: 'given' } })).status, 400);

    const prn = await call('POST', '/api/prn-stat', { token: tk, body: { patientId: p.id, medicationName: 'Morphine', type: 'STAT', indication: 'Severe pain', orderedTime: given, givenBy: 'Dr. X' } });
    assert.equal(prn.status, 201);
    assert.equal((await call('GET', `/api/prn-stat/${p.id}`, { token: tk })).body.data[0].type, 'STAT');

    const rx = (await call('POST', '/api/prescriptions', { token: tk, body: { patientId: p.id, medicines: [{ medicineId: 'm1', name: 'Amox', quantityOrdered: 10, unitPrice: 2.5 }] } })).body.data;
    const line = { medicineId: 'm1', quantityDispensed: 10, batchNumber: 'B1', expiryDate: '2099-01-01', unitPrice: 2.5 };
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx.prescriptionId, medicines: [{ ...line, quantityDispensed: 11 }], dispensedBy: 'Pharm', totalCost: 27.5 } })).status, 400, 'over-dispense');
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx.prescriptionId, medicines: [line], dispensedBy: 'Pharm', totalCost: 1 } })).status, 400, 'total mismatch');
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx.prescriptionId, medicines: [line], dispensedBy: 'Pharm', totalCost: 25 } })).body.data.ok, true);
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx.prescriptionId, medicines: [line], dispensedBy: 'Pharm', totalCost: 25 } })).status, 409, 'double dispense');
    assert.equal((await call('GET', `/api/prescriptions/${p.id}`, { token: tk })).body.data.length, 0);

    const dm = { medications: [{ name: 'Aspirin', dose: '81 mg', frequency: 'Daily', duration: '30d', instructions: 'with food' }], preparedBy: 'RN', reviewedBy: 'MD', counsellingDone: true };
    assert.equal((await call('GET', `/api/discharges/${enc}/medications`, { token: tk })).body.data.medications.length, 0);
    await call('POST', `/api/discharges/${enc}/medications`, { token: tk, body: dm });
    const dm2 = await call('POST', `/api/discharges/${enc}/medications`, { token: tk, body: { ...dm, counsellingDone: false } });
    assert.equal(dm2.body.data.counsellingDone, false);
    assert.equal((await call('GET', `/api/discharges/${enc}/medications`, { token: tk })).body.data.medications[0].name, 'Aspirin');
    await call('POST', '/api/discharge', { token: tk, body: { ...dm, patientId: p.id } });
    assert.equal((await call('GET', `/api/discharge/${p.id}`, { token: tk })).body.data.preparedBy, 'RN');

    // CDI
    const cdi = (await call('POST', '/api/CDI/query/create', {
        token: tk,
        body: { encounterId: enc, patientId: p.id, patientName: 'Med Patient', queryType: 'CC/MCC Capture', clinicalScenario: 's', questionToPhysician: 'q?', optionsProvided: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], sentTo: 'Dr', sentToPhysicianId: 'phys1', currentDrg: '194', potentialDrg: '193', revenueOpportunity: 4000 },
    })).body.data;
    assert.equal(cdi.queryStatus, 'Open');
    assert.equal((await call('PUT', `/api/CDI/query/${cdi.queryId}/send`, { token: tk, body: { queryType: 'CC/MCC Capture', clinicalScenario: 's', questionToPhysician: 'q?', optionsProvided: [{ id: 'a', text: 'A' }], sentToPhysicianId: 'phys1' } })).body.data.queriesSent, 1);
    assert.equal((await call('GET', '/api/CDI/query/inbox/phys1', { token: tk })).body.data.length, 1);
    assert.equal((await call('PUT', `/api/CDI/query/${cdi.queryId}/answer`, { token: tk, body: { selectedOptionId: 'zzz' } })).status, 400);
    assert.equal((await call('PUT', `/api/CDI/query/${cdi.queryId}/answer`, { token: tk, body: { selectedOptionId: 'a', physicianResponse: 'yes' } })).body.data.responseLocked, true);
    assert.equal((await call('PUT', `/api/CDI/query/${cdi.queryId}/answer`, { token: tk, body: { selectedOptionId: 'a' } })).status, 409);
    assert.equal((await call('PUT', `/api/CDI/query/${cdi.queryId}/close`, { token: tk })).body.data.queryStatus, 'Closed');
    assert.equal((await call('GET', `/api/CDI/worklist/${t.user.tenant.id}`, { token: tk })).body.data.length, 1);

    // Denials
    const den = (await call('POST', '/api/Denial/create', { token: tk, body: { claimNumber: 'C1', patientId: p.id, patientName: 'Med Patient', dateOfService: '2026-03-01', payer: 'Aetna', billedAmount: 1000, deniedAmount: 400, denialCode: 'CO-4', denialReason: 'x', category: 'Coding', appealDeadline: '2026-06-01' } })).body.data;
    assert.equal(den.status, 'New');
    assert.equal((await call('POST', '/api/Denial/create', { token: tk, body: { claimNumber: 'C2', patientId: p.id, dateOfService: '2026-03-01', payer: 'A', billedAmount: 10, deniedAmount: 400, denialCode: 'X', category: 'Coding' } })).status, 400, 'denied > billed');
    const ap = (await call('POST', `/api/Denial/${den.denialId}/appeal`, { token: tk, body: { appealLevel: 'First Level', appealType: 'Written', appealLetter: 'please', outcome: 'Approved', approvedAmount: 400 } })).body.data;
    assert.equal(ap.status, 'Appealed');
    const an = (await call('GET', `/api/Denial/analytics/${t.user.tenant.id}`, { token: tk })).body.data;
    assert.equal(an.appealOverturnRatePercent, 100);
    assert.equal(an.denialRateByPayer[0].ratePercent, 40);
    assert.equal((await call('PUT', `/api/Denial/${den.denialId}/writeoff`, { token: tk, body: { writeOffAmount: 999, writeOffApprovedBy: 'Mgr' } })).status, 400);
    assert.equal((await call('PUT', `/api/Denial/${den.denialId}/writeoff`, { token: tk, body: { writeOffAmount: 100, writeOffApprovedBy: 'Mgr' } })).body.data.status, 'Written Off');
    assert.equal((await call('POST', `/api/Denial/${den.denialId}/appeal`, { token: tk, body: { appealLevel: 'First Level', appealType: 'Written' } })).status, 409);
});

test('tenant isolation: another tenant cannot see or touch the data', async () => {
    const a = await newTenant('isoA');
    const b = await newTenant('isoB');
    const p = (await call('POST', '/Patient/createPatient', { token: a.token, body: { firstName: 'Secret', lastName: 'Patient' } })).body.data;
    assert.equal((await call('GET', `/Patient/getPatientById/${p.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', '/Patient/getAllPatientListPaginated', { token: b.token })).body.data.total, 0);
    assert.equal((await call('POST', '/Visitors/CreateVisitor', { token: b.token, body: { patientId: p.id, firstName: 'Spy' } })).status, 404);
    assert.equal((await call('POST', '/api/health/metrics/add', { token: b.token, body: { patientId: p.id, metricType: 'heart_rate', valuePrimary: 1 } })).status, 404);
    assert.equal((await call('GET', `/api/health/metrics/patient/${p.id}`, { token: b.token })).body.data.length, 0);
    assert.equal((await call('GET', '/tenants/users', { token: b.token })).body.data.length, 1);
});

test('IPD dashboard and notifications', async () => {
    const a = await newTenant('dash');
    const mk = await call('POST', '/auth/register-user', { token: a.token, body: { email: `n2-${suffix}@test.example`, password: 'Nurse-passw0rd', role: 'nurse' } });
    assert.equal(mk.status, 201);
    const nurse = await call('POST', '/login', { body: { username: `n2-${suffix}@test.example`, password: 'Nurse-passw0rd' } });
    const tk = a.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'W1' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '7' } })).body.data;
    const b1 = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'A' } })).body.data;
    await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'B' } });
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Dash', lastName: 'Board' } })).body.data;
    const enc = (await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: b1.id } })).body.data.encounter.id;

    const d = (await call('GET', '/dashboard/ipd', { token: tk })).body.data;
    assert.deepEqual(d.kpis, { totalAdmittedPatients: 1, occupiedBeds: 1, availableBeds: 1, dischargedToday: 0 });
    assert.equal(d.bedBoard.find((r) => r.encounterId === enc).patientName, 'Dash Board');

    // The nurse (not the actor) was notified of the admission; the admin (actor) was not.
    const notes = (await call('GET', '/notifications', { token: nurse.body.token })).body.data;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].action, 'admitted');
    assert.equal((await call('GET', '/notifications', { token: tk })).body.data.length, 0);
    assert.equal((await call('PUT', `/notifications/${notes[0]._id}/read`, { token: tk })).status, 404, 'not another user\'s notification');
    assert.equal((await call('PUT', `/notifications/${notes[0]._id}/read`, { token: nurse.body.token })).body.data.isRead, true);
    assert.equal((await call('DELETE', `/notifications/${notes[0]._id}`, { token: nurse.body.token })).status, 200);
    assert.equal((await call('GET', '/notifications', { token: nurse.body.token })).body.data.length, 0);

    await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId: enc } });
    await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: enc } });
    assert.equal((await call('GET', '/dashboard/ipd', { token: tk })).body.data.kpis.dischargedToday, 1);
});

async function addUser(admin, label, role) {
    const email = `${label}-${suffix}@test.example`;
    const mk = await call('POST', '/auth/register-user', { token: admin.token, body: { email, password: 'Staff-passw0rd', role, firstName: label, lastName: 'User' } });
    assert.equal(mk.status, 201, JSON.stringify(mk.body));
    const login = await call('POST', '/login', { body: { username: email, password: 'Staff-passw0rd' } });
    assert.equal(login.status, 200);
    return { token: login.body.token, id: login.body.user.id ?? login.body.user._id };
}

test('appointments: dropdowns, slots, conflicts, CRUD, filters, tenant isolation', async () => {
    const a = await newTenant('appt');
    const doc = await addUser(a, 'docappt', 'physician');
    const nurse = await addUser(a, 'nurseappt', 'nurse');
    const tk = a.token;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Ann', lastName: 'Booker' } })).body.data;

    // Admin-only setup data.
    assert.equal((await call('POST', '/ServiceLocation/createServiceLocation', { token: nurse.token, body: { name: 'X' } })).status, 403);
    const loc = (await call('POST', '/ServiceLocation/createServiceLocation', { token: tk, body: { name: 'Main Clinic' } })).body.data;
    assert.equal((await call('POST', '/ServiceLocation/createServiceLocation', { token: tk, body: { name: 'Main Clinic' } })).status, 409, 'duplicate location');
    const vt = (await call('POST', '/VisitType/createVisitType', { token: tk, body: { visitReasonName: 'Follow-up', duration: 45 } })).body.data;
    assert.equal(vt.duration, 45);

    const provs = (await call('GET', '/ProviderProfile/getProviderList', { token: tk })).body.data;
    assert.equal(provs.length, 1);
    assert.equal(provs[0].id, doc.id);
    const users = (await call('POST', '/setting/getDropdownListData', { token: tk, body: { listName: 'users', sortBy: 'firstName' } })).body.data;
    assert.ok(users.find((u) => u.id === doc.id).role.includes('provider'));
    assert.equal((await call('POST', '/setting/getDropdownListData', { token: tk, body: { listName: 'patient-details', sortBy: 'fullName' } })).body.data[0].fullName, 'Ann Booker');
    assert.equal((await call('POST', '/setting/getDropdownListData', { token: tk, body: { listName: 'bogus' } })).status, 400);
    assert.equal((await call('GET', '/CalendarSetting/getGeneralCalendarSetting', { token: tk })).body.data.slotMinutes, 30);
    assert.equal((await call('PUT', '/CalendarSetting/updateGeneralCalendarSetting', { token: tk, body: { startHour: 8, endHour: 6 } })).status, 400);
    assert.equal((await call('PUT', '/CalendarSetting/updateGeneralCalendarSetting', { token: tk, body: { startHour: 8, slotMinutes: 15 } })).body.data.slotMinutes, 15);

    // Provider hours: Monday only, 09:00-10:00, 30 min slots.
    assert.equal((await call('GET', `/CalendarSetting/getProviderServiceLocations/${doc.id}`, { token: tk })).body.data.length, 0);
    assert.equal((await call('PUT', '/CalendarSetting/saveProviderCalendarSetting', { token: tk, body: { providerId: doc.id, serviceLocationId: loc.id, weeklyHours: { monday: { start: '10:00', end: '09:00' } } } })).status, 400);
    await call('PUT', '/CalendarSetting/saveProviderCalendarSetting', { token: tk, body: { providerId: doc.id, serviceLocationId: loc.id, slotMinutes: 30, weeklyHours: { monday: { start: '09:00', end: '10:00' } } } });
    assert.equal((await call('GET', `/CalendarSetting/getProviderServiceLocations/${doc.id}`, { token: tk })).body.data[0].name, 'Main Clinic');

    const slotReq = (date) => call('POST', '/Appointment/getProviderAvailableSlots', { token: tk, body: { providerId: doc.id, serviceLocationId: loc.id, date } });
    assert.deepEqual((await slotReq('06/01/2099')).body.data, ['09:00 AM', '09:30 AM']); // 2099-06-01 is a Monday
    assert.deepEqual((await slotReq('06/02/2099')).body.data, [], 'Tuesday: not working');
    assert.equal((await slotReq('13/45/2099')).status, 400);

    const body = { patientId: p.id, providerId: doc.id, serviceLocationId: loc.id, visitReasonId: vt.id, visitReasonmsg: 'Follow-up', startDate: '06/01/2099', startTime: '09:00 AM', duration: 30, visitMode: 'Office Visit', note: 'n' };
    assert.equal((await call('POST', '/Appointment/createAppointment', { token: tk, body: { ...body, startTime: '25:99' } })).status, 400);
    assert.equal((await call('POST', '/Appointment/createAppointment', { token: tk, body: { ...body, patientId: 'nope' } })).status, 404);
    const c1 = await call('POST', '/Appointment/createAppointment', { token: nurse.token, body });
    assert.equal(c1.status, 201, JSON.stringify(c1.body));
    const appt = c1.body.data;
    assert.equal(appt.startDate, '06/01/2099');
    assert.equal(appt.startTime, '09:00 AM');
    assert.equal(appt.endTime, '09:30 AM');
    assert.equal(appt.patientName, 'Ann Booker');
    assert.equal(appt.appointmentStatus, 'Scheduled');
    assert.equal((await call('POST', '/Appointment/createAppointment', { token: tk, body: { ...body, startTime: '9:15' } })).status, 409, 'overlap');
    assert.deepEqual((await slotReq('2099-06-01')).body.data, ['09:30 AM'], 'booked slot disappears');
    const cf = (await call('POST', '/Appointment/conflict', { token: tk, body: { providerId: doc.id, startDate: '06/01/2099', startTime: '09:00 AM', duration: 30 } })).body.data;
    assert.equal(cf.hasConflict, true);
    assert.equal((await call('POST', '/Appointment/conflict', { token: tk, body: { providerId: doc.id, startDate: '06/01/2099', startTime: '09:00 AM', duration: 30, appointmentId: appt.id } })).body.data.hasConflict, false);

    const upd = await call('PUT', '/Appointment/updateAppointment', { token: tk, body: { ...body, _id: appt.id, startTime: '09:30 AM', note: 'moved' } });
    assert.equal(upd.body.data.startTime, '09:30 AM');
    assert.equal(upd.body.data.note, 'moved');
    assert.equal((await call('GET', `/Appointment/getAppointmentById/${appt.id}`, { token: tk })).body.data.providerName, 'docappt User');
    assert.equal((await call('GET', `/Appointment/getAppointmentListByPatientId/${p.id}`, { token: tk })).body.data.length, 1);

    const list = (payload) => call('POST', '/Appointment/getAppointmentListPaginated', { token: tk, body: payload });
    const l = (await list({ fromDate: '2099-06-01', toDate: '2099-06-30', page: 1, limit: 10, sortField: 'startDate', sortOrder: 'asc' })).body.data;
    assert.equal(l.items.length, 1);
    assert.equal(l.pagination.total, 1);
    assert.equal((await list({ fromDate: '2098-01-01', toDate: '2098-12-31' })).body.data.items.length, 0);
    assert.equal((await list({ providerIds: [doc.id], query: 'booker', fromDate: '2099-01-01', toDate: '2099-12-31' })).body.data.items.length, 1);
    assert.equal((await list({ providerIds: [nurse.id], fromDate: '2099-01-01', toDate: '2099-12-31' })).body.data.items.length, 0);
    assert.equal((await list({ query: "x'; DROP TABLE appointments;--" })).status, 200, 'query text is parameterised');
    assert.equal((await list({ fromDate: 'garbage' })).status, 400);

    assert.equal((await call('PUT', `/appointments/${appt.id}/status`, { token: tk, body: { status: 'bogus' } })).status, 400);
    assert.equal((await call('PUT', `/appointments/${appt.id}/status`, { token: tk, body: { status: 'cancelled' } })).body.data.appointmentStatus, 'Cancelled');
    assert.deepEqual((await slotReq('2099-06-01')).body.data, ['09:00 AM', '09:30 AM'], 'cancelled slot is free again');
    assert.equal((await call('GET', '/appointments/dashboard-stats', { token: tk })).body.data.cancelled, 1);

    // Another tenant sees none of it and cannot touch it.
    const b = await newTenant('apptB');
    assert.equal((await call('GET', `/Appointment/getAppointmentById/${appt.id}`, { token: b.token })).status, 404);
    assert.equal((await call('DELETE', `/appointments/${appt.id}`, { token: b.token })).status, 404);
    assert.equal((await call('POST', '/Appointment/createAppointment', { token: b.token, body })).status, 404);
    assert.equal((await call('GET', '/ServiceLocation/getServiceLocationList', { token: b.token })).body.data.length, 0);

    assert.equal((await call('DELETE', `/appointments/${appt.id}`, { token: tk })).status, 200);
    assert.equal((await call('GET', `/Appointment/getAppointmentById/${appt.id}`, { token: tk })).status, 404);
});

test('patient records: documents, allergies, immunizations, history, lab orders and results', async () => {
    const a = await newTenant('recs');
    const nurse = await addUser(a, 'nurserec', 'nurse');
    const pharm = await addUser(a, 'pharmrec', 'pharmacist');
    const tk = a.token;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Rec', lastName: 'Ords' } })).body.data;

    // documents (binary round-trip)
    const bytes = Buffer.from('%PDF-1.4 hello');
    assert.equal((await call('POST', '/Patient/uploadDocument', { token: pharm.token, body: { patientId: p.id, name: 'x.pdf' } })).status, 403);
    assert.equal((await call('POST', '/Patient/uploadDocument', { token: tk, body: { patientId: p.id, name: 'x.pdf', contentBase64: '***' } })).status, 400);
    const doc = (await call('POST', '/Patient/uploadDocument', { token: nurse.token, body: { patientId: p.id, name: 'consult.pdf', documentType: 'Referral', notes: 'n', contentBase64: `data:application/pdf;base64,${bytes.toString('base64')}` } })).body.data;
    assert.equal(doc.size, bytes.length);
    assert.equal((await call('GET', `/Patient/getAllDocument/${p.id}`, { token: tk })).body.data[0].documentName, 'consult.pdf');
    const dl = await fetch(`${base}/Patient/downloadDocument/${doc.id}`, { headers: { Authorization: `Bearer ${tk}` } });
    assert.equal(dl.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await dl.arrayBuffer()), bytes);
    const noFile = (await call('POST', '/Patient/uploadDocument', { token: tk, body: { patientId: p.id, name: 'meta-only' } })).body.data;
    assert.equal((await call('GET', `/Patient/downloadDocument/${noFile.id}`, { token: tk })).status, 404);

    // allergies in the nested shape the page parses
    assert.equal((await call('POST', '/Patient/createAllergy', { token: tk, body: { patientId: p.id, allergyName: 'Penicillin', severity: 'Extreme' } })).status, 400);
    const al = (await call('POST', '/Patient/createAllergy', { token: tk, body: { patientId: p.id, allergyName: 'Penicillin', reaction: 'Rash', severity: 'Severe', onsetDate: '2020-02-03' } })).body.data;
    const als = (await call('GET', `/Patient/getAllAllergyList?rcopiaID=${p.id}`, { token: tk })).body.data;
    assert.equal(als[0].Allergen[0].Name[0], 'Penicillin');
    assert.equal(als[0].ReactionList[0].Reaction[0].Description[0], 'Rash');
    assert.equal(als[0].Status[0].Active !== undefined, true);
    assert.equal((await call('GET', '/Patient/getAllAllergyList', { token: tk })).status, 400);
    assert.equal((await call('PUT', `/Patient/updateAllergy/${al.id}`, { token: tk, body: { allergyName: 'Penicillin', status: false } })).body.data.Status[0].Inactive !== undefined, true);

    // immunizations
    const im = (await call('POST', '/Patient/createImmunization', { token: tk, body: { patientId: p.id, vaccineName: 'Influenza', dose: '0.5', unit: 'mL', routes: 'IM', numberInSeries: 1, consentObtained: ['Verbal'], orderedDate: '2025-10-01', provider: 'Dr X' } })).body.data;
    const iml = (await call('GET', `/Patient/getPatientImmunizationList/${p.id}`, { token: tk })).body.data;
    assert.equal(iml[0].vaccineText, 'Influenza');
    assert.equal(iml[0].orderedDate, '2025-10-01');
    assert.equal((await call('GET', `/Patient/getPatientImmunizationById/${im.id}`, { token: tk })).body.data.consentObtained[0], 'Verbal');
    assert.match(await (await fetch(`${base}/Patient/downloadImmunization/${im.id}`, { headers: { Authorization: `Bearer ${tk}` } })).text(), /Influenza/);

    // history + categories
    const cats = (await call('GET', '/Patient/getAllHistoryCategories', { token: tk })).body.data;
    assert.ok(cats.length >= 5);
    assert.equal((await call('GET', '/Patient/getAllHistoryCategories', { token: tk })).body.data.length, cats.length, 'idempotent');
    const med = cats.find((c) => c.name === 'Medical');
    const hx = (await call('POST', '/Patient/createPatientHistory', { token: tk, body: { patientId: p.id, categoryId: med.id, conditions: 'Hypertension', diagonosisDate: '2018-05-06', notes: 'controlled' } })).body.data;
    assert.equal(hx.category.name, 'Medical');
    assert.equal((await call('GET', `/Patient/getAllPatientHistory/${p.id}`, { token: tk })).body.data[0].diagonosisDate, '2018-05-06');
    assert.equal((await call('GET', `/Patient/getPatientHistoryById/${hx.id}`, { token: tk })).body.data.conditions, 'Hypertension');
    assert.equal((await call('POST', '/Patient/createPatientHistory', { token: tk, body: { patientId: p.id, categoryId: 'nope', conditions: 'x' } })).status, 404);

    // lab orders (paged) + results
    assert.equal((await call('POST', '/lab-orders', { token: tk, body: { patientId: p.id, labTests: [] } })).status, 400);
    for (const n of ['CBC', 'BMP', 'Lipid panel']) {
        assert.equal((await call('POST', '/lab-orders', { token: tk, body: { patientId: p.id, labTests: [{ name: n }], priority: 'Urgent' } })).status, 201);
    }
    const lo = (await call('GET', `/lab-orders/by-patient/${p.id}?page=1&limit=2`, { token: tk })).body.data;
    assert.equal(lo.orders.length, 2);
    assert.equal(lo.total, 3);
    const one = (await call('GET', `/lab-orders/${lo.orders[0].id}`, { token: tk })).body.data;
    assert.equal(one.orderStatus, 'Ordered');
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Resulted' } })).body.data.orderStatus, 'Resulted');
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Done' } })).status, 400);
    const lr = (await call('POST', '/LabDetails/createLabDocument', { token: tk, body: { patientId: p.id, name: 'Glucose', labName: 'Quest', value: '98', unit: 'mg/dL', date: '2026-01-02' } })).body.data;
    assert.equal((await call('GET', `/LabDetails/getAllLabDocuments/${p.id}`, { token: tk })).body.data[0].value, '98');
    assert.equal((await call('GET', `/LabDetails/getLabDocumentById/${lr.id}`, { token: tk })).body.data.name, 'Glucose');

    // tenant isolation on every list
    const b = await newTenant('recsB');
    assert.equal((await call('POST', '/lab-orders', { token: b.token, body: { patientId: p.id, labTests: [{ name: 'CBC' }] } })).status, 404);
    assert.equal((await call('POST', '/Patient/createAllergy', { token: b.token, body: { patientId: p.id, allergyName: 'Spy' } })).status, 404);
    assert.equal((await call('GET', `/Patient/getAllDocument/${p.id}`, { token: b.token })).body.data.length, 0);
    assert.equal((await call('GET', `/Patient/getDocumentById/${doc.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/Patient/downloadDocument/${doc.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/lab-orders/${one.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/Patient/getPatientHistoryById/${hx.id}`, { token: b.token })).status, 404);
});

test('staff scheduling: shifts, overlap guard, open shifts, coverage', async () => {
    const a = await newTenant('sched');
    const nurse = await addUser(a, 'nursesched', 'nurse');
    const tk = a.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'ICU' } })).body.data;
    const sb = '/api/inpatient/staff-scheduling';

    const types = (await call('GET', `${sb}/shift-types`, { token: tk })).body.data;
    assert.deepEqual(types.map((t) => t.id), ['st-day', 'st-evening', 'st-night']);
    const staff = (await call('GET', `${sb}/staff?role=clinical-staff`, { token: tk })).body.data;
    assert.deepEqual(staff.map((s) => s.id), [nurse.id]);

    const day = '2099-03-10';
    const shift = { staffId: nurse.id, wardId: ward.id, shiftTypeId: 'st-day', startAt: `${day}T07:00:00.000Z`, endAt: `${day}T19:00:00.000Z`, status: 'scheduled' };
    assert.equal((await call('POST', `${sb}/shifts`, { token: nurse.token, body: shift })).status, 403, 'nurses cannot schedule');
    assert.equal((await call('POST', `${sb}/shifts`, { token: tk, body: { ...shift, endAt: shift.startAt } })).status, 400, 'end after start');
    assert.equal((await call('POST', `${sb}/shifts`, { token: tk, body: { ...shift, staffId: null } })).status, 400, 'scheduled needs staff');
    const s1 = (await call('POST', `${sb}/shifts`, { token: tk, body: shift })).body.data;
    assert.equal(s1.status, 'scheduled');
    assert.equal((await call('POST', `${sb}/shifts`, { token: tk, body: { ...shift, shiftTypeId: 'st-evening', startAt: `${day}T15:00:00.000Z`, endAt: `${day}T23:00:00.000Z` } })).status, 409, 'overlapping shift');

    const open = (await call('POST', `${sb}/shifts`, { token: tk, body: { staffId: null, wardId: ward.id, shiftTypeId: 'st-night', startAt: `${day}T19:00:00.000Z`, endAt: `${day}T23:59:00.000Z`, status: 'open', notes: 'cover' } })).body.data;
    assert.equal(open.staffId, null);

    const listed = (await call('GET', `${sb}/shifts?wardId=${ward.id}&from=${day}&to=${day}`, { token: tk })).body.data;
    assert.equal(listed.length, 2);
    assert.equal((await call('GET', `${sb}/shifts?from=2098-01-01&to=2098-12-31`, { token: tk })).body.data.length, 0);
    assert.equal((await call('GET', `${sb}/shifts?status=open`, { token: tk })).body.data.length, 1);
    assert.equal((await call('GET', `${sb}/shifts?staffId=${nurse.id}`, { token: tk })).body.data.length, 1);

    // Coverage rule: 2 clinical staff needed on days, only 1 scheduled -> understaffed row.
    assert.equal((await call('PUT', `${sb}/coverage-rules`, { token: nurse.token, body: { wardId: ward.id, shiftTypeId: 'st-day', minStaff: 2 } })).status, 403);
    await call('PUT', `${sb}/coverage-rules`, { token: tk, body: { wardId: ward.id, shiftTypeId: 'st-day', minStaff: 2 } });
    const os = (await call('GET', `${sb}/open-shifts?wardId=${ward.id}&from=${day}&to=${day}`, { token: tk })).body.data;
    assert.deepEqual(os.map((r) => r.reason).sort(), ['unassigned', 'understaffed']);
    assert.equal(os.find((r) => r.reason === 'unassigned').wardName, 'ICU');

    // assign the open shift
    const filled = await call('PUT', `${sb}/shifts/${open.id}`, { token: tk, body: { staffId: nurse.id, status: 'scheduled', startAt: `${day}T19:30:00.000Z`, endAt: `${day}T23:59:00.000Z` } });
    assert.equal(filled.status, 200, JSON.stringify(filled.body));
    assert.equal(filled.body.data.staffId, nurse.id);
    const mine = (await call('GET', `${sb}/me/shifts?wardId=${ward.id}&date=${day}`, { token: nurse.token })).body.data;
    assert.equal(mine.length, 2);
    assert.equal((await call('GET', `${sb}/me/shifts?wardId=${ward.id}&date=bad`, { token: nurse.token })).status, 400);

    const b = await newTenant('schedB');
    assert.equal((await call('GET', `${sb}/shifts/${s1.id}`, { token: b.token })).status, 404);
    assert.equal((await call('DELETE', `${sb}/shifts/${s1.id}`, { token: nurse.token })).status, 403, 'role check');
    assert.equal((await call('DELETE', `${sb}/shifts/${s1.id}`, { token: b.token })).status, 404, 'other tenant admin cannot delete');
    assert.equal((await call('GET', `${sb}/shifts`, { token: b.token })).body.data.length, 0);
    assert.equal((await call('DELETE', `${sb}/shifts/${s1.id}`, { token: tk })).status, 200);
});

test('live staffing assignments: board, drag updates, ratios, float pool', async () => {
    const a = await newTenant('staffing');
    const nurse1 = await addUser(a, 'n1staff', 'nurse');
    const nurse2 = await addUser(a, 'n2staff', 'nurse');
    const tk = a.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'Tele' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '1' } })).body.data;
    const beds = [];
    for (const l of ['A', 'B', 'C']) beds.push((await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: l } })).body.data);
    for (const [i, bed] of beds.entries()) {
        const pt = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: `Pat${i}`, lastName: 'Staffed' } })).body.data;
        assert.equal((await call('POST', '/api/admissions', { token: tk, body: { patientId: pt.id, bedId: bed.id } })).status, 201);
    }
    const day = '2099-04-05';
    const sched = '/api/inpatient/staff-scheduling/shifts';
    for (const n of [nurse1, nurse2]) {
        await call('POST', sched, { token: tk, body: { staffId: n.id, wardId: ward.id, shiftTypeId: 'st-day', startAt: `${day}T07:00:00.000Z`, endAt: `${day}T19:00:00.000Z`, status: 'scheduled' } });
    }

    assert.equal((await call('GET', `/api/Staffing/assignment/${ward.id}/${day}/day`, { token: tk })).status, 404);
    assert.equal((await call('POST', '/api/Staffing/assignment', { token: tk, body: { unitId: ward.id, date: day, shift: 'afternoon' } })).status, 400);
    assert.equal((await call('POST', '/api/Staffing/assignment', { token: tk, body: { unitId: 'nope', date: day, shift: 'day' } })).status, 404);
    const board = (await call('POST', '/api/Staffing/assignment', { token: nurse1.token, body: { unitId: ward.id, date: day, shift: 'day', chargeNurseId: nurse1.id } })).body.data;
    assert.equal(board.unitName, 'Tele');
    assert.equal(board.shiftLabel, 'Day (7a–7p)');
    assert.equal(board.nurses.length, 2, 'roster seeded from scheduled shifts');
    assert.equal(board.totalPatients, 3);
    assert.equal(board.unfilledBedIds.length, 3);
    assert.equal(board.nurses.find((n) => n.nurseId === nurse1.id).isChargeNurse, true);
    const again = (await call('POST', '/api/Staffing/assignment', { token: tk, body: { unitId: ward.id, date: day, shift: 'day' } })).body.data;
    assert.equal(again.assignmentId, board.assignmentId, 'idempotent create');

    const [r1, r2] = board.nurses;
    const bedIds = beds.map((x) => x.id);
    const put = (body) => call('PUT', `/api/Staffing/assignment/${board.assignmentId}`, { token: nurse1.token, body });
    assert.equal((await put({ nurseAssignments: [{ nurseAssignmentId: r1.id, assignedBedIds: [bedIds[0]] }, { nurseAssignmentId: r2.id, assignedBedIds: [bedIds[0]] }] })).status, 400, 'bed on two nurses');
    assert.equal((await put({ nurseAssignments: [{ nurseAssignmentId: 'bogus', assignedBedIds: [] }] })).status, 400);
    assert.equal((await put({ nurseAssignments: [{ nurseAssignmentId: r1.id, assignedBedIds: ['not-a-bed'] }] })).status, 400, 'foreign bed');
    const saved = (await put({ chargeNurseId: nurse2.id, nurseAssignments: [{ nurseAssignmentId: r1.id, assignedBedIds: bedIds }, { nurseAssignmentId: r2.id, assignedBedIds: [] }] })).body.data;
    const s1 = saved.nurses.find((n) => n.id === r1.id);
    assert.equal(s1.patientCount, 3);
    assert.equal(s1.ratioStatus, 'safe', 'Med-Surg allows 5');
    assert.equal(saved.unfilledBedIds.length, 0);
    assert.equal(saved.chargeNurseId, nurse2.id);

    // ICU model tightens ratios: 3 patients is "warning"; ratioCheck reflects it.
    assert.equal((await call('PUT', `/api/Staffing/unit/${ward.id}/careModel`, { token: nurse1.token, body: { careModel: 'ICU' } })).status, 403);
    await call('PUT', `/api/Staffing/unit/${ward.id}/careModel`, { token: tk, body: { careModel: 'ICU' } });
    const rc = (await call('GET', `/api/Staffing/ratioCheck/${ward.id}?date=${day}&shift=day`, { token: tk })).body.data;
    assert.equal(rc.unitCareModel, 'ICU');
    assert.equal(rc.status, 'warning');
    assert.equal(rc.understaffed, true);
    assert.equal((await call('GET', `/api/Staffing/assignment/${ward.id}/${day}/day`, { token: tk })).body.data.nurses.find((n) => n.id === r1.id).ratioStatus, 'warning');

    // float pool
    const t = a.user.tenant.id;
    assert.equal((await call('GET', `/api/Staffing/floatPool/${t}`, { token: tk })).body.data.length, 0);
    assert.equal((await call('PUT', `/api/inpatient/staff-scheduling/staff/${nurse2.id}/profile`, { token: tk, body: { clinicalRole: 'LVN', certifications: ['ACLS', 'BLS'], isFloatPool: true } })).status, 200);
    const fp = (await call('GET', `/api/Staffing/floatPool/${t}`, { token: tk })).body.data;
    assert.equal(fp.length, 1);
    assert.deepEqual(fp[0].certifications, ['ACLS', 'BLS']);

    const b = await newTenant('staffingB');
    assert.equal((await call('GET', `/api/Staffing/floatPool/${t}`, { token: b.token })).status, 403);
    assert.equal((await call('GET', `/api/Staffing/assignment/${ward.id}/${day}/day`, { token: b.token })).status, 404);
    assert.equal((await call('PUT', `/api/Staffing/assignment/${board.assignmentId}`, { token: b.token, body: { nurseAssignments: [] } })).status, 404);
});

test('radiology orders and code events', async () => {
    const a = await newTenant('clinops');
    const doc = await addUser(a, 'docops', 'physician');
    const nurse = await addUser(a, 'nurseops', 'nurse');
    const tk = a.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'W' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '9' } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'A' } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Rad', lastName: 'Code' } })).body.data;
    const enc = (await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id } })).body.data.encounter.id;

    // radiology
    const order = { patientId: p.id, encounterId: enc, modality: 'CT', bodyRegion: 'Chest', clinicalIndication: 'r/o PE', icd10Codes: ['I26.99'], priority: 'STAT', transportRequired: true };
    assert.equal((await call('POST', '/api/Radiology/order', { token: nurse.token, body: order })).status, 403, 'only physicians order');
    assert.equal((await call('POST', '/api/Radiology/order', { token: doc.token, body: { ...order, priority: 'ASAP' } })).status, 400);
    assert.equal((await call('POST', '/api/Radiology/order', { token: doc.token, body: { ...order, encounterId: 'nope' } })).status, 404);
    const o = (await call('POST', '/api/Radiology/order', { token: doc.token, body: order })).body.data;
    assert.equal(o.status, 'Ordered');
    assert.equal(o.orderedBy, doc.id);
    assert.equal((await call('GET', `/api/Radiology/encounter/${enc}`, { token: nurse.token })).body.data.length, 1);
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/acknowledge`, { token: nurse.token, body: {} })).body.data.status, 'Scheduled');
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/critical`, { token: nurse.token, body: { criticalValue: true } })).status, 400, 'needs notified-to');
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/critical`, { token: nurse.token, body: { criticalValue: true, criticalValueNotifiedTo: 'Dr. Who' } })).body.data.criticalValue, true);
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/result`, { token: doc.token, body: {} })).status, 400);
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/result`, { token: doc.token, body: { impression: 'No PE', findings: 'clear', dicomViewerUrl: 'javascript:alert(1)' } })).status, 400, 'viewer url must be http(s)');
    const fin2 = (await call('PUT', `/api/Radiology/order/${o.id}/result`, { token: doc.token, body: { impression: 'No PE', findings: 'clear', dicomViewerUrl: 'https://pacs.example/v/1' } })).body.data;
    assert.equal(fin2.status, 'Final');
    assert.ok(fin2.resultedAt);
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/result`, { token: doc.token, body: { impression: 'Small PE' } })).status, 400, 'amend needs reason');
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/result`, { token: doc.token, body: { impression: 'Small PE', amendmentReason: 'overread' } })).body.data.status, 'Amended');
    assert.equal((await call('PUT', `/api/Radiology/order/${o.id}/cancel`, { token: doc.token })).status, 409, 'resulted orders cannot be cancelled');
    const o2 = (await call('POST', '/api/Radiology/order', { token: doc.token, body: order })).body.data;
    assert.equal((await call('PUT', `/api/Radiology/order/${o2.id}/cancel`, { token: doc.token })).body.data.status, 'Cancelled');

    // code events
    const act = { patientId: p.id, encounterId: enc, eventType: 'Code Blue', location: 'Room 9', teamLeadId: doc.id, teamLeadName: 'Dr Ops' };
    assert.equal((await call('POST', '/api/CodeEvent/activate', { token: nurse.token, body: { ...act, eventType: 'Code Purple' } })).status, 400);
    const ev = (await call('POST', '/api/CodeEvent/activate', { token: nurse.token, body: act })).body.data;
    assert.equal(ev.status, 'active');
    assert.equal(ev.patientName, 'Rad Code');
    assert.equal(ev.unitId, ward.id);
    assert.equal((await call('POST', '/api/CodeEvent/activate', { token: nurse.token, body: act })).status, 409, 'one active code per patient');
    assert.equal((await call('GET', `/api/CodeEvent/active/${ward.id}`, { token: tk })).body.data.length, 1);
    assert.equal((await call('GET', '/api/CodeEvent/active/unit-1', { token: tk })).body.data.length, 1, 'default placeholder = whole tenant');
    assert.equal((await call('GET', '/api/CodeEvent/active/other-ward', { token: tk })).body.data.length, 0);
    assert.equal((await call('GET', `/api/CodeEvent/patient/${p.id}`, { token: tk })).body.data.id, ev.id);

    const entry = { id: 'e1', timestamp: new Date().toISOString(), entryType: 'CPR Started', notes: 'start' };
    const tl = (await call('PUT', `/api/CodeEvent/${ev.id}/timeline`, { token: nurse.token, body: { timeline: [entry, { id: 'e2', timestamp: new Date().toISOString(), entryType: 'Medication Given', medication: { name: 'Epinephrine', dose: '1 mg', route: 'IV' } }] } })).body.data;
    assert.equal(tl.timeline.length, 2);
    assert.equal(tl.timeline[0].enteredBy.length > 0, true);
    assert.equal((await call('PUT', `/api/CodeEvent/${ev.id}/timeline`, { token: nurse.token, body: { timeline: [{ ...entry, entryType: 'Dance' }] } })).status, 400);
    assert.equal((await call('PUT', `/api/CodeEvent/${ev.id}/team`, { token: nurse.token, body: { teamMembers: [{ userId: doc.id, name: 'Dr Ops', role: 'MD', arrivedAt: new Date().toISOString() }] } })).body.data.teamMembers.length, 1);
    const note = (await call('GET', `/api/CodeEvent/${ev.id}/generate-note`, { token: tk })).body.data.noteText;
    assert.match(note, /Epinephrine 1 mg IV/);

    const end = new Date(Date.parse(ev.calledAt) + 12 * 60_000).toISOString();
    const closeBody = { endTime: end, outcome: 'ROSC', postEventDisposition: 'ICU', debriefNotes: 'ok', totalDurationMinutes: 999 };
    assert.equal((await call('PUT', `/api/CodeEvent/${ev.id}/close`, { token: nurse.token, body: { ...closeBody, endTime: new Date(Date.parse(ev.calledAt) - 60_000).toISOString() } })).status, 400, 'end before call');
    const closed = (await call('PUT', `/api/CodeEvent/${ev.id}/close`, { token: nurse.token, body: closeBody })).body.data;
    assert.equal(closed.status, 'closed');
    assert.equal(closed.totalDurationMinutes, 12, 'duration is computed server-side');
    assert.equal((await call('PUT', `/api/CodeEvent/${ev.id}/close`, { token: nurse.token, body: closeBody })).status, 409);
    assert.equal((await call('PUT', `/api/CodeEvent/${ev.id}/timeline`, { token: nurse.token, body: { timeline: [] } })).status, 409, 'closed events are read-only');
    assert.equal((await call('GET', `/api/CodeEvent/active/${ward.id}`, { token: tk })).body.data.length, 0);
    assert.equal((await call('POST', '/api/CodeEvent/activate', { token: nurse.token, body: act })).status, 201, 'can re-activate after close');

    const b = await newTenant('clinopsB');
    assert.equal((await call('GET', `/api/CodeEvent/${ev.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/api/Radiology/order/${o.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/api/Radiology/encounter/${enc}`, { token: b.token })).body.data.length, 0);
    assert.equal((await call('POST', '/api/CodeEvent/activate', { token: b.token, body: act })).status, 404);
});
