// Results / critical notifications (#SAF-06, 11, 19): critical alerts routed to the ordering
// clinician/attending/assigned nurse instead of a tenant-wide broadcast, with a broadcast fallback;
// read-back required to acknowledge; a correction to a different critical value clears a stale ack;
// imaging criticals create real notifications; escalation job; radiology ledger closure; portal
// release hold on preliminary/unacknowledged-critical lab results.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { sweepUnacknowledgedCriticals } from '../src/jobs/criticalResultEscalation.js';

let server;
let base;
const tenantIds = [];
const suffix = `cr${Date.now().toString(36)}`;

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

async function admitPatient(tk, label, extra = {}) {
    const ward = (await call('POST', '/Wards/CreateWard', { token: tk, body: { name: `W-${label}` } })).body.data;
    const room = (await call('POST', '/Rooms/CreateRoom', { token: tk, body: { wardId: ward.id, roomNumber: `R-${label}` } })).body.data;
    const bed = (await call('POST', '/Beds/CreateBed', { token: tk, body: { roomId: room.id, bedLabel: `B-${label}` } })).body.data;
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1960-04-05', sex: 'F' } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Chest pain', ...extra } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id, ward, room, bed };
}

/** Same day/evening/night boundaries as lib/criticalNotify.js. */
function currentShift() {
    const h = new Date().getHours();
    if (h >= 7 && h < 15) return 'day';
    if (h >= 15 && h < 23) return 'evening';
    return 'night';
}

async function seedStaffing({ tenantId, wardId, bedId, nurseId, chargeNurseId }) {
    const a = await pool.query(
        `INSERT INTO staffing_assignments (tenant_id, ward_id, assignment_date, shift, charge_nurse_id) VALUES ($1,$2,CURRENT_DATE,$3,$4) RETURNING id`,
        [tenantId, wardId, currentShift(), chargeNurseId ?? null],
    );
    if (nurseId) {
        await pool.query(
            `INSERT INTO staffing_nurse_assignments (assignment_id, nurse_id, assigned_bed_ids) VALUES ($1,$2,$3::jsonb)`,
            [a.rows[0].id, nurseId, JSON.stringify([bedId])],
        );
    }
    return a.rows[0].id;
}

// -------------------------------------------------------------------------------------------- 06
test('critical lab result: routed to the ordering physician and the assigned nurse, not a tenant-wide broadcast', async () => {
    const t = await newTenant('route');
    const md = await addUser(t, 'mdroute', 'physician');
    const bystander = await addUser(t, 'bystanderroute', 'physician');
    const nurse = await addUser(t, 'nurseroute', 'nurse');
    const { patient, encounterId, ward, bed } = await admitPatient(t.token, 'Route');
    await seedStaffing({ tenantId: t.user.tenant.id, wardId: ward.id, bedId: bed.id, nurseId: nurse.id });

    const order = await call('POST', '/api/orders', {
        token: md.token,
        body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }], priority: 'STAT' },
    });
    const orderId = order.body.data.refId;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    const res = await call('POST', `/lab-orders/${orderId}/results`, {
        token: md.token,
        body: { results: [{ testName: 'BMP', testCode: 'K', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }] },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const mdNotes = (await call('GET', '/notifications', { token: md.token })).body.data;
    assert.ok(mdNotes.some((n) => n.action === 'critical_result'), 'the ordering physician must be notified');
    const nurseNotes = (await call('GET', '/notifications', { token: nurse.token })).body.data;
    assert.ok(nurseNotes.some((n) => n.action === 'critical_result'), "the patient's assigned nurse must be notified");
    const bystanderNotes = (await call('GET', '/notifications', { token: bystander.token })).body.data;
    assert.ok(!bystanderNotes.some((n) => n.action === 'critical_result'), 'an uninvolved physician must NOT be notified');
});

