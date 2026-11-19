// Vitals / labs / imaging module: lab test catalog + multi-specimen collection (SAF-25),
// code-event notes that actually persist (SAF-26), and structured imaging safety fields
// (pregnancyStatus/contrastAllergy). BUG-13 (retired lab_documents store) is covered in api.test.js.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const suffix = `vli${Date.now().toString(36)}`;

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
    const p = (await call('POST', '/Patient/createPatient', { token: tk, body: { firstName: label, lastName: 'Patient', dOB: '1970-01-01', sex: 'F' } })).body.data;
    const adm = await call('POST', '/api/admissions', { token: tk, body: { patientId: p.id, bedId: bed.id, admissionType: 'emergency', diagnosis: 'Test admit' } });
    assert.equal(adm.status, 201, JSON.stringify(adm.body));
    return { patient: p, encounterId: adm.body.data.encounter.id, ward };
}

test('SAF-25: lab test catalog resolves code+specimen, multi-specimen collection, completion matches by code or name', async () => {
    const t = await newTenant('labcat');
    const rn = await addUser(t, 'labcatrn', 'nurse');
    const { patient } = await admitPatient(t.token, 'Labcat');

    const create = await call('POST', '/lab-orders', {
        token: rn.token,
        body: { patientId: patient.id, labTests: [{ name: 'CBC' }, { name: 'Urinalysis' }, { name: 'Zinc' }] },
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    const order = create.body.data;

    // Catalog-known tests picked up a stable code + their default specimen; a free-text test not in
    // the catalog (Zinc) keeps matching by name exactly as before — additive, not breaking.
    const byName = Object.fromEntries(order.labTests.map((lt) => [lt.name, lt]));
    assert.equal(byName.CBC.code, 'CBC');
    assert.equal(byName.CBC.specimen, 'Blood');
    assert.equal(byName.Urinalysis.code, 'UA');
    assert.equal(byName.Urinalysis.specimen, 'Urine');
    assert.equal(byName.Zinc.code, undefined);

    // Collecting without an explicit specimenType auto-detects the distinct specimen types the
    // order's own tests need — one accession number per type, not one for the whole order.
    const collect = await call('POST', `/lab-orders/${order.id}/collect`, { token: rn.token, body: {} });
    assert.equal(collect.status, 200, JSON.stringify(collect.body));
    assert.equal(collect.body.data.specimens.length, 2);
    const specimenTypes = collect.body.data.specimens.map((s) => s.specimenType).sort();
    assert.deepEqual(specimenTypes, ['Blood', 'Urine']);
    const accessions = new Set(collect.body.data.specimens.map((s) => s.accessionNumber));
    assert.equal(accessions.size, 2, 'each specimen gets its own accession number');
    // Legacy scalar columns stay in sync with the first specimen for any reader that only looks there.
    assert.equal(collect.body.data.accessionNumber, collect.body.data.specimens[0].accessionNumber);
    assert.equal(collect.body.data.specimenType, collect.body.data.specimens[0].specimenType);

    assert.equal((await call('POST', `/lab-orders/${order.id}/collect`, { token: rn.token, body: {} })).status, 409, 'cannot collect twice');

    // Resulting CBC by its catalog code alone isn't enough — Urinalysis and Zinc are still pending.
    const r1 = await call('POST', `/lab-orders/${order.id}/results`, {
        token: rn.token,
        body: { results: [{ testCode: 'CBC', testName: 'CBC', valueNum: 5 }] },
    });
    assert.equal(r1.status, 201, JSON.stringify(r1.body));
    assert.equal(r1.body.data.orderStatus, 'In Progress');

    const r2 = await call('POST', `/lab-orders/${order.id}/results`, {
        token: rn.token,
        body: { results: [{ testCode: 'UA', testName: 'Urinalysis', valueText: 'Clear' }] },
    });
    assert.equal(r2.body.data.orderStatus, 'In Progress', 'Zinc (no catalog code) still pending');

    // Zinc has no catalog code, so it still matches by lowercased name — the pre-catalog behavior.
    const r3 = await call('POST', `/lab-orders/${order.id}/results`, {
        token: rn.token,
        body: { results: [{ testName: 'Zinc', valueNum: 90, unit: 'mcg/dL' }] },
    });
    assert.equal(r3.body.data.orderStatus, 'Resulted', 'every ordered test now has a final result');

    const final = (await call('GET', `/lab-orders/${order.id}`, { token: rn.token })).body.data;
    assert.equal(final.orderStatus, 'Resulted');
});

test('SAF-26: code-event save-note persists a real signable chart note; generate-note preview does not', async () => {
    const t = await newTenant('cenote');
    const nurse = await addUser(t, 'cenoternurse', 'nurse');
    const doc = await addUser(t, 'cenotedoc', 'physician');
    const { patient, encounterId, ward } = await admitPatient(t.token, 'Cenote');

    const act = { patientId: patient.id, encounterId, eventType: 'Code Blue', location: 'Room 1', teamLeadId: doc.id, teamLeadName: 'Dr Lead' };
    const ev = (await call('POST', '/api/CodeEvent/activate', { token: nurse.token, body: act })).body.data;
    assert.equal(ev.status, 'active');

    const entry = { id: 'e1', timestamp: new Date().toISOString(), entryType: 'Medication Given', medication: { name: 'Epinephrine', dose: '1 mg', route: 'IV' } };
    await call('PUT', `/api/CodeEvent/${ev.id}/timeline`, { token: nurse.token, body: { timeline: [entry] } });

    const notesBefore = (await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: nurse.token })).body.data;
    assert.equal(notesBefore.length, 0);

    // Preview must not have any side effect — calling it any number of times creates nothing.
    const preview = await call('GET', `/api/CodeEvent/${ev.id}/generate-note`, { token: nurse.token });
    assert.match(preview.body.data.noteText, /Epinephrine 1 mg IV/);
    const notesAfterPreview = (await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: nurse.token })).body.data;
    assert.equal(notesAfterPreview.length, 0, 'GET generate-note is preview-only');

    const saved = await call('POST', `/api/CodeEvent/${ev.id}/save-note`, { token: nurse.token, body: {} });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.ok(saved.body.data.noteId);
    assert.match(saved.body.data.noteText, /Epinephrine 1 mg IV/);

    const note = (await call('GET', `/api/inpatient/clinical/notes/${saved.body.data.noteId}`, { token: nurse.token })).body.data;
    assert.equal(note.type, 'code_event');
    assert.equal(note.encounterId, encounterId);
    assert.equal(note.patientId, patient.id);
    assert.match(note.richText, /Epinephrine 1 mg IV/);
    assert.match(note.title, /Code event — Code Blue/);

    const notesAfterSave = (await call('GET', `/api/inpatient/clinical/notes/patient/${patient.id}`, { token: nurse.token })).body.data;
    assert.equal(notesAfterSave.length, 1);

    // SAF-26: 'unit-1' used to be mistaken for "every unit" — it's an ordinary unit id now.
    assert.equal((await call('GET', `/api/CodeEvent/active/${ward.id}`, { token: t.token })).body.data.length, 1);
    assert.equal((await call('GET', '/api/CodeEvent/active/all', { token: t.token })).body.data.length, 1);
    assert.equal((await call('GET', '/api/CodeEvent/active/unit-1', { token: t.token })).body.data.length, 0);
});

