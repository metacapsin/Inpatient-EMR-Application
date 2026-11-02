// Integration tests against the real PostgreSQL database in DATABASE_URL.
// Each run creates its own tenants (via /auth/register) and deletes them at the end, so seeded data is untouched.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { boss, startQueue, QUEUES } from '../src/db/queue.js';

let server;
let base;
const tenantIds = [];
const platformAdminIds = [];
const suffix = Date.now().toString(36);

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
    await startQueue();
});

after(async () => {
    for (const id of tenantIds) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    for (const id of platformAdminIds) await pool.query('DELETE FROM platform_admins WHERE id = $1', [id]);
    await new Promise((r) => server.close(r));
    await boss.stop({ graceful: false });
    await pool.end();
});

/** No self-service signup for platform admins by design (see plan) — bootstrap one directly for tests. */
async function newPlatformAdmin(label) {
    const email = `platform-${label}-${suffix}@test.example`;
    const password = 'Platform-passw0rd!';
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO platform_admins (email, password_hash) VALUES ($1,$2) RETURNING id', [email, hash]);
    platformAdminIds.push(r.rows[0].id);
    return { email, password };
}

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
    // A vacated bed is not free yet — it goes to 'dirty' and into the EVS queue until housekeeping approves it.
    assert.equal(board2.rows.find((r) => r.bed.id === bed1.id).bed.bedStatus, 'dirty');

    // discharge: confirm before initiate is rejected
    assert.equal((await call('POST', '/api/discharges/confirm', { token: tk, body: { encounterId: encId } })).status, 409);
    assert.equal((await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId: encId, disposition: 'Home' } })).status, 200);
    // Hard gates: nothing is documented yet, so confirm is refused with the structured gate list.
    const blocked = await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: encId } });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'DISCHARGE_BLOCKED');
    assert.ok(blocked.body.details.blocking.some((g) => g.id === 'gate-summary-signed'));
    assert.ok(blocked.body.details.blocking.some((g) => g.id === 'gate-med-reconciliation'));
    await satisfyDischargeGates(tk, encId);
    const conf = await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: encId } });
    assert.equal(conf.status, 200, JSON.stringify(conf.body));
    assert.equal(conf.body.data.patientId, p1.id);
    assert.equal((await call('GET', '/api/admissions/active', { token: tk })).body.data.length, 0);
    // Discharge routes through 'dirty' (bed2) — bed1 is still dirty from the transfer above.
    assert.equal((await call('GET', '/Beds/getLiveBedBoard', { token: tk })).body.data.summary.byStatus.dirty, 2);

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
    assert.deepEqual(d.kpis, { totalAdmittedPatients: 1, occupiedBeds: 1, availableBeds: 1, dischargedToday: 0, unacknowledgedCriticalResults: 0 });
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
    await satisfyDischargeGates(tk, enc);
    await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: enc } });
    assert.equal((await call('GET', '/dashboard/ipd', { token: tk })).body.data.kpis.dischargedToday, 1);
});

/**
 * Discharge confirm is hard-gated (signed summary, completed discharge med rec, blocking checklist tasks).
 * Satisfies all three for an encounter so ADT/bed tests can still exercise the physical discharge.
 */