test('critical lab result: falls back to a broadcast when no specific target can be resolved', async () => {
    const t = await newTenant('fallback');
    const md = await addUser(t, 'mdfallback', 'physician');
    const otherNurse = await addUser(t, 'nursefallback', 'nurse');
    // No admission/encounter/staffing at all for this patient — nothing to route to specifically.
    const patient = (await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Fallback', lastName: 'Patient', dOB: '1970-01-01', sex: 'M' } })).body.data;
    const order = await call('POST', '/lab-orders', { token: md.token, body: { patientId: patient.id, labTests: [{ name: 'BMP' }] } });
    const orderId = order.body.data.id;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    // Deactivate the ordering physician so even that target fails to resolve.
    await call('PUT', `/auth/users/${md.id}`, { token: t.token, body: { isActive: false } });

    const res = await call('POST', `/lab-orders/${orderId}/results`, {
        token: t.token,
        body: { results: [{ testName: 'BMP', testCode: 'K', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }] },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const notes = (await call('GET', '/notifications', { token: otherNurse.token })).body.data;
    assert.ok(notes.some((n) => n.action === 'critical_result'), 'with nothing resolvable, it must fall back to broadcasting rather than notifying no one');
});

test('acknowledge: requires a matching read-back value', async () => {
    const t = await newTenant('readback');
    const md = await addUser(t, 'mdreadback', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Readback');
    const order = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }], priority: 'STAT' } });
    const orderId = order.body.data.refId;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    const res = await call('POST', `/lab-orders/${orderId}/results`, { token: md.token, body: { results: [{ testName: 'BMP', testCode: 'K', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }] } });
    const rid = res.body.data.results[0].id;

    assert.equal((await call('POST', `/lab-results/${rid}/acknowledge`, { token: md.token, body: {} })).status, 400, 'empty read-back must be rejected');
    assert.equal((await call('POST', `/lab-results/${rid}/acknowledge`, { token: md.token, body: { readBackValue: '9.9' } })).status, 400, 'mismatched read-back must be rejected');
    const ok1 = await call('POST', `/lab-results/${rid}/acknowledge`, { token: md.token, body: { readBackValue: '2.4' } });
    assert.equal(ok1.status, 200, JSON.stringify(ok1.body));
    assert.equal(ok1.body.data.readBackValue, '2.4');
});

test('correction: a critical value corrected to a different critical value clears the stale acknowledgement and re-notifies', async () => {
    const t = await newTenant('staleack');
    const md = await addUser(t, 'mdstaleack', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'StaleAck');
    const order = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }], priority: 'STAT' } });
    const orderId = order.body.data.refId;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    const res = await call('POST', `/lab-orders/${orderId}/results`, { token: md.token, body: { results: [{ testName: 'BMP', testCode: 'K', valueNum: 6.0, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }] } });
    const rid = res.body.data.results[0].id;
    const ack = await call('POST', `/lab-results/${rid}/acknowledge`, { token: md.token, body: { readBackValue: '6' } });
    assert.equal(ack.status, 200, JSON.stringify(ack.body));
    assert.ok(ack.body.data.acknowledgedAt);

    // Correct to a different, still-critical value — the old ack must not silently carry over.
    const corrected = await call('PUT', `/lab-orders/${orderId}/results/${rid}`, { token: md.token, body: { valueNum: 7.5 } });
    assert.equal(corrected.status, 200, JSON.stringify(corrected.body));
    assert.equal(corrected.body.data.isCritical, true);
    assert.equal(corrected.body.data.acknowledgedAt, null, 'a corrected critical value must require a fresh acknowledgement');

    const worklist = (await call('GET', '/lab-results/critical', { token: md.token })).body.data;
    assert.ok(worklist.some((r) => r.id === rid), 'the corrected result must reappear on the unacknowledged critical worklist');
});

