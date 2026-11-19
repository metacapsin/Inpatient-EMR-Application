// Patient registration module: unknown-patient path, server-required fields for standard registration,
// registration-time consent (no encounter required), BUG-06 list-filter fixes, FHIR US Core extensions.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { toFhirPatient } from '../src/lib/fhir/patient.js';

let server;
let base;
const tenantIds = [];
const suffix = `pr${Date.now().toString(36)}`;

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

// -------------------------------------------------------------------------------- required fields
test('patient registration: standard path requires dOB/sex; unknown-patient path does not', async () => {
    const t = await newTenant('reqf');
    const missingDob = await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'No', lastName: 'Dob', sex: 'F' } });
    assert.equal(missingDob.status, 400, JSON.stringify(missingDob.body));
    const missingSex = await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'No', lastName: 'Sex', dOB: '1980-01-01' } });
    assert.equal(missingSex.status, 400, JSON.stringify(missingSex.body));

    const unknown = await call('POST', '/Patient/createPatient', { token: t.token, body: { registrationType: 'unknown', sex: 'M' } });
    assert.equal(unknown.status, 201, JSON.stringify(unknown.body));
    assert.equal(unknown.body.data.isUnknownPatient, true);
    assert.equal(unknown.body.data.firstName, 'Unknown');
    assert.ok(unknown.body.data.lastName.startsWith('Patient-'), `expected a generated placeholder, got ${unknown.body.data.lastName}`);

    // A client can't set isUnknownPatient=true directly on a standard registration — it's only ever
    // derived from registrationType.
    const spoofed = await call('POST', '/Patient/createPatient', {
        token: t.token,
        body: { firstName: 'Real', lastName: 'Person', dOB: '1980-01-01', sex: 'F', isUnknownPatient: true },
    });
    assert.equal(spoofed.status, 201);
    assert.equal(spoofed.body.data.isUnknownPatient, false, 'standard registration ignores a client-supplied isUnknownPatient');

    // Resolving an unknown patient's identity later is an ordinary update.
    const resolved = await call('PUT', `/Patient/updatePatientById/${unknown.body.data.id}`, {
        token: t.token,
        body: { firstName: 'Identified', lastName: 'Person', dOB: '1975-06-01', isUnknownPatient: false },
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal(resolved.body.data.isUnknownPatient, false);
    assert.equal(resolved.body.data.firstName, 'Identified');
});

// -------------------------------------------------------------------------------- registration-time consent
test('registration-time consent: no encounter required; visible via patient-level list only', async () => {
    const t = await newTenant('rcon');
    const p = (await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Con', lastName: 'Sent', dOB: '1980-01-01', sex: 'F' } })).body.data;

    const noEncounter = await call('POST', '/api/Consent/create', {
        token: t.token,
        body: {
            patientId: p.id, consentType: 'HIPAA NPP', signedByType: 'Patient', signedByName: 'Con Sent',
            patientHasCapacity: true, status: 'Signed',
        },
    });
    assert.equal(noEncounter.status, 201, JSON.stringify(noEncounter.body));
    assert.equal(noEncounter.body.encounterId, null);
    assert.equal(noEncounter.body.status, 'Signed');
    assert.ok(noEncounter.body.signedAt, 'status Signed with no signedAt auto-stamps one');

    const byPatient = await call('GET', `/api/Consent/patient/${p.id}`, { token: t.token });
    assert.equal(byPatient.status, 200);
    assert.equal(byPatient.body.data.length, 1);
    assert.equal(byPatient.body.data[0].consentType, 'HIPAA NPP');

    // A foreign patient id is rejected the same way an encounter-based consent rejects a foreign encounter.
    const otherTenant = await newTenant('rconB');
    const foreign = await call('POST', '/api/Consent/create', {
        token: otherTenant.token,
        body: { patientId: p.id, consentType: 'HIPAA NPP', signedByType: 'Patient', signedByName: 'X', patientHasCapacity: true },
    });
    assert.equal(foreign.status, 404);
});

// -------------------------------------------------------------------------------- BUG-06
test('BUG-06: recentlyCreated today/thismonth actually filter the patient list', async () => {
    const t = await newTenant('rec6');
    await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Rec', lastName: 'Ent', dOB: '1980-01-01', sex: 'F' } });

    const today = await call('GET', '/Patient/getAllPatientListPaginated?recentlyCreated=today', { token: t.token });
    assert.equal(today.status, 200);
    assert.equal(today.body.data.total, 1);

    const thisMonth = await call('GET', '/Patient/getAllPatientListPaginated?recentlyCreated=thismonth', { token: t.token });
    assert.equal(thisMonth.status, 200);
    assert.equal(thisMonth.body.data.total, 1);

    await pool.query(`UPDATE patients SET created_at = now() - interval '2 years' WHERE tenant_id = $1`, [t.user.tenant.id]);
    const afterBackdate = await call('GET', '/Patient/getAllPatientListPaginated?recentlyCreated=today', { token: t.token });
    assert.equal(afterBackdate.body.data.total, 0, 'backdated patient no longer matches today');
});

// -------------------------------------------------------------------------------- FHIR US Core extensions
test('FHIR Patient: US Core race/ethnicity/birthsex/genderIdentity extensions', () => {
    const withAll = toFhirPatient({
        id: 'p1', first_name: 'Full', last_name: 'Demo', is_active: true,
        race: ['2106-3', '1002-5'], ethnicity: '2186-5', sex_at_birth: 'F', gender_identity: '446141000124107',
    });
    const race = withAll.extension.find((e) => e.url.endsWith('us-core-race'));
    assert.equal(race.extension.filter((e) => e.url === 'ombCategory').length, 2);
    assert.match(race.extension.find((e) => e.url === 'text').valueString, /White, American Indian/);

    const ethnicity = withAll.extension.find((e) => e.url.endsWith('us-core-ethnicity'));
    assert.equal(ethnicity.extension.find((e) => e.url === 'ombCategory').valueCoding.code, '2186-5');

    const birthsex = withAll.extension.find((e) => e.url.endsWith('us-core-birthsex'));
    assert.equal(birthsex.valueCode, 'F');

    const genderIdentity = withAll.extension.find((e) => e.url.endsWith('us-core-genderIdentity'));
    assert.equal(genderIdentity.extension[0].valueCodeableConcept.coding[0].code, '446141000124107');
    assert.equal(genderIdentity.extension[0].valueCodeableConcept.coding[0].system, 'http://snomed.info/sct');

    // A patient with none of these set gets no extension array at all — not an array of empty stubs.
    const bare = toFhirPatient({ id: 'p2', first_name: 'Bare', last_name: 'Demo', is_active: true });
    assert.equal(bare.extension, undefined);

    // A declined/unknown race code goes in `text` only, not as an ombCategory (it isn't an OMB category).
    const declined = toFhirPatient({ id: 'p3', first_name: 'Dec', last_name: 'Lined', is_active: true, race: ['UNK'] });
    const declinedRace = declined.extension.find((e) => e.url.endsWith('us-core-race'));
    assert.equal(declinedRace.extension.filter((e) => e.url === 'ombCategory').length, 0);
    assert.equal(declinedRace.extension.find((e) => e.url === 'text').valueString, 'Unknown');
});