async function satisfyDischargeGates(tk, encounterId) {
    const view = await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: tk });
    assert.equal(view.status, 200, JSON.stringify(view.body));
    for (const t of view.body.data.checklist.filter((x) => x.blocksDischarge && !x.completed)) {
        assert.equal((await call('PATCH', `/api/encounters/${encounterId}/discharge-checklist/tasks/${t.id}`, { token: tk, body: { completed: true } })).status, 200);
    }
    const rec = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation/discharge`, { token: tk })).body.data;
    const lines = rec.lines.map((l) => ({ ...l, action: 'continue' }));
    assert.equal((await call('POST', `/api/encounters/${encounterId}/med-reconciliation/discharge/complete`, { token: tk, body: { lines } })).status, 200);
    const summary = { admissionDiagnosis: 'Pneumonia', hospitalCourse: 'Treated with IV antibiotics; improved.', finalDiagnoses: 'J18.9 Pneumonia, unspecified organism', dischargeMedications: 'Per reconciliation', followUpInstructions: 'PCP in 7 days', disposition: 'Home' };
    assert.equal((await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: tk, body: summary })).status, 200);
    const sign = await call('POST', `/api/encounters/${encounterId}/discharge-summary/sign`, { token: tk, body: {} });
    assert.equal(sign.status, 200, JSON.stringify(sign.body));
}

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
    // Status skipping is rejected: Ordered → Collected → In Progress → Resulted.
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Resulted' } })).status, 409);
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Collected' } })).body.data.orderStatus, 'Collected');
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'In Progress' } })).body.data.orderStatus, 'In Progress');
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Resulted' } })).body.data.orderStatus, 'Resulted');
    assert.equal((await call('PUT', `/lab-orders/${one.id}`, { token: tk, body: { orderStatus: 'Cancelled' } })).status, 409, 'cancel only before Resulted');
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

test('starting flow: platform login -> create tenant -> invite admin -> onboarding -> register patient -> admit patient', async () => {
    // Platform admins aren't self-service (see Phase 1); bootstrap one directly.
    const platform = await newPlatformAdmin('flow');
    assert.equal((await call('POST', '/api/platform/login', { body: { email: platform.email, password: 'wrong' } })).status, 401);
    const platformLogin = await call('POST', '/api/platform/login', { body: { email: platform.email, password: platform.password } });
    assert.equal(platformLogin.status, 200);
    const platformToken = platformLogin.body.data.token;

    // A tenant-scoped token must never work as a platform token, and vice versa.
    const unrelatedTenant = await newTenant('flow-unrelated');
    assert.equal((await call('GET', '/api/platform/tenants', { token: unrelatedTenant.token })).status, 401);
    assert.equal((await call('GET', '/tenants/current', { token: platformToken })).status, 401);

    // --- Tenant Onboarding step 1: provision the tenant
    const createTenant = await call('POST', '/api/platform/tenants', {
        token: platformToken,
        body: { name: `Flow Hospital ${suffix}`, plan: 'starter', enabledModules: ['adt', 'patients'] },
    });
    assert.equal(createTenant.status, 201, JSON.stringify(createTenant.body));
    const tenant = createTenant.body.data;
    tenantIds.push(tenant.id);
    assert.equal(tenant.status, 'trial');
    assert.equal(tenant.onboardingStatus, 'provisioned');
    assert.ok(tenant.stripeSubscriptionId, 'stubbed Stripe subscription id is set');

    const listed = await call('GET', '/api/platform/tenants', { token: platformToken });
    assert.ok(listed.body.data.some((t) => t.id === tenant.id));

    // --- Tenant Onboarding step 2: invite the tenant's first admin
    const adminEmail = `flow-admin-${suffix}@test.example`;
    const invite = await call('POST', `/api/platform/tenants/${tenant.id}/invite-admin`, {
        token: platformToken,
        body: { email: adminEmail, firstName: 'Flo', lastName: 'Admin' },
    });
    assert.equal(invite.status, 201, JSON.stringify(invite.body));
    assert.equal(invite.body.data.role, 'admin');
    const setPasswordToken = invite.body.data.devSetPasswordToken;
    assert.ok(setPasswordToken, 'dev build exposes the invite token since no mail transport is configured');

    // Invited admin sets their password via the existing reset-password flow (reused, not reinvented).
    const newPassword = 'Flow-passw0rd!';
    const resetRes = await call('POST', '/auth/reset-password', { body: { token: setPasswordToken, newPassword, confirmPassword: newPassword } });
    assert.equal(resetRes.status, 200, JSON.stringify(resetRes.body));

    // --- Admin logs in
    const adminLogin = await call('POST', '/login', { body: { username: adminEmail, password: newPassword } });
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
    assert.equal(adminLogin.body.role, 'admin');
    const adminToken = adminLogin.body.token;

    const tenantBeforeOnboarding = await call('GET', '/tenants/current', { token: adminToken });
    assert.equal(tenantBeforeOnboarding.body.data.onboardingStatus, 'provisioned');

    // --- Onboarding wizard: facility setup (ward/room/bed) + staff invite
    const ward = (await call('POST', '/Wards/CreateWard', { token: adminToken, body: { wardName: 'Flow Ward' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: adminToken, body: { wardId: ward.id, roomNumber: 'F1' } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: adminToken, body: { roomId: room.id, bedLabel: 'F1-A' } })).body.data;
    const staffInvite = await call('POST', '/auth/register-user', {
        token: adminToken,
        body: { email: `flow-nurse-${suffix}@test.example`, password: 'Flow-nurse-pass1', role: 'nurse', firstName: 'Flow' },
    });
    assert.equal(staffInvite.status, 201);

    // --- Onboarding wizard: mark complete
    const complete = await call('PUT', '/tenants/current/onboarding-status', { token: adminToken, body: { onboardingStatus: 'complete' } });
    assert.equal(complete.status, 200);
    assert.equal(complete.body.data.onboardingStatus, 'complete');
    assert.equal((await call('GET', '/tenants/current', { token: adminToken })).body.data.onboardingStatus, 'complete');

    // --- Patient Registration: eligibility stub + Rcopia sync job enqueued
    const patientRes = await call('POST', '/Patient/createPatient', {
        token: adminToken,
        body: { firstName: 'Pat', lastName: 'Flowtest', dOB: '1990-01-01', sex: 'F' },
    });
    assert.equal(patientRes.status, 201, JSON.stringify(patientRes.body));
    // No insurance on this registration → nothing to check (Stedi is disabled in tests anyway).
    assert.deepEqual(patientRes.body.eligibility, { eligible: null, stediEnabled: false });
    const patient = patientRes.body.data;

    const rcopiaJob = await pool.query(`SELECT 1 FROM pgboss.job WHERE name = $1 AND data->>'patientId' = $2`, [QUEUES.RCOPIA_PATIENT_SYNC, patient.id]);
    assert.equal(rcopiaJob.rowCount, 1, 'rcopia-patient-sync job was enqueued for the new patient');

    // --- ADT Admission: adt-notification job enqueued
    const admission = await call('POST', '/api/admissions', { token: adminToken, body: { patientId: patient.id, bedId: bed.id, admissionType: 'elective' } });
    assert.equal(admission.status, 201, JSON.stringify(admission.body));
    const encounterId = admission.body.data.encounter.id;

    const adtJob = await pool.query(`SELECT 1 FROM pgboss.job WHERE name = $1 AND data->>'encounterId' = $2`, [QUEUES.ADT_NOTIFICATION, encounterId]);
    assert.equal(adtJob.rowCount, 1, 'adt-notification job was enqueued for the new admission');
});

test('tenant governance: disabled modules are blocked, unrelated routes still work, suspension blocks everything', async () => {
    const platform = await newPlatformAdmin('gov');
    const platformToken = (await call('POST', '/api/platform/login', { body: { email: platform.email, password: platform.password } })).body.data.token;

    const t = await newTenant('gov');
    const tenantId = t.user.tenant.id;
    const p = (await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Gov', lastName: 'Erned' } })).body.data;

    // Restrict this tenant to patients-only (no adt/medication/billing/staffing).
    const restrict = await call('PATCH', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { enabledModules: ['patients'] } });
    assert.equal(restrict.status, 200);

    // Patients module still works...
    assert.equal((await call('GET', `/Patient/getPatientById/${p.id}`, { token: t.token })).status, 200);
    // ...but adt/medication/billing/staffing are now blocked, each with a clear message naming the module.
    const wardBlocked = await call('POST', '/Wards/CreateWard', { token: t.token, body: { name: 'X' } });
    assert.equal(wardBlocked.status, 403);
    assert.match(wardBlocked.body.message, /adt module is not enabled/);
    assert.equal((await call('GET', `/api/patients/${p.id}/medications`, { token: t.token })).status, 403);
    assert.equal((await call('GET', `/api/CDI/worklist/${tenantId}`, { token: t.token })).status, 403);
    assert.equal((await call('GET', `/api/Staffing/floatPool/${tenantId}`, { token: t.token })).status, 403);
    // Routes outside the 5-module picker (dashboard, appointments, clinicalOps) are never gated.
    assert.equal((await call('GET', '/dashboard/ipd', { token: t.token })).status, 200);

    // Re-enabling restores access immediately (no re-login needed — checked fresh every request).
    await call('PATCH', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { enabledModules: ['adt', 'patients', 'medication', 'billing', 'staffing'] } });
    assert.equal((await call('POST', '/Wards/CreateWard', { token: t.token, body: { name: 'X' } })).status, 201);

    // Suspension blocks login outright...
    await call('PATCH', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { status: 'suspended' } });
    const blockedLogin = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.body.code, 'TENANT_SUSPENDED');
    // ...and immediately invalidates the already-issued token too, not just new logins.
    assert.equal((await call('GET', '/dashboard/ipd', { token: t.token })).status, 403);

    // Reactivating restores access.
    await call('PATCH', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { status: 'active' } });
    assert.equal((await call('GET', '/dashboard/ipd', { token: t.token })).status, 200);
});

test('platform admin: delete tenant shows accurate impact counts and requires exact-name confirmation', async () => {
    const platform = await newPlatformAdmin('del');
    const platformToken = (await call('POST', '/api/platform/login', { body: { email: platform.email, password: platform.password } })).body.data.token;

    const t = await newTenant('del');
    const tenantId = t.user.tenant.id;
    await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Del', lastName: 'One' } });
    await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Del', lastName: 'Two' } });

    const impact = await call('GET', `/api/platform/tenants/${tenantId}/deletion-impact`, { token: platformToken });
    assert.equal(impact.status, 200);
    assert.equal(impact.body.data.patientCount, 2);
    assert.equal(impact.body.data.userCount, 1);
    assert.equal(impact.body.data.tenantName, 'Org del');

    // Wrong confirmation name is rejected, tenant survives.
    const wrongConfirm = await call('DELETE', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { confirmName: 'not the real name' } });
    assert.equal(wrongConfirm.status, 400);
    assert.equal((await call('GET', `/api/platform/tenants/${tenantId}/deletion-impact`, { token: platformToken })).status, 200);

    // Correct confirmation deletes the tenant and (via ON DELETE CASCADE) everything under it.
    const del = await call('DELETE', `/api/platform/tenants/${tenantId}`, { token: platformToken, body: { confirmName: impact.body.data.tenantName } });
    assert.equal(del.status, 200);
    assert.equal((await call('GET', `/api/platform/tenants/${tenantId}/deletion-impact`, { token: platformToken })).status, 404);
    assert.equal((await call('POST', '/login', { body: { username: t.email, password: t.password } })).status, 401, 'deleted tenant\'s admin can no longer log in');
    assert.ok(!(await call('GET', '/api/platform/tenants', { token: platformToken })).body.data.some((x) => x.id === tenantId));
});

test('CPOE: unified order-entry writes the ledger + detail row, encounter timeline aggregates all four types', async () => {
    const t = await newTenant('cpoe');
    const doc = await addUser(t, 'doccpoe', 'physician');
    const nurse = await addUser(t, 'nursecpoe', 'nurse');
    const tk = t.token;
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'W' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '1' } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: 'A' } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Cpoe', lastName: 'Patient' } })).body.data;
    const enc = (await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id } })).body.data.encounter.id;

    // Radiology stays physician-only even though the router-level gate admits nurses too — this is
    // the one place this endpoint's role logic is stricter than its own router-level gate.
    const radBody = { orderType: 'radiology', patientId: p.id, encounterId: enc, modality: 'CT', bodyRegion: 'Chest', clinicalIndication: 'r/o PE', priority: 'STAT' };
    assert.equal((await call('POST', '/api/orders', { token: nurse.token, body: radBody })).status, 403, 'nurses cannot place radiology orders');

    const medOrder = (await call('POST', '/api/orders', { token: doc.token, body: { orderType: 'medication', patientId: p.id, encounterId: enc, name: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily' } })).body.data;
    assert.equal(medOrder.orderType, 'medication');
    assert.equal(medOrder.detail.name, 'Lisinopril');
    assert.equal(medOrder.detail.encounterId, enc, 'medications.encounter_id is backfilled');

    const prnOrder = (await call('POST', '/api/orders', { token: nurse.token, body: { orderType: 'prn_stat', patientId: p.id, encounterId: enc, medicationName: 'Morphine', type: 'STAT', indication: 'Severe pain', orderedTime: new Date().toISOString(), givenBy: 'RN Priya' } })).body.data;
    assert.equal(prnOrder.detail.medicationName, 'Morphine');
    assert.equal(prnOrder.detail.encounterId, enc, 'prn_stat_orders.encounter_id is backfilled');

    const labOrder = (await call('POST', '/api/orders', { token: doc.token, body: { orderType: 'lab', patientId: p.id, encounterId: enc, labTests: [{ name: 'CBC' }], priority: 'Urgent' } })).body.data;
    assert.equal(labOrder.detail.labTests[0].name, 'CBC');

    const radOrder = (await call('POST', '/api/orders', { token: doc.token, body: radBody })).body.data;
    assert.equal(radOrder.detail.modality, 'CT');

    assert.equal((await call('GET', `/api/patients/${p.id}/medications`, { token: tk })).body.data.length, 1, 'existing medications endpoint still works');

    const timeline = (await call('GET', `/api/encounters/${enc}/orders`, { token: tk })).body.data;
    assert.equal(timeline.length, 4);
    assert.deepEqual(timeline.map((o) => o.orderType), ['radiology', 'lab', 'prn_stat', 'medication'], 'newest first');
    assert.ok(timeline.every((o) => o.encounterId === enc));

    const single = (await call('GET', `/api/orders/${medOrder.id}`, { token: tk })).body.data;
    assert.equal(single.detail.name, 'Lisinopril');

    // Basic status flip: discontinue/cancel the ledger row, no detail-table changes.
    const disc = await call('PUT', `/api/orders/${medOrder.id}/status`, { token: nurse.token, body: { status: 'discontinued' } });
    assert.equal(disc.body.data.status, 'discontinued');
    assert.equal((await call('PUT', `/api/orders/${medOrder.id}/status`, { token: nurse.token, body: { status: 'cancelled' } })).status, 409, 'already-terminal order cannot flip again');
    assert.equal((await call('PUT', `/api/orders/${labOrder.id}/status`, { token: doc.token, body: { status: 'cancelled' } })).body.data.status, 'cancelled');

    // Orders dashboard: cross-patient aggregate, independent of the per-encounter timeline above.
    const dash = (await call('GET', '/api/inpatient/orders', { token: tk })).body.data;
    assert.equal(dash.total, 4);
    const byId = Object.fromEntries(dash.items.map((o) => [o.id, o]));
    assert.equal(byId[prnOrder.id].orderType, 'medication', 'prn_stat folds into the medication bucket');
    assert.match(byId[prnOrder.id].summary, /Morphine/);
    assert.equal(byId[prnOrder.id].priority, 'stat', 'STAT prn order maps to stat priority');
    assert.equal(byId[prnOrder.id].status, 'pending', 'ledger active maps to pending');
    assert.equal(byId[medOrder.id].status, 'cancelled', 'ledger discontinued maps to cancelled for the dashboard');
    assert.equal(byId[medOrder.id].canCancel, false, 'terminal orders cannot be cancelled again');
    assert.equal(byId[labOrder.id].status, 'cancelled');
    assert.equal(byId[radOrder.id].priority, 'stat');
    assert.equal(byId[radOrder.id].unitId, ward.id);
    assert.equal(byId[radOrder.id].unitName, 'W');
    assert.equal(byId[radOrder.id].patientName, 'Cpoe Patient');
    assert.ok(byId[radOrder.id].mrn);

    assert.equal((await call('GET', '/api/inpatient/orders?patientSearch=Cpoe', { token: tk })).body.data.total, 4);
    assert.equal((await call('GET', '/api/inpatient/orders?patientSearch=Nobody', { token: tk })).body.data.total, 0);
    assert.equal((await call('GET', `/api/inpatient/orders?unitId=${ward.id}`, { token: tk })).body.data.total, 4);
    assert.equal((await call('GET', '/api/inpatient/orders?unitId=not-a-real-ward', { token: tk })).body.data.total, 0);
    assert.equal((await call('GET', '/api/inpatient/orders?statuses=cancelled', { token: tk })).body.data.total, 2, 'discontinued + cancelled both bucket into cancelled');
    assert.equal((await call('GET', '/api/inpatient/orders?orderTypes=medication', { token: tk })).body.data.total, 2, 'medication + prn_stat both bucket into medication');
    const page1 = (await call('GET', '/api/inpatient/orders?limit=1&page=1', { token: tk })).body.data;
    assert.equal(page1.items.length, 1);
    assert.equal(page1.total, 4);

    // Dashboard's own Cancel action, separate endpoint from the per-encounter PUT .../status above.
    const dashCancel = await call('POST', `/api/inpatient/orders/${radOrder.id}/cancel`, { token: doc.token });
    assert.equal(dashCancel.body.data.status, 'cancelled');
    assert.equal((await call('GET', `/api/orders/${radOrder.id}`, { token: tk })).body.data.status, 'cancelled');
    assert.equal((await call('POST', `/api/inpatient/orders/${radOrder.id}/cancel`, { token: doc.token })).status, 409, 'already cancelled');

    const other = await newTenant('cpoeB');
    assert.equal((await call('GET', `/api/encounters/${enc}/orders`, { token: other.token })).status, 404, 'tenant isolation');
    assert.equal((await call('GET', '/api/inpatient/orders', { token: other.token })).body.data.total, 0, 'dashboard is tenant-scoped too');
});

test('bed management: timed holds, dirty-on-discharge, EVS turnaround, expiry sweep, placement warnings, transfer requests', async () => {
    const t = await newTenant('beds');
    const tk = t.token;
    const nurse = await addUser(t, 'bm-nurse', 'nurse');
    const hk = await addUser(t, 'bm-hk', 'staff');
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'Tele' } })).body.data;
    const ward2 = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: 'ICU' } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: '201' } })).body.data;
    assert.equal(room.isolationRequired, false);
    const isoRoom = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward2.id, roomNumber: 'ISO-1', isolationRequired: true, isolationType: 'Negative pressure' } })).body.data;
    assert.equal(isoRoom.isolationRequired, true);
    assert.equal(isoRoom.isolationType, 'Negative pressure');
    const mkBed = async (roomId, label) => (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId, bedLabel: label } })).body.data;
    const bedA = await mkBed(room.id, 'A');
    const bedB = await mkBed(room.id, 'B');
    const bedC = await mkBed(isoRoom.id, 'C');
    const bedD = await mkBed(room.id, 'D');
    const mkPatient = async (firstName, lastName, sex) => (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName, lastName, sex } })).body.data;
    const p1 = await mkPatient('Ann', 'Hold', 'F');
    const p2 = await mkPatient('Bob', 'Other', 'M');
    const p3 = await mkPatient('Cat', 'Iso', 'F');
    const boardRow = async (bedId) => (await call('GET', '/Beds/getLiveBedBoard', { token: tk })).body.data.rows.find((r) => r.bed.id === bedId);

    // --- timed hold: reserve bed A for p1
    const resv = await call('POST', `/api/beds/${bedA.id}/reserve`, { token: nurse.token, body: { patientId: p1.id, expiresInMinutes: 120, notes: 'ED boarder' } });
    assert.equal(resv.status, 201, JSON.stringify(resv.body));
    assert.equal(resv.body.data.status, 'active');
    assert.equal(resv.body.data.patientName, 'Ann Hold');
    assert.equal((await call('POST', `/api/beds/${bedA.id}/reserve`, { token: tk, body: { patientId: p2.id } })).status, 409, 'one live hold per bed');
    assert.equal((await call('POST', `/api/beds/${bedA.id}/reserve`, { token: tk, body: {} })).status, 400, 'hold must name a patient or encounter');
    let rowA = await boardRow(bedA.id);
    assert.equal(rowA.bed.bedStatus, 'hold');
    assert.equal(rowA.reservation.patientId, p1.id);
    assert.equal((await call('GET', '/api/bed-reservations', { token: tk })).body.data.length, 1);

    // hold is enforced: a different patient cannot be admitted into the held bed
    const blocked = await call('POST', '/api/admissions', { token: tk, body: { patientId: p2.id, bedId: bedA.id } });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.match(blocked.body.message, /held for another patient/);
    const pc2 = (await call('GET', `/api/beds/${bedA.id}/placement-check?patientId=${p2.id}`, { token: tk })).body.data;
    assert.equal(pc2.ok, false);
    assert.ok(pc2.warnings.some((w) => w.code === 'held_for_other_patient'));
    const pc1 = (await call('GET', `/api/beds/${bedA.id}/placement-check?patientId=${p1.id}`, { token: tk })).body.data;
    assert.equal(pc1.ok, true);
    assert.deepEqual(pc1.warnings, []);

    // ...but the patient it was held for can — and the reservation becomes fulfilled
    const admit1 = await call('POST', '/api/admissions', { token: tk, body: { patientId: p1.id, bedId: bedA.id } });
    assert.equal(admit1.status, 201, JSON.stringify(admit1.body));
    const enc1 = admit1.body.data.encounter.id;
    assert.equal((await call('GET', `/api/bed-reservations/${resv.body.data.id}`, { token: tk })).body.data.status, 'fulfilled');
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'occupied');

    // --- soft warnings are advisory only: mixed-sex shared room warns but does not block
    const pcMix = (await call('GET', `/api/beds/${bedB.id}/placement-check?patientId=${p2.id}`, { token: tk })).body.data;
    assert.equal(pcMix.ok, true);
    assert.ok(pcMix.warnings.some((w) => w.code === 'mixed_sex_room' && w.severity === 'warning'), JSON.stringify(pcMix.warnings));
    const admit2 = await call('POST', '/api/admissions', { token: tk, body: { patientId: p2.id, bedId: bedB.id } });
    assert.equal(admit2.status, 201);
    const enc2 = admit2.body.data.encounter.id;

    // isolation precaution on p2 (derived from the HAI event log) → roommate warning for anyone placed in that room
    const hai = await call('POST', '/api/HAIEvent', { token: tk, body: { encounterId: enc2, unitId: ward.id, eventType: 'isolation_started', infectionType: 'MRSA', isolationType: 'Contact' } });
    assert.equal(hai.status, 201, JSON.stringify(hai.body));
    const pcIso = (await call('GET', `/api/beds/${bedD.id}/placement-check?patientId=${p3.id}`, { token: tk })).body.data;
    assert.ok(pcIso.warnings.some((w) => w.code === 'roommate_isolation'), JSON.stringify(pcIso.warnings));
    assert.ok(pcIso.roommates.some((r) => r.isolationActive === true));
    const pcIsoRoom = (await call('GET', `/api/beds/${bedC.id}/placement-check?patientId=${p3.id}`, { token: tk })).body.data;
    assert.ok(pcIsoRoom.warnings.some((w) => w.code === 'isolation_room_for_non_isolation_patient' && w.severity === 'info'));
    assert.equal(pcIsoRoom.room.isolationRequired, true);
    // the staffing board derives its isolation flag from the same log (was hardcoded false)
    const staffBoard = await call('GET', `/api/Staffing/assignment/${ward.id}/${new Date().toISOString().slice(0, 10)}/day`, { token: tk });
    if (staffBoard.status === 200) {
        const chips = JSON.stringify(staffBoard.body);
        assert.ok(chips.includes('"isolation":true'), 'isolation chip derived from HAI events');
    }

    // --- transfer request queue
    const tr = await call('POST', '/api/transfer-requests', { token: nurse.token, body: { patientId: p2.id, requestedWardId: ward2.id, priority: 'urgent', reason: 'needs ICU' } });
    assert.equal(tr.status, 201, JSON.stringify(tr.body));
    assert.equal(tr.body.data.requestedWardName, 'ICU');
    assert.equal(tr.body.data.currentLocation, 'Tele · 201 · B');
    assert.equal((await call('POST', '/api/transfer-requests', { token: tk, body: { patientId: p2.id } })).status, 409, 'one open request per encounter');
    assert.equal((await call('GET', '/api/transfer-requests', { token: tk })).body.data.length, 1);
    const dash = (await call('GET', '/dashboard/ipd', { token: tk })).body.data;
    assert.deepEqual(dash.alerts.transferRequests, ['Bob Other → ICU (urgent)']);

    const ful = await call('POST', `/api/transfer-requests/${tr.body.data.id}/fulfill`, { token: tk, body: { bedId: bedC.id } });
    assert.equal(ful.status, 200, JSON.stringify(ful.body));
    assert.equal(ful.body.data.request.status, 'fulfilled');
    assert.equal(ful.body.data.request.fulfilledBedId, bedC.id);
    assert.equal(ful.body.data.transfer.toBedId, bedC.id);
    assert.equal((await call('GET', '/api/transfer-requests', { token: tk })).body.data.length, 0);
    assert.equal((await boardRow(bedC.id)).bed.bedStatus, 'occupied');

    // the vacated bed is dirty with an Isolation clean queued (p2 had an active isolation precaution)
    const rowB = await boardRow(bedB.id);
    assert.equal(rowB.bed.bedStatus, 'dirty');
    assert.equal(rowB.cleaning.evsStatus, 'dirty');
    assert.equal(rowB.cleaning.cleaningType, 'Isolation');
    assert.equal((await call('POST', '/api/admissions', { token: tk, body: { patientId: p3.id, bedId: bedB.id } })).status, 409, 'dirty bed cannot be assigned');
    assert.equal((await call('GET', '/dashboard/ipd', { token: tk })).body.data.alerts.bedsPendingCleaning.length, 1);

    // --- discharge sets 'dirty' (not 'available') and queues a Discharge clean
    await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId: enc1 } });
    await satisfyDischargeGates(tk, enc1);
    const conf = await call('POST', '/api/discharges', { token: tk, body: { phase: 'confirm', encounterId: enc1 } });
    assert.equal(conf.status, 200, JSON.stringify(conf.body));
    assert.ok(conf.body.data.evsQueueId);
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'dirty');

    // --- EVS turnaround: dirty -> in_cleaning -> pending_inspection -> clean -> bed available
    const queue = (await call('GET', '/api/evs/queue', { token: hk.token })).body.data;
    assert.equal(queue.length, 2);
    const itemA = queue.find((q) => q.bedId === bedA.id);
    assert.equal(itemA.evsStatus, 'dirty');
    assert.equal(itemA.cleaningType, 'Discharge');
    assert.equal(itemA.dischargedPatientName, 'Ann Hold');
    assert.equal(itemA.roomBedLabel, '201-A');
    const hks = (await call('GET', '/api/evs/housekeepers', { token: tk })).body.data;
    assert.ok(hks.some((u) => u.id === hk.id));
    const assigned = await call('POST', `/api/evs/queue/${itemA.id}/assign`, { token: nurse.token, body: { housekeeperId: hk.id } });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    assert.equal(assigned.body.data.assignedHousekeeperId, hk.id);
    assert.equal((await call('POST', `/api/evs/queue/${itemA.id}/complete`, { token: hk.token })).status, 409, 'must start before complete');
    assert.equal((await call('POST', `/api/evs/queue/${itemA.id}/start`, { token: hk.token })).body.data.evsStatus, 'in_cleaning');
    assert.equal((await call('POST', `/api/evs/queue/${itemA.id}/complete`, { token: hk.token })).body.data.evsStatus, 'pending_inspection');
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'dirty', 'still dirty until approved');
    const inspected = (await call('POST', `/api/evs/queue/${itemA.id}/inspect`, { token: nurse.token })).body.data;
    assert.equal(inspected.inspectedBy, 'bm-nurse User');
    const approved = (await call('POST', `/api/evs/queue/${itemA.id}/approve`, { token: nurse.token })).body.data;
    assert.equal(approved.evsStatus, 'clean');
    assert.equal(typeof approved.turnaroundMinutes, 'number');
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'available');
    const metrics = (await call('GET', '/api/evs/metrics', { token: tk })).body.data;
    assert.equal(metrics.bedsCleanedToday, 1);
    assert.equal(metrics.bedsDirty, 1);
    const bedMap = (await call('GET', `/api/evs/beds?ids=${bedA.id},${bedB.id}`, { token: tk })).body.data;
    assert.equal(bedMap[bedA.id].evsStatus, 'clean');
    assert.equal(bedMap[bedB.id].evsStatus, 'dirty');

    // --- expiry: an overdue hold is auto-released (expires_at manipulated directly rather than waiting)
    const r2 = (await call('POST', `/api/beds/${bedA.id}/reserve`, { token: tk, body: { patientId: p3.id, expiresInMinutes: 30 } })).body.data;
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'hold');
    await pool.query(`UPDATE bed_reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [r2.id]);
    assert.equal((await call('GET', '/api/bed-reservations', { token: tk })).body.data.length, 0, 'lazy sweep hides expired holds');
    assert.equal((await call('GET', `/api/bed-reservations/${r2.id}`, { token: tk })).body.data.status, 'expired');
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'available');

    // --- cancel releases the bed; extend pushes expiry out
    const r3 = (await call('POST', `/api/beds/${bedA.id}/reserve`, { token: tk, body: { patientId: p3.id, expiresInMinutes: 30 } })).body.data;
    const ext = await call('POST', `/api/bed-reservations/${r3.id}/extend`, { token: tk, body: { expiresInMinutes: 240 } });
    assert.equal(ext.status, 200);
    assert.ok(new Date(ext.body.data.expiresAt) > new Date(r3.expiresAt));
    assert.equal((await call('POST', `/api/bed-reservations/${r3.id}/cancel`, { token: tk })).body.data.status, 'cancelled');
    assert.equal((await call('POST', `/api/bed-reservations/${r3.id}/cancel`, { token: tk })).status, 409);
    assert.equal((await boardRow(bedA.id)).bed.bedStatus, 'available');

    // --- admin manual hold (no reservation) also blocks; admin marking dirty opens a cleaning job
    assert.equal((await call('PUT', '/Beds/updateBedById', { token: tk, body: { id: bedA.id, status: 'hold' } })).status, 200);
    const manual = await call('POST', '/api/admissions', { token: tk, body: { patientId: p3.id, bedId: bedA.id } });
    assert.equal(manual.status, 409);
    assert.match(manual.body.message, /manual hold/);
    assert.equal((await call('PUT', '/Beds/updateBedById', { token: tk, body: { id: bedA.id, status: 'dirty' } })).status, 200);
    assert.ok((await call('GET', '/api/evs/queue', { token: tk })).body.data.some((q) => q.bedId === bedA.id && q.evsStatus === 'dirty' && q.cleaningType === 'Routine'));
    assert.equal((await call('PUT', '/Beds/updateBedById', { token: tk, body: { id: bedA.id, status: 'available' } })).status, 200);
    assert.equal((await call('GET', '/api/evs/queue?status=dirty', { token: tk })).body.data.filter((q) => q.bedId === bedA.id).length, 0, 'admin sign-off closes the job');
    assert.equal((await call('POST', '/api/admissions', { token: tk, body: { patientId: p3.id, bedId: bedA.id } })).status, 201);

    // --- tenant isolation
    const other = await newTenant('beds-other');
    assert.equal((await call('GET', `/api/bed-reservations/${r3.id}`, { token: other.token })).status, 404);
    assert.equal((await call('POST', `/api/evs/queue/${itemA.id}/start`, { token: other.token })).status, 404);
    assert.equal((await call('GET', '/api/evs/queue', { token: other.token })).body.data.length, 0);

    // PUT /api/transfer-requests/:id must validate ward ownership the same way POST does
    // (regression: a foreign tenant's ward id was previously accepted and leaked back via requestedWardName)
    const foreignWard = (await call('POST', '/Wards/CreateWard', { token: other.token, body: { name: 'Foreign Ward' } })).body.data;
    const putForeign = await call('PUT', `/api/transfer-requests/${tr.body.data.id}`, { token: tk, body: { requestedWardId: foreignWard.id } });
    assert.equal(putForeign.status, 404, JSON.stringify(putForeign.body));
    const afterPut = await pool.query('SELECT requested_ward_id FROM transfer_requests WHERE id = $1', [tr.body.data.id]);
    assert.equal(afterPut.rows[0].requested_ward_id, ward2.id, 'foreign ward id must not be written');
});