// -------------------------------------------------------------------------------------------- 06 (imaging)
test('imaging critical: flagging a critical value creates a real notification, not just a text record', async () => {
    const t = await newTenant('imgCrit');
    const md = await addUser(t, 'mdimgcrit', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'ImgCrit');
    const rad = await call('POST', '/api/Radiology/order', {
        token: md.token,
        body: { patientId: patient.id, encounterId, modality: 'CT', bodyRegion: 'Head', clinicalIndication: 'Trauma' },
    });
    assert.equal(rad.status, 201, JSON.stringify(rad.body));
    const flag = await call('PUT', `/api/Radiology/order/${rad.body.data.id}/critical`, {
        token: md.token,
        body: { criticalValue: true, criticalValueNotifiedTo: 'Called Dr. Route directly' },
    });
    assert.equal(flag.status, 200, JSON.stringify(flag.body));

    const notes = (await call('GET', '/notifications', { token: md.token })).body.data;
    assert.ok(notes.some((n) => n.type === 'radiology' && n.action === 'critical_result'), 'flagging an imaging critical must create a real in-app notification');
});

// -------------------------------------------------------------------------------------------- 19
test('radiology: finalizing or cancelling an order closes its CPOE ledger row', async () => {
    const t = await newTenant('radLedger');
    const md = await addUser(t, 'mdradledger', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'RadLedger');

    const order1 = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'radiology', patientId: patient.id, encounterId, modality: 'XR', bodyRegion: 'Chest', clinicalIndication: 'Cough' } });
    assert.equal(order1.status, 201, JSON.stringify(order1.body));
    const radId1 = order1.body.data.refId;
    await call('PUT', `/api/Radiology/order/${radId1}/result`, { token: md.token, body: { impression: 'Clear' } });
    const ledger1 = await pool.query(`SELECT status FROM orders WHERE ref_table = 'radiology_orders' AND ref_id = $1`, [radId1]);
    assert.equal(ledger1.rows[0].status, 'completed');

    const order2 = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'radiology', patientId: patient.id, encounterId, modality: 'XR', bodyRegion: 'Hand', clinicalIndication: 'Pain' } });
    const radId2 = order2.body.data.refId;
    await call('PUT', `/api/Radiology/order/${radId2}/cancel`, { token: md.token, body: {} });
    const ledger2 = await pool.query(`SELECT status FROM orders WHERE ref_table = 'radiology_orders' AND ref_id = $1`, [radId2]);
    assert.equal(ledger2.rows[0].status, 'cancelled');
});

// -------------------------------------------------------------------------------------------- escalation
test('escalation: an unacknowledged critical past the window notifies the charge nurse exactly once', async () => {
    const t = await newTenant('escalate');
    const md = await addUser(t, 'mdescalate', 'physician');
    const charge = await addUser(t, 'chargeescalate', 'nurse');
    const { patient, encounterId, ward, bed } = await admitPatient(t.token, 'Escalate');
    await seedStaffing({ tenantId: t.user.tenant.id, wardId: ward.id, bedId: bed.id, chargeNurseId: charge.id });

    const order = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }], priority: 'STAT' } });
    const orderId = order.body.data.refId;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    const res = await call('POST', `/lab-orders/${orderId}/results`, { token: md.token, body: { results: [{ testName: 'BMP', testCode: 'K', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }] } });
    const rid = res.body.data.results[0].id;
    // Back-date it past the escalation window instead of waiting in real time.
    await pool.query(`UPDATE lab_results SET resulted_at = now() - interval '1 hour' WHERE id = $1`, [rid]);

    const n = await sweepUnacknowledgedCriticals();
    assert.ok(n >= 1, 'at least this result should have been escalated');
    const chargeNotes = (await call('GET', '/notifications', { token: charge.token })).body.data;
    assert.ok(chargeNotes.some((x) => x.action === 'critical_result_escalated'), 'the charge nurse must be notified on escalation');

    const row = await pool.query('SELECT escalated_at FROM lab_results WHERE id = $1', [rid]);
    assert.ok(row.rows[0].escalated_at);
    const n2 = await sweepUnacknowledgedCriticals();
    const chargeNotesAfter = (await call('GET', '/notifications', { token: charge.token })).body.data;
    assert.equal(chargeNotesAfter.filter((x) => x.action === 'critical_result_escalated').length, 1, 'a second sweep must not re-escalate the same result');
    void n2;
});

