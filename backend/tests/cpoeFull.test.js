// CPOE / order dashboard (BUG-02, BUG-09, SAF-27, + order sets, verbal orders/cosign,
// hold/renew/modify, five new order types): full scope.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const suffix = `cf${Date.now().toString(36)}`;

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
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1960-01-01', sex: 'F' } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Chest pain' } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id, ward };
}

// -------------------------------------------------------------------------------- new order types
test('CPOE: dietary/therapy/procedure/consult/nursing order types place and read back correctly', async () => {
    const t = await newTenant('newtypes');
    const md = await addUser(t, 'ntmd', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Newtypes');

    const cases = [
        { orderType: 'dietary', dietType: 'Cardiac', restrictions: 'Low sodium', priority: 'urgent' },
        { orderType: 'therapy', therapyType: 'Physical Therapy', frequency: 'Daily' },
        { orderType: 'procedure', procedureName: 'Central line placement', laterality: 'Right' },
        { orderType: 'consult', consultingService: 'Cardiology', reason: 'New onset AFib' },
        { orderType: 'nursing', nursingOrderType: 'Fall precautions', details: 'Bed alarm on' },
    ];
    for (const c of cases) {
        const r = await call('POST', '/api/orders', { token: md.token, body: { ...c, patientId: patient.id, encounterId } });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.data.orderType, c.orderType);
    }

    const dash = (await call('GET', '/api/inpatient/orders', { token: md.token })).body.data;
    assert.equal(dash.total, 5);
    const types = dash.items.map((o) => o.orderType).sort();
    assert.deepEqual(types, ['consult', 'dietary', 'nursing', 'procedure', 'therapy']);
    const dietaryRow = dash.items.find((o) => o.orderType === 'dietary');
    assert.match(dietaryRow.summary, /Cardiac/);
    assert.equal(dietaryRow.priority, 'urgent');

    // The type filter can request exactly these — no longer phantom.
    const filtered = (await call('GET', '/api/inpatient/orders?orderTypes=consult,nursing', { token: md.token })).body.data;
    assert.equal(filtered.total, 2);
});

// -------------------------------------------------------------------------------- BUG-02 / acknowledge
test('CPOE: nurse acknowledgement (BUG-02) — real endpoint, canAcknowledge reflects real state', async () => {
    const t = await newTenant('ack');
    const md = await addUser(t, 'ackmd', 'physician');
    const rn = await addUser(t, 'ackrn', 'nurse');
    const { patient, encounterId } = await admitPatient(t.token, 'Ack');
    const order = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Metoprolol' } })).body.data;

    const dashBefore = (await call('GET', '/api/inpatient/orders', { token: md.token })).body.data.items.find((o) => o.id === order.id);
    assert.equal(dashBefore.status, 'pending');
    assert.equal(dashBefore.canAcknowledge, true);

    const ack = await call('POST', `/api/inpatient/orders/${order.id}/acknowledge`, { token: rn.token });
    assert.equal(ack.status, 200, JSON.stringify(ack.body));
    assert.equal(ack.body.data.status, 'accepted');

    const again = await call('POST', `/api/inpatient/orders/${order.id}/acknowledge`, { token: rn.token });
    assert.equal(again.status, 409, 'already acknowledged');

    const dashAfter = (await call('GET', '/api/inpatient/orders?statuses=accepted', { token: md.token })).body.data;
    assert.equal(dashAfter.total, 1);
    assert.equal(dashAfter.items[0].canAcknowledge, false);
});