test('patient registration: full demographics, both insurances and emergency contacts propagate to every read URL', async () => {
    const t = await newTenant('reg');
    const tk = t.token;
    const body = {
        prefix: 'Ms.', firstName: 'Full', middleName: 'Reg', lastName: 'Istration', suffix: 'Jr.',
        dOB: '1990-04-12', sex: 'F', maritalStatus: 'Married', email: 'full@example.test', workEmail: 'full.work@example.test',
        homePhone: '(555) 111-2222', mobilePhone: '(555) 333-4444', workPhone: '(555) 555-6666', otherPhone: '',
        pregnant: false, breastfeeding: false,
        address1: '1 Main St', address2: 'Apt 2', city: 'Springfield', state: 'IL', zipCode: '62701',
        mailingAddress1: 'PO Box 9', mailingCity: 'Springfield', mailingState: 'IL', mailingZipCode: '62702',
        preferredLanguage: 'English', ethnicity: 'Not Hispanic or Latino', race: 'White', countryOfBirth: 'United States',
        advancedHealthCareDirective: 'No Advance Directive', noticeOfPrivacyPracticesDate: '2026-01-15',
        insurance: {
            insuranceType: 'Employer-Provided', insuranceCompany: 'Blue Shield', subscriberId: 'BS123', insurancePlan: 'PPO (Preferred Provider Organization)',
            groupNumber: 'G-77', phoneNumber: '(800) 111-1111', coverageStartDate: '2025-01-01', terminationDate: '', insuranceStatus: 'Active',
            coPayAmount: '25.50', medicalGroup: 'Prospect Medical Group / IPA', pcp: 'Smith, John A., MD', guarantor: 'Self',
        },
        secondaryInsurance: {
            insuranceType: 'Medicaid', insuranceCompany: 'State Medicaid', subscriberId: 'MD999', insuranceStatus: 'Inactive',
            guarantor: 'Spouse', guarantorName: 'Pat Istration', guarantorDOB: '1988-02-02', guarantorAddress: '1 Main St', guarantorSubscriberId: 'MD998',
        },
        emergencyContacts: [
            { relationshipToPatient: 'Spouse', contactName: 'Pat Istration', contactPhone: '(555) 777-8888', street: '1 Main St', emergencyCity: 'Springfield', emergencyState: 'IL', emergencyZipCode: '62701' },
            { relationshipToPatient: 'Sibling', contactName: 'Sam Istration', contactPhone: '(555) 999-0000' },
        ],
    };
    const createRes = await call('POST', '/Patient/createPatient', { token: tk, body });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    // Stedi is disabled under NODE_ENV=test, so both insured slots report 'skipped' and eligible is null.
    assert.equal(createRes.body.eligibility.eligible, null);
    assert.equal(createRes.body.eligibility.stediEnabled, false);
    assert.equal(createRes.body.eligibility.primary.status, 'skipped');
    assert.equal(createRes.body.eligibility.secondary.status, 'skipped');
    const p = createRes.body.data;

    const expectEnriched = (x) => {
        assert.equal(x.prefix, 'Ms.');
        assert.equal(x.suffix, 'Jr.');
        assert.equal(x.maritalStatus, 'Married');
        assert.equal(x.preferredLanguage, 'English');
        assert.equal(x.race, 'White');
        assert.equal(x.workPhone, '(555) 555-6666');
        assert.equal(x.otherPhone, '');
        assert.equal(x.pregnant, false);
        assert.equal(x.noticeOfPrivacyPracticesDate, '2026-01-15');
        assert.deepEqual(x.mailingAddress, { address1: 'PO Box 9', address2: '', city: 'Springfield', state: 'IL', zipCode: '62702' });
        assert.equal(x.insurance.rank, 'primary');
        assert.equal(x.insurance.insuranceCompany, 'Blue Shield');
        assert.equal(x.insurance.insuranceStatus, 'Active');
        assert.equal(x.insurance.coPayAmount, 25.5);
        assert.equal(x.insurance.coverageStartDate, '2025-01-01');
        assert.equal(x.insurance.terminationDate, '');
        assert.equal(x.secondaryInsurance.rank, 'secondary');
        assert.equal(x.secondaryInsurance.insuranceStatus, 'Inactive');
        assert.equal(x.secondaryInsurance.guarantorName, 'Pat Istration');
        assert.equal(x.secondaryInsurance.guarantorDOB, '1988-02-02');
        assert.equal(x.emergencyContacts.length, 2);
        assert.equal(x.emergencyContacts[0].contactName, 'Pat Istration');
        assert.equal(x.emergencyContacts[1].relationshipToPatient, 'Sibling');
        assert.equal(x.emergencyContact.contactPhone, '(555) 777-8888');
    };
    expectEnriched(p);

    // All three read aliases return the identical enriched shape.
    const reads = await Promise.all([
        call('GET', `/Patient/getPatientById/${p.id}`, { token: tk }),
        call('GET', `/Patient/getPatientDemographics/${p.id}`, { token: tk }),
        call('GET', `/patient/getPatientByID/${p.id}`, { token: tk }),
    ]);
    for (const r of reads) { assert.equal(r.status, 200); expectEnriched(r.body.data); }
    assert.deepEqual(reads[0].body.data, reads[1].body.data);
    assert.deepEqual(reads[1].body.data, reads[2].body.data);

    // Paginated list inherits the same fields.
    const list = await call('GET', '/Patient/getAllPatientListPaginated?page=1&limit=10', { token: tk });
    assert.equal(list.body.data.total, 1);
    expectEnriched(list.body.data.items[0]);

    // Update: flat field + upsert of secondary insurance + clearing the second emergency contact (blank block = delete).
    const upd = await call('PUT', `/Patient/updatePatientDetails/${p.id}`, { token: tk, body: {
        maritalStatus: 'Divorced',
        secondaryInsurance: { ...body.secondaryInsurance, insuranceStatus: 'Active', insuranceCompany: 'State Medicaid 2' },
        emergencyContacts: [body.emergencyContacts[0], {}],
    } });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    assert.equal(upd.body.data.maritalStatus, 'Divorced');
    assert.equal(upd.body.data.insurance.insuranceCompany, 'Blue Shield', 'primary untouched when absent from body');
    assert.equal(upd.body.data.secondaryInsurance.insuranceCompany, 'State Medicaid 2');
    assert.equal(upd.body.data.secondaryInsurance.insuranceStatus, 'Active');
    assert.equal(upd.body.data.emergencyContacts.length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM patient_insurance WHERE patient_id = $1', [p.id])).rows[0].n, 2);

    // Nested-only update is accepted (no flat fields).
    const nestedOnly = await call('PUT', `/Patient/updatePatientById/${p.id}`, { token: tk, body: { emergencyContacts: [] } });
    assert.equal(nestedOnly.status, 200);
    assert.equal(nestedOnly.body.data.emergencyContacts.length, 0);

    // Validation: bad nested date / status rejected; blank nested blocks are not persisted; atomicity on failure.
    assert.equal((await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Bad', lastName: 'Ins', insurance: { coverageStartDate: 'yesterday' } } })).status, 400);
    assert.equal((await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Bad', lastName: 'Status', insurance: { insuranceStatus: 'maybe' } } })).status, 400);
    const blank = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Blank', lastName: 'Blocks', insurance: {}, secondaryInsurance: { insuranceCompany: '' }, emergencyContacts: [{}, {}] } })).body.data;
    assert.equal(blank.insurance, null);
    assert.equal(blank.secondaryInsurance, null);
    assert.deepEqual(blank.emergencyContacts, []);
    assert.equal(blank.emergencyContact, null);
    const before = (await pool.query('SELECT count(*)::int AS n FROM patients WHERE tenant_id = $1', [t.user.tenant.id])).rows[0].n;
    // guarantor_dob is a DATE column: an over-long guarantor name passes Zod? no — force a DB-level failure with a too-long value that Zod allows.
    const atomic = await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Atomic', lastName: 'Fail', insurance: { insuranceCompany: 'X', coPayAmount: 99999999 } } });
    assert.equal(atomic.status, 400, 'copay above schema max is rejected before any write');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM patients WHERE tenant_id = $1', [t.user.tenant.id])).rows[0].n, before);

    // Legacy verify alias forwards to the real inline runner (skipped without Stedi; history still filed for a saved patient).
    const elig = await call('POST', '/Patient/verifyEligibility', { token: tk, body: { patientId: p.id, firstName: 'Full', lastName: 'Istration', dOB: '1990-04-12', insurance: body.insurance } });
    assert.equal(elig.status, 200, JSON.stringify(elig.body));
    assert.equal(elig.body.data.primary.status, 'skipped');
    assert.equal(elig.body.stediEnabled, false);

    // Tenant isolation holds on the new tables and on the update alias.
    const other = await newTenant('regB');
    assert.equal((await call('GET', `/Patient/getPatientDemographics/${p.id}`, { token: other.token })).status, 404);
    assert.equal((await call('PUT', `/Patient/updatePatientDetails/${p.id}`, { token: other.token, body: { insurance: { insuranceCompany: 'Hijack' } } })).status, 404);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM patient_insurance WHERE tenant_id = $1', [other.user.tenant.id])).rows[0].n, 0);
    const mine = await call('GET', `/Patient/getPatientById/${p.id}`, { token: tk });
    assert.equal(mine.body.data.insurance.insuranceCompany, 'Blue Shield', 'other tenant could not overwrite insurance');
});

test('tenant profile (Practice Information): GET/PUT round-trip, NPI Luhn checksum, role + tenant isolation', async () => {
    const t = await newTenant('profile');
    const tk = t.token;

    // No tenant_profile row yet (upsert hasn't run) — GET still succeeds with the tenant's name and null fields.
    const empty = await call('GET', '/api/tenant/profile', { token: tk });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.data.name, 'Org profile');
    assert.equal(empty.body.data.address, null);
    assert.equal(empty.body.data.groupNpi, null);

    const nurse = (await call('POST', '/auth/register-user', { token: tk, body: { email: `profile-nurse-${suffix}@test.example`, password: 'Nurse-passw0rd', role: 'nurse', firstName: 'N' } }));
    const nurseLogin = await call('POST', '/login', { body: { username: `profile-nurse-${suffix}@test.example`, password: 'Nurse-passw0rd' } });
    assert.equal((await call('PUT', '/api/tenant/profile', { token: nurseLogin.body.token, body: { name: 'Nope' } })).status, 403, 'nurse cannot edit practice information');

    const validBody = {
        name: 'Acme Health Clinic',
        address: '123 Main St',
        address2: 'Suite 2',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        phone: '(217) 555-0100',
        fax: '(217) 555-0101',
        ein: '12-3456789',
        groupNpi: '1234567891', // shape-valid (10 digits, starts 1-9) but WRONG check digit (correct is …95)
    };
    const badChecksum = await call('PUT', '/api/tenant/profile', { token: tk, body: validBody });
    assert.equal(badChecksum.status, 400, 'a correctly-shaped but checksum-invalid NPI must be rejected, proving the Luhn check actually runs');
    assert.match(badChecksum.body.message, /NPI/);

    const saved = await call('PUT', '/api/tenant/profile', { token: tk, body: { ...validBody, groupNpi: '1234567895' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.name, 'Acme Health Clinic');
    assert.equal(saved.body.data.address, '123 Main St');
    assert.equal(saved.body.data.address2, 'Suite 2');
    assert.equal(saved.body.data.city, 'Springfield');
    assert.equal(saved.body.data.state, 'IL');
    assert.equal(saved.body.data.zip, '62701');
    assert.equal(saved.body.data.phone, '(217) 555-0100');
    assert.equal(saved.body.data.ein, '12-3456789');
    assert.equal(saved.body.data.groupNpi, '1234567895');

    // Round-trips on GET, including the renamed tenant (PUT also updates tenants.name).
    const reread = await call('GET', '/api/tenant/profile', { token: tk });
    assert.deepEqual(reread.body.data, saved.body.data);

    // Field-level validation: bad zip, bad phone shape, bad EIN shape are all rejected.
    assert.equal((await call('PUT', '/api/tenant/profile', { token: tk, body: { ...validBody, groupNpi: '1234567895', zip: '123' } })).status, 400);
    assert.equal((await call('PUT', '/api/tenant/profile', { token: tk, body: { ...validBody, groupNpi: '1234567895', phone: '217-555-0100' } })).status, 400);
    assert.equal((await call('PUT', '/api/tenant/profile', { token: tk, body: { ...validBody, groupNpi: '1234567895', ein: '123456789' } })).status, 400);

    // Regression: the edit form round-trips an untouched optional field's GET value (`null`) straight
    // back into the PUT body rather than omitting it — null must be accepted the same as "not sent".
    const nulledOptional = await call('PUT', '/api/tenant/profile', { token: tk, body: { ...validBody, groupNpi: '1234567895', address2: null, fax: null, ein: null } });
    assert.equal(nulledOptional.status, 200, JSON.stringify(nulledOptional.body));
    assert.equal(nulledOptional.body.data.address2, null);
    assert.equal(nulledOptional.body.data.ein, null);

    // Tenant isolation: a second tenant has its own empty profile, never sees the first tenant's data.
    const other = await newTenant('profileB');
    const otherGet = await call('GET', '/api/tenant/profile', { token: other.token });
    assert.equal(otherGet.body.data.address, null);
    assert.notEqual(otherGet.body.data.name, 'Acme Health Clinic');
});

test('patient registration follow-ups: race-safe MRNs, duplicate check, profile photo', async () => {
    const t = await newTenant('reg2');
    const tk = t.token;
    // 8 concurrent creates must all succeed with distinct MRNs (counter, not count(*)+1).
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
        call('POST', '/Patient/createPatient', { token: tk, body: { firstName: `Race${i}`, lastName: 'Condition' } })));
    for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));
    const mrns = results.map((r) => r.body.data.mrn);
    assert.equal(new Set(mrns).size, 8, `duplicate MRNs: ${mrns}`);
    // Caller-supplied MRN that collides with the next counter value: auto-numbering skips past it.
    const taken = await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Manual', lastName: 'Mrn', mrn: 'MRN000009' } });
    assert.equal(taken.status, 201);
    const next = await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Auto', lastName: 'After' } });
    assert.equal(next.status, 201, JSON.stringify(next.body));
    assert.notEqual(next.body.data.mrn, 'MRN000009');
    assert.equal((await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Dup', lastName: 'Mrn', mrn: 'MRN000009' } })).status, 409);

    // Duplicate check: last name + DOB, or first + last; excludeId; tenant-scoped.
    const jane = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Jane', lastName: 'Dupe', dOB: '1980-01-02' } })).body.data;
    const byDob = await call('GET', '/Patient/findDuplicates?lastName=dupe&dOB=1980-01-02&firstName=Someone', { token: tk });
    assert.deepEqual(byDob.body.data.map((p) => p.id), [jane.id]);
    const byName = await call('GET', '/Patient/findDuplicates?lastName=DUPE&firstName=jane', { token: tk });
    assert.deepEqual(byName.body.data.map((p) => p.id), [jane.id]);
    assert.deepEqual((await call('GET', `/Patient/findDuplicates?lastName=dupe&firstName=jane&excludeId=${jane.id}`, { token: tk })).body.data, []);
    assert.deepEqual((await call('GET', '/Patient/findDuplicates?lastName=dupe&dOB=1999-09-09', { token: tk })).body.data, []);
    assert.equal((await call('GET', '/Patient/findDuplicates?firstName=jane', { token: tk })).status, 400);
    const other = await newTenant('reg2B');
    assert.deepEqual((await call('GET', '/Patient/findDuplicates?lastName=dupe&firstName=jane', { token: other.token })).body.data, []);

    // Profile photo: data URL stored and returned by every read; bad payloads rejected; clearable.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const up = await call('PUT', `/Patient/updateProfilePicture/${jane.id}`, { token: tk, body: { profilePicture: png } });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.equal(up.body.data.profilePicture, png);
    assert.equal((await call('GET', `/Patient/getPatientById/${jane.id}`, { token: tk })).body.data.profilePicture, png);
    assert.equal((await call('PUT', `/Patient/updateProfilePicture/${jane.id}`, { token: tk, body: { profilePicture: 'https://evil.example/x.png' } })).status, 400);
    assert.equal((await call('PUT', `/Patient/updateProfilePicture/${jane.id}`, { token: tk, body: { profilePicture: 'data:text/html;base64,PHNjcmlwdD4=' } })).status, 400);
    assert.equal((await call('PUT', `/Patient/updateProfilePicture/${jane.id}`, { token: other.token, body: { profilePicture: png } })).status, 404);
    const cleared = await call('PUT', `/Patient/updateProfilePicture/${jane.id}`, { token: tk, body: { profilePicture: null } });
    assert.equal(cleared.body.data.profilePicture, '');

    // Search now matches home / work phone.
    await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Phone', lastName: 'Search', homePhone: '(217) 555-9876', workPhone: '(217) 555-1234' } });
    assert.equal((await call('GET', '/Patient/getAllPatientListPaginated?query=555-9876', { token: tk })).body.data.items.length, 1);
    assert.equal((await call('GET', '/Patient/getAllPatientListPaginated?query=555-1234', { token: tk })).body.data.items.length, 1);
});


test('eligibility: payer search gated on Stedi, inline check validates, persists history only for saved patients', async () => {
    const t = await newTenant('elig');
    const tk = t.token;
    // Stedi is disabled in the test env: the payer directory is unavailable, not a crash.
    const search = await call('GET', '/Payers/search?query=aetna', { token: tk });
    assert.equal(search.status, 503);
    assert.equal(search.body.code, 'STEDI_DISABLED');
    assert.equal((await call('GET', '/Payers/search', { token: tk })).status, 400, 'query required');

    // Validation.
    assert.equal((await call('POST', '/Eligibility/checkInline', { token: tk, body: { firstName: 'A' } })).status, 400);
    assert.equal((await call('POST', '/Eligibility/checkInline', { token: tk, body: { firstName: 'A', lastName: 'B', dOB: '1990-01-01', serviceTypeCodes: ['bad code'] } })).status, 400);

    // No insurance → nothing to check.
    const none = await call('POST', '/Eligibility/checkInline', { token: tk, body: { firstName: 'A', lastName: 'B', dOB: '1990-01-01' } });
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.data, {});

    // Unsaved patient: per-slot result, no history row.
    const inline = await call('POST', '/Eligibility/checkInline', { token: tk, body: {
        firstName: 'A', lastName: 'B', dOB: '1990-01-01', sex: 'F', serviceTypeCodes: ['48'],
        insurance: { insuranceCompany: 'Aetna', tradingPartnerServiceId: '60054', subscriberId: 'W1' },
        secondaryInsurance: { insuranceCompany: 'Nobody', subscriberId: '' },
    } });
    assert.equal(inline.status, 200, JSON.stringify(inline.body));
    assert.equal(inline.body.data.primary.status, 'skipped');
    assert.equal(inline.body.data.primary.id, null);
    assert.equal(inline.body.data.secondary, undefined, 'slot without member id is not checked');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM eligibility_checks WHERE tenant_id = $1', [t.user.tenant.id])).rows[0].n, 0);

    // Saved patient: history is filed and readable; trading partner id persists on the insurance row.
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: {
        firstName: 'Eli', lastName: 'Gible', dOB: '1985-02-03', sex: 'M',
        insurance: { insuranceCompany: 'Aetna', tradingPartnerServiceId: '60054', subscriberId: 'W2', insuranceStatus: 'Active' },
    } })).body.data;
    assert.equal(p.insurance.tradingPartnerServiceId, '60054');
    const saved = await call('POST', '/Eligibility/checkInline', { token: tk, body: { patientId: p.id, firstName: 'Eli', lastName: 'Gible', dOB: '1985-02-03', insurance: p.insurance } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.ok(saved.body.data.primary.id, 'history row id returned');
    const history = await call('GET', `/Eligibility/historyByPatient/${p.id}`, { token: tk });
    // createPatient filed one check per insured slot too, so there are two rows for the primary slot.
    assert.equal(history.body.data.length, 2);
    assert.equal(history.body.data[0].slot, 'primary');
    assert.equal(history.body.data[0].status, 'skipped');
    assert.equal(history.body.data[0].tradingPartnerServiceId, '60054');
    const one = await call('GET', `/Eligibility/getById/${saved.body.data.primary.id}`, { token: tk });
    assert.equal(one.status, 200);
    assert.equal(one.body.data.patientId, p.id);

    // Tenant isolation: foreign patient id → 404; foreign history → empty; foreign check → 404.
    const other = await newTenant('eligB');
    assert.equal((await call('POST', '/Eligibility/checkInline', { token: other.token, body: { patientId: p.id, firstName: 'Eli', lastName: 'Gible', dOB: '1985-02-03', insurance: p.insurance } })).status, 404);
    assert.deepEqual((await call('GET', `/Eligibility/historyByPatient/${p.id}`, { token: other.token })).body.data, []);
    assert.equal((await call('GET', `/Eligibility/getById/${saved.body.data.primary.id}`, { token: other.token })).status, 404);
});

test('problem list / ICD-10: search, CRUD, status lifecycle, roles, tenant isolation', async () => {
    // Catalog rows for this test only (full CMS import is via db:seed:icd10).
    await pool.query(
        `INSERT INTO icd10_codes (code, description, billable, effective_year) VALUES
            ('E11.9', 'Type 2 diabetes mellitus without complications', true, 2026),
            ('I10', 'Essential (primary) hypertension', true, 2026),
            ('J18.9', 'Pneumonia, unspecified organism', true, 2026)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
    );

    const a = await newTenant('prob');
    const physician = await addUser(a, 'probmd', 'physician');
    const nurse = await addUser(a, 'probnurse', 'nurse');
    const billing = await addUser(a, 'probbill', 'billing');
    const tk = a.token;

    const emptySearch = await call('GET', '/api/icd10/search?q=', { token: tk });
    assert.equal(emptySearch.status, 200);
    assert.deepEqual(emptySearch.body.data, []);

    const search = await call('GET', '/api/icd10/search?q=diabetes', { token: tk });
    assert.equal(search.status, 200);
    assert.ok(search.body.data.some((r) => r.code === 'E11.9'));

    const codeSearch = await call('GET', '/api/icd10/search?q=I10', { token: tk });
    assert.ok(codeSearch.body.data.some((r) => r.code === 'I10'));

    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: 'Pat', lastName: 'Problem' } })).body.data;
    const otherTenant = await newTenant('probB');
    const foreignPatient = (await call('POST', '/Patient/createPatient', { token: otherTenant.token, body: { firstName: 'X', lastName: 'Y' } })).body.data;

    assert.equal((await call('POST', `/api/patients/${p.id}/problems`, { token: billing.token, body: { icd10Code: 'E11.9' } })).status, 403);

    const badCode = await call('POST', `/api/patients/${p.id}/problems`, { token: physician.token, body: { icd10Code: 'NOTAREAL' } });
    assert.equal(badCode.status, 400);

    const createdDx = await call('POST', `/api/patients/${p.id}/problems`, {
        token: physician.token,
        body: { icd10Code: 'E11.9', chronicity: 'chronic', onsetDate: '2020-01-15' },
    });
    assert.equal(createdDx.status, 201, JSON.stringify(createdDx.body));
    assert.equal(createdDx.body.data.icd10Code, 'E11.9');
    assert.equal(createdDx.body.data.status, 'active');
    assert.equal(createdDx.body.data.chronicity, 'chronic');
    assert.equal(createdDx.body.data.notedBy, physician.id);
    const problemId = createdDx.body.data.id;

    const dup = await call('POST', `/api/patients/${p.id}/problems`, { token: nurse.token, body: { icd10Code: 'E11.9' } });
    assert.equal(dup.status, 409);

    await call('POST', `/api/patients/${p.id}/problems`, { token: nurse.token, body: { icd10Code: 'I10', chronicity: 'chronic' } });
    await call('POST', `/api/patients/${p.id}/problems`, { token: nurse.token, body: { icd10Code: 'J18.9', chronicity: 'acute' } });

    const activeList = await call('GET', `/api/patients/${p.id}/problems`, { token: tk });
    assert.equal(activeList.status, 200);
    assert.equal(activeList.body.data.length, 3);
    assert.equal(activeList.body.data[0].chronicity, 'chronic');
    // Active chronic before active acute
    const firstAcuteIdx = activeList.body.data.findIndex((r) => r.chronicity === 'acute');
    const lastChronicIdx = activeList.body.data.map((r) => r.chronicity).lastIndexOf('chronic');
    assert.ok(lastChronicIdx < firstAcuteIdx);

    const resolved = await call('PATCH', `/api/problems/${problemId}`, { token: physician.token, body: { status: 'resolved' } });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.data.status, 'resolved');
    assert.ok(resolved.body.data.resolvedDate);

    const afterResolve = await call('GET', `/api/patients/${p.id}/problems`, { token: tk });
    assert.equal(afterResolve.body.data.length, 2);
    assert.ok(!afterResolve.body.data.some((r) => r.id === problemId));

    const withHistory = await call('GET', `/api/patients/${p.id}/problems?includeResolved=true`, { token: tk });
    assert.ok(withHistory.body.data.some((r) => r.id === problemId && r.status === 'resolved'));

    const badTransition = await call('PATCH', `/api/problems/${problemId}`, { token: physician.token, body: { status: 'entered_in_error' } });
    assert.equal(badTransition.status, 200);
    const errMarked = badTransition.body.data;
    assert.equal(errMarked.status, 'entered_in_error');

    const historyAfterError = await call('GET', `/api/patients/${p.id}/problems?includeResolved=true`, { token: tk });
    assert.ok(!historyAfterError.body.data.some((r) => r.id === problemId), 'entered_in_error excluded from clinical views');

    const revive = await call('PATCH', `/api/problems/${problemId}`, { token: physician.token, body: { status: 'active' } });
    assert.equal(revive.status, 400, 'entered_in_error is terminal');

    assert.equal((await call('GET', `/api/patients/${foreignPatient.id}/problems`, { token: tk })).status, 404);
    assert.equal((await call('POST', `/api/patients/${foreignPatient.id}/problems`, { token: physician.token, body: { icd10Code: 'I10' } })).status, 404);
    assert.equal((await call('PATCH', `/api/problems/${problemId}`, { token: otherTenant.token, body: { status: 'inactive' } })).status, 404);

    // NANDA search still works (regression).
    assert.equal((await call('GET', '/api/CarePlan/nanda/search?q=falls', { token: tk })).status, 200);
});

// ============================================================================ Phase 1 partial-module completion
async function admitPatient(tk, label, patientBody = {}) {
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: `W-${label}` } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: `R-${label}` } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: `B-${label}` } })).body.data;
    const bed2 = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: `B2-${label}` } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1960-04-05', sex: 'F', ...patientBody } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Chest pain' } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id, bed, bed2, ward, room };
}

test('physician notes / H&P: create → update → sign → immutable → addendum → list; nurse cannot author H&P; CMS 24h flag', async () => {
    const t = await newTenant('notes');
    const tk = t.token;
    const md = await addUser(t, 'mdnotes', 'physician');
    const rn = await addUser(t, 'rnnotes', 'nurse');
    const { patient, encounterId } = await admitPatient(tk, 'Notes');
    const BASE = '/api/inpatient/clinical';

    // Template matches the reference implementation: content keyed by hpi / ros / assessment / plan.
    const content = { hpi: '55yo admitted for chest pain.', ros: 'See intake.', assessment: 'Rule out ACS.', plan: 'Serial troponins, cardiology consult.' };
    assert.equal((await call('POST', `${BASE}/notes/create`, { token: rn.token, body: { patientId: patient.id, encounterId, type: 'hp', content } })).status, 403, 'nurse cannot author H&P');
    assert.equal((await call('POST', `${BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'bogus', content } })).status, 400);
    const created = await call('POST', `${BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'hp', content } });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.status, 'success');
    const note = created.body.data;
    assert.equal(note.status, 'draft');
    assert.deepEqual(note.content, content);
    assert.equal(note.versionHistory.length, 1);
    assert.equal(note.cmsCompliance.isLate, false);
    assert.ok(note.cmsCompliance.deadline);

    const upd = await call('PUT', `${BASE}/notes/update/${note.id}`, { token: md.token, body: { content: { plan: 'Add telemetry overnight.' } } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.content.plan, 'Add telemetry overnight.');
    assert.equal(upd.body.data.content.hpi, content.hpi, 'partial update merges sections');
    assert.equal(upd.body.data.versionHistory.length, 2);

    assert.equal((await call('POST', `${BASE}/notes/addendum/${note.id}`, { token: md.token, body: { text: 'too early' } })).status, 400, 'addendum only on signed notes');
    assert.equal((await call('POST', `${BASE}/notes/sign/${note.id}`, { token: rn.token })).status, 403);
    const signed = await call('POST', `${BASE}/notes/sign/${note.id}`, { token: md.token });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.equal(signed.body.data.status, 'signed');
    assert.ok(signed.body.data.signedAt);
    assert.equal(signed.body.data.cmsCompliance.isLate, false, 'signed within 24h of admission');
    assert.equal((await call('POST', `${BASE}/notes/sign/${note.id}`, { token: md.token })).status, 409);
    assert.equal((await call('PUT', `${BASE}/notes/update/${note.id}`, { token: md.token, body: { content: { plan: 'x' } } })).status, 409, 'signed note is immutable');

    const add = await call('POST', `${BASE}/notes/addendum/${note.id}`, { token: md.token, body: { text: 'Patient discussed risks/benefits with cardiology.' } });
    assert.equal(add.status, 200);
    assert.equal(add.body.data.addenda.length, 1);
    assert.equal(add.body.data.addenda[0].createdBy, md.id);

    // Late H&P: an admission 2 days ago signed now is flagged (not blocked).
    await pool.query(`UPDATE encounters SET admitted_at = now() - interval '2 days' WHERE id = $1`, [encounterId]);
    const late = (await call('POST', `${BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'hp', content } })).body.data;
    const lateSign = await call('POST', `${BASE}/notes/sign/${late.id}`, { token: md.token });
    assert.equal(lateSign.status, 200);
    assert.equal(lateSign.body.data.cmsCompliance.isLate, true);
    assert.match(lateSign.body.message, /24-hour/);

    // Progress note by a nurse is allowed; list by encounter shows all three, newest first.
    assert.equal((await call('POST', `${BASE}/notes/create`, { token: rn.token, body: { patientId: patient.id, encounterId, type: 'progress', content: { assessment: 'stable', plan: 'continue' } } })).status, 200);
    const list = await call('GET', `${BASE}/notes/patient/${patient.id}?encounterId=${encounterId}`, { token: tk });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 3);
    assert.equal(list.body.data[0].type, 'progress');
    assert.equal((await call('GET', `${BASE}/notes/patient/${patient.id}`, { token: (await newTenant('notesB')).token })).body.data.length, 0, 'tenant isolation');
});