// -------------------------------------------------------------------------------------------- 11
test('portal release hold: preliminary and unacknowledged-critical lab results are withheld from the FHIR API', async () => {
    const t = await newTenant('releaseHold');
    const md = await addUser(t, 'mdreleasehold', 'physician');
    const email = `patient-${suffix}@test.example`;
    const { patient, encounterId } = await admitPatient(t.token, 'ReleaseHold');
    await pool.query('UPDATE patients SET email = $1 WHERE id = $2', [email, patient.id]);

    const order = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }, { name: 'Sodium' }], priority: 'STAT' } });
    const orderId = order.body.data.refId;
    await call('POST', `/lab-orders/${orderId}/collect`, { token: md.token, body: {} });
    const res = await call('POST', `/lab-orders/${orderId}/results`, {
        token: md.token,
        body: {
            results: [
                { testName: 'BMP', testCode: 'K', valueNum: 2.4, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 }, // critical, unacknowledged
                { testName: 'Sodium', valueNum: 138, unit: 'mmol/L', refLow: 135, refHigh: 145, status: 'preliminary' }, // not critical, preliminary
            ],
        },
    });
    const critId = res.body.data.results.find((r) => r.testCode === 'K').id;
    const prelimId = res.body.data.results.find((r) => r.testName === 'Sodium').id;

    // Patient portal setup for the FHIR read.
    const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    await call('POST', '/patient-auth/set-password', { body: { token: invite.body.data.inviteToken, newPassword: 'Portal-passw0rd!', confirmPassword: 'Portal-passw0rd!' } });
    const login = await call('POST', '/patient-auth/login', { body: { email, password: 'Portal-passw0rd!' } });
    const patientJwt = login.body.data.token;
    const client = await call('POST', '/api/smart-clients', { token: t.token, body: { name: 'Portal App', redirectUris: ['http://127.0.0.1:9999/cb'], allowedScopes: ['patient/*.read', 'openid'] } });
    const clientId = client.body.data.clientId;

    const crypto = await import('node:crypto');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const decision = await call('POST', '/oauth/authorize/decision', {
        token: patientJwt,
        body: { allow: true, client_id: clientId, redirect_uri: 'http://127.0.0.1:9999/cb', scope: 'patient/*.read openid', state: 'xyz', code_challenge: challenge, code_challenge_method: 'S256' },
    });
    const code = new URL(decision.body.data.redirectUrl).searchParams.get('code');
    const tokenRes = await call('POST', '/oauth/token', { body: { grant_type: 'authorization_code', code, redirect_uri: 'http://127.0.0.1:9999/cb', client_id: clientId, code_verifier: verifier } });
    const smartToken = tokenRes.body.access_token;

    // Held: neither the unacknowledged critical nor the preliminary result is visible.
    assert.equal((await call('GET', `/fhir/Observation/lab-${critId}`, { token: smartToken })).status, 404);
    assert.equal((await call('GET', `/fhir/Observation/lab-${prelimId}`, { token: smartToken })).status, 404);
    const search1 = await call('GET', `/fhir/Observation?patient=${patient.id}&category=laboratory`, { token: smartToken });
    assert.equal(search1.body.total, 0, JSON.stringify(search1.body));

    // Acknowledge the critical and finalize the preliminary — both should now release.
    await call('POST', `/lab-results/${critId}/acknowledge`, { token: md.token, body: { readBackValue: '2.4' } });
    await call('PUT', `/lab-orders/${orderId}/results/${prelimId}`, { token: md.token, body: { status: 'final' } });

    assert.equal((await call('GET', `/fhir/Observation/lab-${critId}`, { token: smartToken })).status, 200);
    assert.equal((await call('GET', `/fhir/Observation/lab-${prelimId}`, { token: smartToken })).status, 200);
    const search2 = await call('GET', `/fhir/Observation?patient=${patient.id}&category=laboratory`, { token: smartToken });
    assert.equal(search2.body.total, 2, JSON.stringify(search2.body));
});