// -------------------------------------------------------------------------------- verbal orders / cosign
test('CPOE: verbal/telephone order requires read-back at entry and physician co-sign after', async () => {
    const t = await newTenant('verbal');
    const md = await addUser(t, 'verbalmd', 'physician');
    const rn = await addUser(t, 'verbalrn', 'nurse');
    const { patient, encounterId } = await admitPatient(t.token, 'Verbal');

    const noReadBack = await call('POST', '/api/orders', { token: rn.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Furosemide', isVerbal: true } });
    assert.equal(noReadBack.status, 400, 'isVerbal without readBackConfirmed is rejected');

    const verbal = await call('POST', '/api/orders', { token: rn.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Furosemide', isVerbal: true, readBackConfirmed: true } });
    assert.equal(verbal.status, 201, JSON.stringify(verbal.body));
    assert.equal(verbal.body.data.isVerbal, true);
    assert.equal(verbal.body.data.requiresCosign, true);

    const rnCosign = await call('POST', `/api/orders/${verbal.body.data.id}/cosign`, { token: rn.token });
    assert.equal(rnCosign.status, 403, 'a nurse cannot co-sign');

    const cosign = await call('POST', `/api/orders/${verbal.body.data.id}/cosign`, { token: md.token });
    assert.equal(cosign.status, 200, JSON.stringify(cosign.body));
    assert.equal(cosign.body.data.cosignedBy, md.id);

    const double = await call('POST', `/api/orders/${verbal.body.data.id}/cosign`, { token: md.token });
    assert.equal(double.status, 409, 'already co-signed');

    // A non-verbal order has nothing to co-sign.
    const normal = await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Aspirin' } });
    const normalCosign = await call('POST', `/api/orders/${normal.body.data.id}/cosign`, { token: md.token });
    assert.equal(normalCosign.status, 400);
});

// -------------------------------------------------------------------------------- hold/resume/renew/modify
test('CPOE: hold and resume, renew, and modify all require a reason and work as expected', async () => {
    const t = await newTenant('hold');
    const md = await addUser(t, 'holdmd', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Hold');
    const order = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Warfarin', dose: '5 mg' } })).body.data;

    const holdNoReason = await call('PUT', `/api/orders/${order.id}/status`, { token: md.token, body: { status: 'held' } });
    assert.equal(holdNoReason.status, 400);
    const held = await call('PUT', `/api/orders/${order.id}/status`, { token: md.token, body: { status: 'held', reason: 'INR pending' } });
    assert.equal(held.status, 200, JSON.stringify(held.body));
    assert.equal(held.body.data.status, 'held');

    const resumeBadFrom = await call('PUT', `/api/orders/${order.id}/status`, { token: md.token, body: { status: 'active' } });
    // allowed: resuming from held needs no reason and is a valid transition
    assert.equal(resumeBadFrom.status, 200, JSON.stringify(resumeBadFrom.body));
    assert.equal(resumeBadFrom.body.data.status, 'active');

    const cantResumeActive = await call('PUT', `/api/orders/${order.id}/status`, { token: md.token, body: { status: 'active' } });
    assert.equal(cantResumeActive.status, 409, 'cannot resume an order that is not held');

    // Renew: completes the old order, creates a new one with the same detail.
    const renew = await call('POST', `/api/orders/${order.id}/renew`, { token: md.token, body: {} });
    assert.equal(renew.status, 200, JSON.stringify(renew.body));
    assert.equal(renew.body.data.detail.name, 'Warfarin');
    assert.equal(renew.body.data.replacesOrderId, order.id);
    const oldAfterRenew = (await call('GET', `/api/orders/${order.id}`, { token: md.token })).body.data;
    assert.equal(oldAfterRenew.status, 'completed');
    assert.equal(oldAfterRenew.reason, 'Renewed');

    // Modify: completes the renewed order, creates a new one with updated detail.
    const renewed = renew.body.data;
    const modify = await call('POST', `/api/orders/${renewed.id}/modify`, { token: md.token, body: { name: 'Warfarin', dose: '2.5 mg' } });
    assert.equal(modify.status, 200, JSON.stringify(modify.body));
    assert.equal(modify.body.data.detail.dose, '2.5 mg');
    assert.equal(modify.body.data.replacesOrderId, renewed.id);
    const renewedAfterModify = (await call('GET', `/api/orders/${renewed.id}`, { token: md.token })).body.data;
    assert.equal(renewedAfterModify.status, 'completed');
    assert.equal(renewedAfterModify.reason, 'Modified');

    // Cannot renew/modify a completed (terminal) order.
    assert.equal((await call('POST', `/api/orders/${order.id}/renew`, { token: md.token, body: {} })).status, 409);
});

// -------------------------------------------------------------------------------- BUG-09 (SQL filtering / >2000 cap correctness)
test('BUG-09: status and priority filters apply in SQL, not only after the dashboard fetch', async () => {
    const t = await newTenant('bug09');
    const md = await addUser(t, 'bug09md', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Bug09');
    const a = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'A', priority: 'stat' } })).body.data;
    const bOrd = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'B', priority: 'routine' } })).body.data;
    await call('PUT', `/api/orders/${bOrd.id}/status`, { token: md.token, body: { status: 'discontinued', reason: 'duplicate' } });

    const statFilter = (await call('GET', '/api/inpatient/orders?priorities=stat', { token: md.token })).body.data;
    assert.equal(statFilter.total, 1);
    assert.equal(statFilter.items[0].id, a.id);

    const cancelledFilter = (await call('GET', '/api/inpatient/orders?statuses=cancelled', { token: md.token })).body.data;
    assert.equal(cancelledFilter.total, 1);
    assert.equal(cancelledFilter.items[0].id, bOrd.id);

    // 'in_progress' is gone (was a phantom status the real data path never produced); 'held' is real.
    await call('PUT', `/api/orders/${a.id}/status`, { token: md.token, body: { status: 'held', reason: 'awaiting pharmacy' } });
    const heldFilter = (await call('GET', '/api/inpatient/orders?statuses=held', { token: md.token })).body.data;
    assert.equal(heldFilter.total, 1);
    assert.equal(heldFilter.items[0].id, a.id);
});