test('medication reconciliation: home meds → admission rec creates inpatient meds → discharge rec writes discharge_medications', async () => {
    const t = await newTenant('medrec');
    const tk = t.token;
    const rn = await addUser(t, 'rnrec', 'nurse');
    const { patient, encounterId } = await admitPatient(tk, 'Rec');
    const home = async (body) => (await call('POST', `/api/patients/${patient.id}/home-medications`, { token: rn.token, body })).body.data;
    const lisin = await home({ name: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily', reportedBy: 'patient' });
    const metf = await home({ name: 'Metformin', dose: '500 mg', route: 'PO', frequency: 'BID', reportedBy: 'pharmacy' });
    await home({ name: 'Ibuprofen', dose: '200 mg', route: 'PO', frequency: 'PRN', reportedBy: 'patient' });
    assert.equal((await call('GET', `/api/patients/${patient.id}/home-medications`, { token: tk })).body.data.length, 3);
    assert.equal((await call('GET', `/api/patients/${patient.id}/medications`, { token: tk })).body.data.length, 0, 'home meds do not appear on the MAR list');
    assert.equal((await call('GET', `/api/patients/${patient.id}/medications?source=all`, { token: tk })).body.data.length, 3);

    // Admission reconciliation auto-populates from home meds.
    const adm = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation/admission`, { token: tk })).body.data;
    assert.equal(adm.status, 'draft');
    assert.equal(adm.lines.length, 3);
    assert.equal(adm.lines[0].source, 'home');
    const missing = await call('POST', `/api/encounters/${encounterId}/med-reconciliation/admission/complete`, { token: rn.token, body: {} });
    assert.equal(missing.status, 400, 'every line needs an action');
    const lines = adm.lines.map((l) => l.originalMedicationId === lisin.id ? { ...l, action: 'continue' } : l.originalMedicationId === metf.id ? { ...l, action: 'modify', dose: '1000 mg', reason: 'uncontrolled glucose' } : { ...l, action: 'stop', reason: 'NSAID held' });
    lines.push({ name: 'Heparin', dose: '5000 units', route: 'SC', frequency: 'q8h', action: 'new', reason: 'VTE prophylaxis' });
    const saved = await call('PUT', `/api/encounters/${encounterId}/med-reconciliation/admission`, { token: rn.token, body: { lines } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const done = await call('POST', `/api/encounters/${encounterId}/med-reconciliation/admission/complete`, { token: rn.token, body: {} });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.status, 'completed');
    assert.equal(done.body.data.completedBy, rn.id);
    const inpatient = (await call('GET', `/api/patients/${patient.id}/medications`, { token: tk })).body.data;
    assert.deepEqual(inpatient.map((m) => `${m.name} ${m.dose}`).sort(), ['Heparin 5000 units', 'Lisinopril 10 mg', 'Metformin 1000 mg']);
    assert.equal((await call('PUT', `/api/encounters/${encounterId}/med-reconciliation/admission`, { token: rn.token, body: { lines } })).status, 409, 'completed rec is locked');

    // Discharge reconciliation lists inpatient actives plus untouched home meds (Ibuprofen was stopped but is still a home med).
    const dis = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation/discharge`, { token: tk })).body.data;
    assert.equal(dis.lines.filter((l) => l.source === 'inpatient').length, 3);
    assert.ok(dis.lines.some((l) => l.name === 'Ibuprofen' && l.source === 'home'));
    const disLines = dis.lines.map((l) => (l.name === 'Heparin' ? { ...l, action: 'stop', reason: 'inpatient only' } : l.name === 'Ibuprofen' ? { ...l, action: 'stop' } : { ...l, action: 'continue', duration: '30 days' }));
    const disDone = await call('POST', `/api/encounters/${encounterId}/med-reconciliation/discharge/complete`, { token: rn.token, body: { lines: disLines } });
    assert.equal(disDone.status, 200, JSON.stringify(disDone.body));
    const dm = (await call('GET', `/api/discharges/${encounterId}/medications`, { token: tk })).body.data;
    assert.deepEqual(dm.medications.map((m) => m.name).sort(), ['Lisinopril', 'Metformin']);
    assert.equal(dm.medications[0].duration, '30 days');
    assert.equal((await call('GET', `/api/patients/${patient.id}/medications`, { token: tk })).body.data.some((m) => m.name === 'Heparin'), false, 'stopped inpatient med discontinued');
    const overview = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation`, { token: tk })).body.data;
    assert.deepEqual(overview.map((r) => `${r.type}:${r.status}`).sort(), ['admission:completed', 'discharge:completed']);
    // The nursing checklist "medication reconciliation" task auto-completed.
    const view = (await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: tk })).body.data;
    assert.equal(view.checklist.find((x) => /medication reconciliation/i.test(x.label)).completed, true);
    assert.equal(view.medRecComplete, true);
});

test('discharge summary + readiness: gates unresolved → summary → sign blocked without med rec → sign → confirm discharge', async () => {
    const t = await newTenant('dsum');
    const tk = t.token;
    const md = await addUser(t, 'mdsum', 'physician');
    const rn = await addUser(t, 'rnsum', 'nurse');
    const { patient, encounterId } = await admitPatient(tk, 'Sum');

    const v0 = await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: rn.token });
    assert.equal(v0.status, 200, JSON.stringify(v0.body));
    const view0 = v0.body.data;
    assert.equal(view0.context.patientId, patient.id);
    assert.equal(view0.context.patientName, 'Sum Patient');
    assert.equal(view0.summary.status, 'draft');
    assert.equal(view0.checklist.length, 5, 'default checklist seeded on first fetch');
    assert.equal(view0.charges, null);
    assert.equal(view0.sections.charges.available, false);
    assert.ok(Array.isArray(view0.eligibilityHistory));
    assert.ok(view0.gates.find((g) => g.id === 'gate-summary-signed' && !g.resolved));
    assert.ok(view0.gates.find((g) => g.id === 'gate-med-reconciliation' && !g.resolved));
    assert.equal(view0.clinicalReady, false);
    assert.equal((await call('POST', `/api/encounters/${encounterId}/discharge-checklist/seed`, { token: rn.token })).body.data.seeded, false, 'idempotent');

    assert.equal((await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: rn.token, body: { hospitalCourse: 'x' } })).status, 403, 'nurse cannot write the summary');
    assert.equal((await call('POST', `/api/encounters/${encounterId}/discharge-summary/sign`, { token: md.token, body: {} })).status, 400, 'nothing saved yet');
    const draft = await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: md.token, body: { admissionDiagnosis: 'Chest pain', hospitalCourse: 'Ruled out ACS. Observed on telemetry.', finalDiagnoses: 'R07.9 Chest pain, unspecified', followUpInstructions: 'Cardiology clinic in 2 weeks', disposition: 'Home', conditionAtDischarge: 'Improved' } });
    assert.equal(draft.status, 200, JSON.stringify(draft.body));
    assert.equal(draft.body.data.summary.hospitalCourse, 'Ruled out ACS. Observed on telemetry.');
    const partial = await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: md.token, body: { procedures: 'None' } });
    assert.equal(partial.body.data.summary.admissionDiagnosis, 'Chest pain', 'partial save keeps other sections');

    const noRec = await call('POST', `/api/encounters/${encounterId}/discharge-summary/sign`, { token: md.token, body: {} });
    assert.equal(noRec.status, 409);
    assert.equal(noRec.body.code, 'MED_REC_INCOMPLETE');

    // Complete the discharge reconciliation (one inpatient med kept) then sign.
    await call('POST', `/api/patients/${patient.id}/medications`, { token: md.token, body: { name: 'Aspirin', dose: '81 mg', route: 'PO', frequency: 'Daily' } });
    const rec = (await call('GET', `/api/encounters/${encounterId}/med-reconciliation/discharge`, { token: rn.token })).body.data;
    assert.equal(rec.lines.length, 1);
    assert.equal((await call('POST', `/api/encounters/${encounterId}/med-reconciliation/discharge/complete`, { token: rn.token, body: { lines: rec.lines.map((l) => ({ ...l, action: 'continue', duration: '90 days' })) } })).status, 200);
    const sign = await call('POST', `/api/encounters/${encounterId}/discharge-summary/sign`, { token: md.token, body: { signedByName: 'Dr. mdsum User' } });
    assert.equal(sign.status, 200, JSON.stringify(sign.body));
    assert.equal(sign.body.data.summary.status, 'signed');
    assert.equal(sign.body.data.summary.signedBy, md.id);
    assert.match(sign.body.data.summary.dischargeMedications, /Aspirin 81 mg PO Daily × 90 days/, 'med list snapshot generated from the reconciliation');
    assert.equal(sign.body.data.summary.dischargeMedicationLines.length, 1);
    assert.equal(sign.body.data.context.dischargeSigned, true);
    assert.equal((await call('PUT', `/api/encounters/${encounterId}/discharge-summary`, { token: md.token, body: { hospitalCourse: 'edit' } })).status, 409, 'signed summary is immutable');
    const rollup = await pool.query('SELECT discharge_summary FROM encounters WHERE id = $1', [encounterId]);
    assert.match(rollup.rows[0].discharge_summary, /R07\.9/);

    // Checklist: blocking tasks still open → confirm refused; complete them → confirm succeeds; everything survives reload.
    assert.equal((await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId } })).status, 200);
    const blocked = await call('POST', '/api/discharges/confirm', { token: tk, body: { encounterId } });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'DISCHARGE_BLOCKED');
    assert.deepEqual(blocked.body.details.blocking.map((g) => g.id), ['gate-nursing-checklist']);
    const fin = (await call('GET', `/api/discharges/readiness/${encounterId}`, { token: tk })).body.data;
    assert.equal(fin.dischargeSummaryCompleted, true);
    assert.equal(fin.medicationCompleted, true);
    assert.equal(fin.checklistCompleted, false);
    const view1 = (await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: rn.token })).body.data;
    for (const task of view1.checklist.filter((x) => x.blocksDischarge && !x.completed)) {
        const r = await call('PATCH', `/api/encounters/${encounterId}/discharge-checklist/tasks/${task.id}`, { token: rn.token, body: { completed: true, notes: 'done' } });
        assert.equal(r.status, 200);
    }
    const view2 = (await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: tk })).body.data;
    assert.equal(view2.clinicalReady, true);
    assert.equal(view2.checklist.find((x) => x.notes === 'done').completedBy, rn.id);
    const conf = await call('POST', '/api/discharges/confirm', { token: tk, body: { encounterId } });
    assert.equal(conf.status, 200, JSON.stringify(conf.body));
    assert.equal((await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: tk })).body.data.context.encounterStatus, 'discharged');
    assert.equal((await call('GET', `/api/encounters/${encounterId}/discharge-readiness`, { token: (await newTenant('dsumB')).token })).status, 404, 'tenant isolation');
});

test('e-prescribing Phase A: pharmacy directory, draft → sign (NPI copied) → transmit (stub) / print / cancel; controlled Rx blocked; facesheet list', async () => {
    const t = await newTenant('erx');
    const tk = t.token;
    const md = await addUser(t, 'mderx', 'physician');
    const rn = await addUser(t, 'rnerx', 'nurse');
    const { patient, encounterId } = await admitPatient(tk, 'Erx');

    assert.equal((await call('POST', '/api/pharmacies', { token: md.token, body: { name: 'x' } })).status, 403, 'admin only');
    assert.equal((await call('POST', '/api/pharmacies', { token: tk, body: { name: 'Bad NPI', npi: '123' } })).status, 400);
    const ph = (await call('POST', '/api/pharmacies', { token: tk, body: { name: 'Main Street Pharmacy', ncpdpId: '1234567', npi: '1234567893', phone: '555-0100', isDefault: true, address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' } } })).body.data;
    const ph2 = (await call('POST', '/api/pharmacies', { token: tk, body: { name: 'Mail Order Rx', isDefault: true } })).body.data;
    const list = (await call('GET', '/api/pharmacies', { token: rn.token })).body.data;
    assert.equal(list.length, 2);
    assert.equal(list[0].id, ph2.id, 'latest default first');
    assert.equal(list.find((p) => p.id === ph.id).isDefault, false, 'only one default');
    assert.equal((await call('DELETE', `/api/pharmacies/${ph2.id}`, { token: tk })).status, 200);
    assert.equal((await call('GET', '/api/pharmacies', { token: tk })).body.data.length, 1);

    const medicines = [{ name: 'Amoxicillin', strength: '500 mg capsule', dose: '500 mg', route: 'PO', frequency: 'TID', duration: '7 days', instructions: 'with food', quantity: 21, refills: 0, unitPrice: 0.45 }];
    const draft = await call('POST', '/api/prescriptions', { token: md.token, body: { patientId: patient.id, encounterId, pharmacyId: ph.id, medicines } });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    const rx = draft.body.data;
    assert.equal(rx.status, 'draft');
    assert.equal(rx.pharmacyName, 'Main Street Pharmacy');
    assert.equal(rx.medicines[0].quantityOrdered, 21, 'quantity feeds the legacy dispense shape');
    assert.ok(rx.medicines[0].medicineId);
    assert.equal((await call('POST', `/api/prescriptions/${rx.id}/transmit`, { token: md.token })).status, 409, 'must be signed first');
    assert.equal((await call('POST', `/api/prescriptions/${rx.id}/sign`, { token: rn.token })).status, 403);

    // Prescriber identity: NPI required on the profile (Luhn-checked), copied onto the Rx at sign time.
    const noNpi = await call('POST', `/api/prescriptions/${rx.id}/sign`, { token: md.token });
    assert.equal(noNpi.status, 409);
    assert.equal(noNpi.body.code, 'PRESCRIBER_NPI_MISSING');
    assert.equal((await call('PUT', '/auth/profile', { token: md.token, body: { npi: '1234567890' } })).status, 400, 'bad check digit');
    assert.equal((await call('PUT', '/auth/profile', { token: md.token, body: { npi: '1234567895', deaNumber: 'ab1234567' } })).body.data.deaNumber, 'AB1234567');
    const signed = await call('POST', `/api/prescriptions/${rx.id}/sign`, { token: md.token });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.equal(signed.body.data.status, 'signed');
    assert.equal(signed.body.data.prescriberNpi, '1234567895');
    assert.equal(signed.body.data.prescriberDea, 'AB1234567');
    assert.equal(signed.body.data.statusHistory.map((h) => h.status).join('>'), 'draft>signed');
    assert.equal((await call('POST', `/api/prescriptions/${rx.id}/sign`, { token: md.token })).status, 409);

    const tx = await call('POST', `/api/prescriptions/${rx.id}/transmit`, { token: md.token });
    assert.equal(tx.status, 200, JSON.stringify(tx.body));
    assert.equal(tx.body.data.status, 'transmitted');
    assert.match(tx.body.data.transmissionRef, /^STUB-/);
    assert.equal((await call('POST', `/api/prescriptions/${rx.id}/print`, { token: md.token })).status, 409, 'already transmitted');

    // Paper fallback + cancel paths.
    const rx2 = (await call('POST', '/api/prescriptions', { token: md.token, body: { patientId: patient.id, medicines: [{ name: 'Ibuprofen', dose: '400 mg', frequency: 'q6h PRN', quantity: 20 }] } })).body.data;
    await call('POST', `/api/prescriptions/${rx2.id}/sign`, { token: md.token });
    assert.equal((await call('POST', `/api/prescriptions/${rx2.id}/transmit`, { token: md.token })).status, 400, 'no pharmacy chosen');
    assert.equal((await call('POST', `/api/prescriptions/${rx2.id}/print`, { token: rn.token })).body.data.status, 'printed');
    const cancelled = await call('POST', `/api/prescriptions/${rx2.id}/cancel`, { token: md.token, body: { reason: 'duplicate' } });
    assert.equal(cancelled.body.data.status, 'cancelled');
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx2.id, medicines: [{ medicineId: rx2.medicines[0].medicineId, quantityDispensed: 1, batchNumber: 'B', expiryDate: '2099-01-01', unitPrice: 0 }], dispensedBy: 'x', totalCost: 0 } })).status, 409, 'cancelled cannot be dispensed');

    // Controlled substance: hard stop until EPCS (Phase B).
    const ctrl = (await call('POST', '/api/prescriptions', { token: md.token, body: { patientId: patient.id, medicines: [{ name: 'Oxycodone', dose: '5 mg', frequency: 'q6h PRN', quantity: 10, controlledSchedule: 'II' }] } })).body.data;
    assert.equal(ctrl.controlledSchedule, 'II');
    const epcs = await call('POST', `/api/prescriptions/${ctrl.id}/sign`, { token: md.token });
    assert.equal(epcs.status, 409);
    assert.equal(epcs.body.code, 'EPCS_NOT_ENABLED');

    // Dispense flow still works on a transmitted Rx and the list filters by status.
    const line = { medicineId: rx.medicines[0].medicineId, quantityDispensed: 21, batchNumber: 'LOT1', expiryDate: '2099-01-01', unitPrice: 0.45 };
    assert.equal((await call('POST', '/api/dispense', { token: tk, body: { prescriptionId: rx.id, medicines: [line], dispensedBy: 'Pharm', totalCost: 9.45 } })).body.data.ok, true);
    assert.deepEqual((await call('GET', `/api/prescriptions/${patient.id}`, { token: tk })).body.data.map((r) => r.status), ['draft'], 'open list excludes dispensed/cancelled');
    assert.equal((await call('GET', `/api/prescriptions/${patient.id}?status=all`, { token: tk })).body.data.length, 3);
    assert.equal((await call('GET', `/api/prescriptions/${patient.id}?status=dispensed`, { token: tk })).body.data[0].id, rx.id);
    assert.equal((await call('GET', `/api/prescriptions/by-id/${rx.id}`, { token: (await newTenant('erxB')).token })).status, 404);
});

test('lab orders: collect → results (abnormal + critical flags, notification) → acknowledge → Resulted; corrections; critical worklist; CPOE indication', async () => {
    const t = await newTenant('labs');
    const tk = t.token;
    const md = await addUser(t, 'mdlab', 'physician');
    const rn = await addUser(t, 'rnlab', 'nurse');
    const { patient, encounterId } = await admitPatient(tk, 'Lab');

    // CPOE lab order carries the clinical indication and lands in the same lab_orders table.
    const cpoe = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP', specimen: 'Blood' }, { name: 'Magnesium' }], priority: 'STAT', clinicalIndication: 'Suspected hypokalaemia' } });
    assert.equal(cpoe.status, 201, JSON.stringify(cpoe.body));
    const orderId = cpoe.body.data.refId;
    const order = (await call('GET', `/lab-orders/${orderId}`, { token: tk })).body.data;
    assert.equal(order.clinicalIndication, 'Suspected hypokalaemia');
    assert.equal(order.orderStatus, 'Ordered');

    assert.equal((await call('POST', `/lab-orders/${order.id}/results`, { token: rn.token, body: { results: [{ testName: 'BMP', valueNum: 1 }] } })).status, 409, 'collect before resulting');
    const col = await call('POST', `/lab-orders/${order.id}/collect`, { token: rn.token, body: {} });
    assert.equal(col.status, 200, JSON.stringify(col.body));
    assert.equal(col.body.data.orderStatus, 'Collected');
    assert.match(col.body.data.accessionNumber, /^ACC\d{8}-\d{5}$/);
    assert.equal(col.body.data.specimenType, 'Blood');
    assert.equal((await call('POST', `/lab-orders/${order.id}/collect`, { token: rn.token })).status, 409, 'cannot collect twice');

    // Partial results → In Progress; the critical potassium notifies physicians + nurses.
    const r1 = await call('POST', `/lab-orders/${order.id}/results`, { token: rn.token, body: { results: [
        { testName: 'BMP', testCode: 'K', loincCode: '2823-3', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 },
        { testName: 'Sodium', valueNum: 138, unit: 'mmol/L', refLow: 135, refHigh: 145 },
    ] } });
    assert.equal(r1.status, 201, JSON.stringify(r1.body));
    assert.equal(r1.body.data.orderStatus, 'In Progress');
    const k = r1.body.data.results.find((x) => x.testCode === 'K');
    assert.equal(k.abnormalFlag, 'LL');
    assert.equal(k.isCritical, true);
    assert.equal(r1.body.data.results.find((x) => x.testName === 'Sodium').abnormalFlag, 'N');
    const mdNotes = (await call('GET', '/notifications', { token: md.token })).body.data;
    assert.ok(mdNotes.some((n) => n.action === 'critical_result' && /CRITICAL BMP/.test(n.message)), JSON.stringify(mdNotes));
    const worklist = (await call('GET', '/lab-results/critical', { token: md.token })).body.data;
    assert.equal(worklist.length, 1);
    assert.equal(worklist[0].patientName, 'Lab Patient');
    assert.equal((await call('GET', '/dashboard/ipd', { token: tk })).body.data.kpis.unacknowledgedCriticalResults, 1);

    const ack = await call('POST', `/lab-results/${k.id}/acknowledge`, { token: md.token });
    assert.equal(ack.status, 200);
    assert.equal(ack.body.data.acknowledgedBy, md.id);
    assert.equal((await call('POST', `/lab-results/${k.id}/acknowledge`, { token: md.token })).status, 409);
    assert.equal((await call('GET', '/lab-results/critical', { token: md.token })).body.data.length, 0);

    // Remaining ordered test resulted → order Resulted; ledger row completed.
    const r2 = await call('POST', `/lab-orders/${order.id}/results`, { token: rn.token, body: { results: [{ testName: 'Magnesium', valueNum: 2.6, unit: 'mg/dL', refLow: 1.7, refHigh: 2.2 }] } });
    assert.equal(r2.body.data.orderStatus, 'Resulted');
    assert.equal(r2.body.data.results[0].abnormalFlag, 'H');
    assert.equal(r2.body.data.results[0].isCritical, false);
    const ledger = await pool.query(`SELECT status FROM orders WHERE ref_table = 'lab_orders' AND ref_id = $1`, [order.id]);
    assert.equal(ledger.rows[0].status, 'completed');
    assert.equal((await call('POST', `/lab-orders/${order.id}/results`, { token: rn.token, body: { results: [{ testName: 'X', valueNum: 1 }] } })).status, 409, 'no results on a Resulted order');
    assert.equal((await call('PUT', `/lab-orders/${order.id}`, { token: tk, body: { orderStatus: 'Ordered' } })).status, 409, 'no going back');

    // Correction keeps the prior value in the audit comment.
    const corr = await call('PUT', `/lab-orders/${order.id}/results/${k.id}`, { token: md.token, body: { valueNum: 3.4, comment: 'haemolysed sample re-run' } });
    assert.equal(corr.status, 200, JSON.stringify(corr.body));
    assert.equal(corr.body.data.status, 'corrected');
    assert.equal(corr.body.data.abnormalFlag, 'L');
    assert.match(corr.body.data.comment, /previous value 2.4 mmol\/L/);
    const all = (await call('GET', `/lab-results/by-patient/${patient.id}`, { token: tk })).body.data;
    assert.equal(all.length, 3);
    assert.equal((await call('GET', `/lab-orders/${order.id}/results`, { token: tk })).body.data.length, 3);
    const listed = (await call('GET', `/lab-orders/by-patient/${patient.id}`, { token: tk })).body.data.orders[0];
    assert.equal(listed.resultCount, 3);
    assert.equal(listed.criticalUnacknowledged, 0);
    assert.equal((await call('GET', `/lab-orders/${order.id}/results`, { token: (await newTenant('labsB')).token })).status, 404);

    // A plain /lab-orders POST with an encounter also files a ledger row (one write path).
    const direct = (await call('POST', '/lab-orders', { token: md.token, body: { patientId: patient.id, encounterId, labTests: [{ name: 'CBC' }], clinicalIndication: 'Anaemia work-up' } })).body.data;
    assert.equal((await pool.query(`SELECT 1 FROM orders WHERE ref_table = 'lab_orders' AND ref_id = $1`, [direct.id])).rowCount, 1);
    assert.equal((await call('PUT', `/lab-orders/${direct.id}`, { token: md.token, body: { orderStatus: 'Cancelled' } })).body.data.orderStatus, 'Cancelled');
});

test('ADT notifications: recipient directory, A01/A02/A03 log rows with HL7 payloads, stub + failing webhook delivery, retry', async () => {
    const t = await newTenant('adtn');
    const tk = t.token;
    const rn = await addUser(t, 'rnadtn', 'nurse');
    assert.equal((await call('POST', '/api/notification-recipients', { token: rn.token, body: { name: 'x', kind: 'hie', transport: 'stub' } })).status, 403, 'admin only');
    assert.equal((await call('POST', '/api/notification-recipients', { token: tk, body: { name: 'Bad', kind: 'hie', transport: 'https_webhook', endpoint: 'not-a-url' } })).status, 400);
    const hie = (await call('POST', '/api/notification-recipients', { token: tk, body: { name: 'State HIE', kind: 'hie', transport: 'stub' } })).body.data;
    const snf = (await call('POST', '/api/notification-recipients', { token: tk, body: { name: 'Sunrise SNF', kind: 'post_acute', transport: 'https_webhook', endpoint: 'http://127.0.0.1:1/adt', authHeaderSecret: 'Bearer secret' } })).body.data;
    assert.equal(snf.hasSecret, true);
    const pcp = (await call('POST', '/api/notification-recipients', { token: tk, body: { name: 'Dr. Patel (PCP)', kind: 'pcp', transport: 'email', endpoint: 'patel@clinic.example' } })).body.data;
    const pcpOther = (await call('POST', '/api/notification-recipients', { token: tk, body: { name: 'Other PCP', kind: 'pcp', transport: 'stub' } })).body.data;
    assert.equal((await call('GET', '/api/notification-recipients', { token: rn.token })).body.data.length, 4);
    const testSend = await call('POST', `/api/notification-recipients/${hie.id}/test`, { token: tk });
    assert.equal(testSend.body.data.ok, true);
    assert.match(testSend.body.data.message, /^MSH\|\^~\\&\|EMR\|/);
    assert.equal((await call('POST', `/api/notification-recipients/${snf.id}/test`, { token: tk })).body.data.ok, false, 'unreachable webhook reports failure');

    // Patient registered with a PCP; admission fans out to PCP + post-acute + HIE (not the other PCP).
    const { patient, encounterId, bed2 } = await admitPatient(tk, 'Adtn', { pcpName: 'Dr. Patel', pcpNpi: '1234567893', pcpRecipientId: pcp.id });
    assert.equal(patient.pcpName, 'Dr. Patel');
    assert.equal(patient.pcpRecipientId, pcp.id);
    const a01 = (await call('GET', `/api/adt-notifications?encounterId=${encounterId}`, { token: rn.token })).body.data;
    assert.equal(a01.length, 3);
    assert.deepEqual(a01.map((l) => l.recipientName).sort(), ['Dr. Patel (PCP)', 'State HIE', 'Sunrise SNF']);
    assert.ok(a01.every((l) => l.eventType === 'A01' && l.status === 'queued'));
    const msg = a01.find((l) => l.recipientName === 'State HIE').message;
    assert.match(msg, /ADT\^A01\^ADT_A01/);
    assert.match(msg, /PID\|1\|\|MRN\d+\^\^\^EMR\^MR\|\|Patient\^Adtn\|\|19600405\|F/);
    assert.match(msg, /PD1\|\|\|\|1234567893\^Dr\. Patel/);
    assert.ok(!a01.some((l) => l.recipientName === 'Other PCP'));
    const job = await pool.query(`SELECT data FROM pgboss.job WHERE name = $1 AND data->>'encounterId' = $2`, [QUEUES.ADT_NOTIFICATION, encounterId]);
    assert.equal(job.rowCount, 1);
    assert.equal(job.rows[0].data.logIds.length, 3);

    // Deliver synchronously (what the worker does): stub + email succeed, the unreachable webhook fails.
    for (const l of a01) await call('POST', `/api/adt-notifications/${l.id}/deliver-now`, { token: rn.token });
    const after = (await call('GET', `/api/adt-notifications?encounterId=${encounterId}`, { token: tk })).body.data;
    assert.equal(after.find((l) => l.recipientName === 'State HIE').status, 'sent');
    assert.equal(after.find((l) => l.recipientName === 'Dr. Patel (PCP)').status, 'sent');
    const failed = after.find((l) => l.recipientName === 'Sunrise SNF');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.attempts, 1);
    assert.match(failed.lastError, /Webhook/);
    assert.equal((await call('GET', `/api/adt-notifications?status=failed`, { token: tk })).body.data.length, 1);
    assert.equal((await call('POST', `/api/adt-notifications/${after[0].id}/retry`, { token: rn.token })).status, after[0].status === 'sent' ? 409 : 200);
    const retry = await call('POST', `/api/adt-notifications/${failed.id}/retry`, { token: rn.token });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data.status, 'queued');
    assert.equal(retry.body.data.lastError, null);

    // Transfer → A02 with prior location; discharge → A03 with disposition (PV1-36) and discharge time (PV1-45).
    assert.equal((await call('POST', '/api/transfers', { token: tk, body: { encounterId, newBedId: bed2.id, reason: 'step-down' } })).status, 200);
    const a02 = (await call('GET', `/api/adt-notifications?encounterId=${encounterId}`, { token: tk })).body.data.filter((l) => l.eventType === 'A02');
    assert.equal(a02.length, 3);
    assert.match(a02[0].message, /ADT\^A02\^ADT_A02/);
    assert.match(a02[0].message, /PV1\|1\|I\|W-Adtn\^R-Adtn\^B2-Adtn\|emergency\|\|W-Adtn\^R-Adtn\^B-Adtn\|/);
    await call('POST', '/api/discharges', { token: tk, body: { phase: 'initiate', encounterId, disposition: 'Skilled Nursing Facility' } });
    await satisfyDischargeGates(tk, encounterId);
    assert.equal((await call('POST', '/api/discharges/confirm', { token: tk, body: { encounterId } })).status, 200);
    const a03 = (await call('GET', `/api/adt-notifications?encounterId=${encounterId}`, { token: tk })).body.data.filter((l) => l.eventType === 'A03');
    assert.equal(a03.length, 3);
    assert.match(a03[0].message, /EVN\|A03\|/);
    const pv1 = a03[0].message.split('\r').find((s) => s.startsWith('PV1|')).split('|');
    assert.equal(pv1[36], 'Skilled Nursing Facility', 'PV1-36 discharge disposition');
    assert.match(pv1[45], /^\d{14}$/, 'PV1-45 discharge time');
    assert.equal((await call('GET', `/api/adt-notifications?encounterId=${encounterId}`, { token: (await newTenant('adtnB')).token })).body.data.length, 0);
    assert.equal((await call('DELETE', `/api/notification-recipients/${pcpOther.id}`, { token: tk })).status, 200);
});