test('imaging safety fields: pregnancyStatus/contrastAllergy round-trip on both the direct and CPOE order-entry paths', async () => {
    const t = await newTenant('imgsafety');
    const doc = await addUser(t, 'imgsafetydoc', 'physician');
    const { patient, encounterId } = await admitPatient(t.token, 'Imgsafety');

    const direct = await call('POST', '/api/Radiology/order', {
        token: doc.token,
        body: {
            patientId: patient.id,
            encounterId,
            modality: 'CT',
            bodyRegion: 'Abdomen',
            contrast: 'With contrast',
            clinicalIndication: 'r/o appendicitis',
            pregnancyStatus: 'Yes',
            contrastAllergy: 'confirmed',
        },
    });
    assert.equal(direct.status, 201, JSON.stringify(direct.body));
    assert.equal(direct.body.data.pregnancyStatus, 'Yes');
    assert.equal(direct.body.data.contrastAllergy, 'confirmed');
    // Not flattened into free text — the dedicated structured fields are the source of truth now.
    assert.equal(direct.body.data.specialInstructions, undefined);

    const cpoe = await call('POST', '/api/orders', {
        token: doc.token,
        body: {
            orderType: 'radiology',
            patientId: patient.id,
            encounterId,
            modality: 'MRI',
            bodyRegion: 'Brain',
            clinicalIndication: 'Headache workup',
            pregnancyStatus: 'Unknown',
            contrastAllergy: 'unknown',
        },
    });
    assert.equal(cpoe.status, 201, JSON.stringify(cpoe.body));
    assert.equal(cpoe.body.data.detail.pregnancyStatus, 'Unknown');
    assert.equal(cpoe.body.data.detail.contrastAllergy, 'unknown');

    // Both fields stay optional — omitting them must not break order creation.
    const omitted = await call('POST', '/api/Radiology/order', {
        token: doc.token,
        body: { patientId: patient.id, encounterId, modality: 'X-Ray', bodyRegion: 'Chest', clinicalIndication: 'Cough' },
    });
    assert.equal(omitted.status, 201, JSON.stringify(omitted.body));
    assert.equal(omitted.body.data.pregnancyStatus, undefined);
    assert.equal(omitted.body.data.contrastAllergy, undefined);
});