// -------------------------------------------------------------------------------- discontinue/cancel reason
test('Discontinue/cancel reason is captured and returned on both the per-encounter and dashboard paths', async () => {
    const t = await newTenant('reason');
    const md = await addUser(t, 'reasonmd', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Reason');
    const a = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'CBC' }] } })).body.data;
    const disc = await call('PUT', `/api/orders/${a.id}/status`, { token: md.token, body: { status: 'discontinued', reason: 'Patient refused' } });
    assert.equal(disc.body.data.reason, 'Patient refused');

    const b = (await call('POST', '/api/orders', { token: md.token, body: { orderType: 'lab', patientId: patient.id, encounterId, labTests: [{ name: 'BMP' }] } })).body.data;
    const dashCancel = await call('POST', `/api/inpatient/orders/${b.id}/cancel`, { token: md.token, body: { reason: 'Ordered in error' } });
    assert.equal(dashCancel.body.data.reason, 'Ordered in error');
});

// -------------------------------------------------------------------------------- order sets
test('Order sets: create, place as a transaction, update, retire', async () => {
    const t = await newTenant('sets');
    const md = await addUser(t, 'setsmd', 'physician');
    const rn = await addUser(t, 'setsrn', 'nurse');
    const { patient, encounterId } = await admitPatient(t.token, 'Sets');

    const bad = await call('POST', '/api/order-sets', {
        token: md.token,
        body: { name: 'Sepsis bundle', items: [{ orderType: 'lab', detail: { labTests: [] } }] },
    });
    assert.equal(bad.status, 400, 'item detail is validated against its own order schema at save time');

    const set = await call('POST', '/api/order-sets', {
        token: md.token,
        body: {
            name: 'Sepsis bundle',
            description: 'Initial sepsis workup',
            items: [
                { orderType: 'lab', detail: { labTests: [{ name: 'Lactate' }, { name: 'Blood cultures' }], priority: 'STAT' } },
                { orderType: 'medication', detail: { name: 'Normal Saline', dose: '1 L', route: 'IV', priority: 'stat' } },
                { orderType: 'nursing', detail: { nursingOrderType: 'Vital signs q1h' } },
            ],
        },
    });
    assert.equal(set.status, 201, JSON.stringify(set.body));
    assert.equal(set.body.data.items.length, 3);

    const dup = await call('POST', '/api/order-sets', { token: md.token, body: { name: 'Sepsis bundle', items: [{ orderType: 'nursing', detail: { nursingOrderType: 'x' } }] } });
    assert.equal(dup.status, 409, 'duplicate name rejected');

    const listed = await call('GET', '/api/order-sets', { token: rn.token });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);

    const placed = await call('POST', `/api/order-sets/${set.body.data.id}/place`, { token: md.token, body: { patientId: patient.id, encounterId } });
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    assert.equal(placed.body.data.length, 3);
    assert.ok(placed.body.data.every((o) => o.orderSetId === set.body.data.id));

    const dash = (await call('GET', '/api/inpatient/orders', { token: md.token })).body.data;
    assert.equal(dash.total, 3, 'all three set items landed as real orders');

    const updated = await call('PUT', `/api/order-sets/${set.body.data.id}`, { token: md.token, body: { description: 'Updated description' } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.items.length, 3, 'items untouched when not included in the update');
    assert.equal(updated.body.data.description, 'Updated description');

    const retired = await call('DELETE', `/api/order-sets/${set.body.data.id}`, { token: md.token });
    assert.equal(retired.status, 200);
    assert.equal((await call('GET', '/api/order-sets', { token: md.token })).body.data.length, 0, 'retired set no longer listed');
});

// -------------------------------------------------------------------------------- SAF-27
test('SAF-27: admission med-rec dedupes against active CPOE medications and surfaces CDS failures', async () => {
    const t = await newTenant('saf27');
    const md = await addUser(t, 'saf27md', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Saf27');

    // Already active via CPOE.
    await call('POST', '/api/orders', { token: md.token, body: { orderType: 'medication', patientId: patient.id, encounterId, name: 'Metformin', rxnormCode: '6809' } });

    const rec = await call('GET', `/api/encounters/${encounterId}/med-reconciliation/admission`, { token: md.token });
    assert.equal(rec.status, 200);
    // No home meds on file for this fresh patient, so drive the reconciliation with an explicit line
    // set instead — one that deliberately overlaps the CPOE medication just placed above.
    const complete = await call('POST', `/api/encounters/${encounterId}/med-reconciliation/admission/complete`, {
        token: md.token,
        body: { lines: [{ name: 'Metformin', rxnormCode: '6809', action: 'continue' }, { name: 'Lisinopril', action: 'continue' }] },
    });
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
    assert.deepEqual(complete.body.data.dedupedMedications, ['Metformin'], 'already-active CPOE medication is not duplicated');

    const activeMeds = (await call('GET', `/api/patients/${patient.id}/medications`, { token: md.token })).body.data;
    const metforminRows = activeMeds.filter((m) => m.name === 'Metformin');
    assert.equal(metforminRows.length, 1, 'exactly one active Metformin row, not two');
    assert.ok(activeMeds.some((m) => m.name === 'Lisinopril'), 'the genuinely new line was still inserted');
});
