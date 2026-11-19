// Problem list / clinical docs module: POA/principal diagnosis, clinical-note co-sign and retained
// versions, overdue-H&P worklist, late-entry documentation after discharge, and the pure-JS unzip
// reader (SAF-13) used by the ICD-10 seed script.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { listZipEntries, extractZipEntry } from '../src/lib/unzip.js';

let server;
let base;
const tenantIds = [];
const suffix = `cd${Date.now().toString(36)}`;
const NOTES_BASE = '/api/inpatient/clinical';

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

// -------------------------------------------------------------------------------------------- unzip
test('unzip: reads a stored entry and a deflated entry out of a hand-built zip', () => {
    const stored = Buffer.from('hello stored world');
    const toDeflate = Buffer.from('icd10cm-order-2026.txt payload '.repeat(50));
    const deflated = zlib.deflateRawSync(toDeflate);

    const files = [
        { name: 'readme.txt', method: 0, data: stored },
        { name: 'icd10cm-order-2026.txt', method: 8, data: deflated, uncompressedSize: toDeflate.length },
    ];

    const parts = [];
    const centralEntries = [];
    let offset = 0;
    for (const f of files) {
        const nameBuf = Buffer.from(f.name, 'utf8');
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(f.method, 8);
        local.writeUInt32LE(f.data.length, 18); // compressed size
        local.writeUInt32LE(f.uncompressedSize ?? f.data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        parts.push(local, nameBuf, f.data);
        centralEntries.push({ name: nameBuf, method: f.method, compSize: f.data.length, uncompSize: f.uncompressedSize ?? f.data.length, offset });
        offset += local.length + nameBuf.length + f.data.length;
    }
    const cdStart = offset;
    for (const e of centralEntries) {
        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(e.method, 10);
        cd.writeUInt32LE(e.compSize, 20);
        cd.writeUInt32LE(e.uncompSize, 24);
        cd.writeUInt16LE(e.name.length, 28);
        cd.writeUInt32LE(e.offset, 42);
        parts.push(cd, e.name);
        offset += cd.length + e.name.length;
    }
    const cdSize = offset - cdStart;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(centralEntries.length, 8);
    eocd.writeUInt16LE(centralEntries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    parts.push(eocd);

    const zipBuf = Buffer.concat(parts);
    const entries = listZipEntries(zipBuf);
    assert.equal(entries.length, 2);

    const readme = entries.find((e) => e.name === 'readme.txt');
    assert.equal(extractZipEntry(zipBuf, readme).toString('utf8'), 'hello stored world');

    const orderFile = entries.find((e) => /icd10cm-order-\d{4}\.txt$/i.test(e.name));
    assert.ok(orderFile, 'order-file entry pattern matches');
    assert.equal(extractZipEntry(zipBuf, orderFile).toString('utf8'), toDeflate.toString('utf8'));
});

// -------------------------------------------------------------------------------------- POA / principal
test('problems: POA/principal require encounterId, one principal per encounter', async () => {
    await pool.query(
        `INSERT INTO icd10_codes (code, description, billable, effective_year) VALUES
            ('E11.9', 'Type 2 diabetes mellitus without complications', true, 2026),
            ('I10', 'Essential (primary) hypertension', true, 2026)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
    );
    const t = await newTenant('poa');
    const { encounterId, patient } = await admitPatient(t.token, 'Poa');

    const noEncounter = await call('POST', `/api/patients/${patient.id}/problems`, { token: t.token, body: { icd10Code: 'E11.9', poa: 'Y' } });
    assert.equal(noEncounter.status, 400, 'poa without encounterId is rejected');

    const first = await call('POST', `/api/patients/${patient.id}/problems`, { token: t.token, body: { icd10Code: 'E11.9', encounterId, poa: 'Y', isPrincipal: true } });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.data.poa, 'Y');
    assert.equal(first.body.data.isPrincipal, true);

    const second = await call('POST', `/api/patients/${patient.id}/problems`, { token: t.token, body: { icd10Code: 'I10', encounterId, isPrincipal: true } });
    assert.equal(second.status, 409, 'a second principal diagnosis on the same encounter is rejected');

    const nonPrincipal = await call('POST', `/api/patients/${patient.id}/problems`, { token: t.token, body: { icd10Code: 'I10', encounterId } });
    assert.equal(nonPrincipal.status, 201);
    const promote = await call('PATCH', `/api/problems/${nonPrincipal.body.data.id}`, { token: t.token, body: { isPrincipal: true } });
    assert.equal(promote.status, 409, 'PATCH promoting a second problem to principal is rejected the same way');
});

// --------------------------------------------------------------------------------------- co-sign
test('clinical notes: nurse co-sign flow, retained versions, overdue H&P worklist, late entry', async () => {
    const t = await newTenant('cdoc');
    const md = await addUser(t, 'cdocmd', 'physician');
    const rn = await addUser(t, 'cdocrn', 'nurse');
    const { patient, encounterId } = await admitPatient(t.token, 'Cdoc');

    // A nurse may sign a progress note she authored herself; it then requires physician co-sign.
    const created = await call('POST', `${NOTES_BASE}/notes/create`, { token: rn.token, body: { patientId: patient.id, encounterId, type: 'progress', content: { assessment: 'stable' } } });
    assert.equal(created.status, 201);
    const note = created.body.data;

    const otherMd = await addUser(t, 'cdocotherMd', 'physician');
    const foreignSign = await call('POST', `${NOTES_BASE}/notes/sign/${note.id}`, { token: otherMd.token });
    assert.equal(foreignSign.status, 200, 'a physician may sign anyone\'s note');
    assert.equal(foreignSign.body.data.requiresCosign, false, 'physician signature needs no co-sign');

    const created2 = await call('POST', `${NOTES_BASE}/notes/create`, { token: rn.token, body: { patientId: patient.id, encounterId, type: 'progress', content: { assessment: 'stable' } } });
    const note2 = created2.body.data;
    const otherRn = await addUser(t, 'cdocOtherRn', 'nurse');
    const wrongNurseSign = await call('POST', `${NOTES_BASE}/notes/sign/${note2.id}`, { token: otherRn.token });
    assert.equal(wrongNurseSign.status, 403, 'a nurse may not sign someone else\'s note');

    const selfSign = await call('POST', `${NOTES_BASE}/notes/sign/${note2.id}`, { token: rn.token });
    assert.equal(selfSign.status, 200, JSON.stringify(selfSign.body));
    assert.equal(selfSign.body.data.requiresCosign, true, 'nurse self-sign requires physician co-sign');
    assert.equal(selfSign.body.data.cosignedBy, null);

    const cosignByNurse = await call('POST', `${NOTES_BASE}/notes/cosign/${note2.id}`, { token: rn.token });
    assert.equal(cosignByNurse.status, 403, 'only a physician can co-sign');

    const cosign = await call('POST', `${NOTES_BASE}/notes/cosign/${note2.id}`, { token: md.token });
    assert.equal(cosign.status, 200, JSON.stringify(cosign.body));
    assert.equal(cosign.body.data.cosignedBy, md.id);
    assert.ok(cosign.body.data.cosignedAt);

    const doubleCosign = await call('POST', `${NOTES_BASE}/notes/cosign/${note2.id}`, { token: md.token });
    assert.equal(doubleCosign.status, 409, 'already co-signed');

    const cosignNotRequired = await call('POST', `${NOTES_BASE}/notes/cosign/${note.id}`, { token: md.token });
    assert.equal(cosignNotRequired.status, 400, 'a physician-signed note has nothing to co-sign');

    // A nurse cannot sign an H&P/consult/discharge-summary type note even if self-authored — but she
    // can't author one either, so exercise the rule through a type-mismatch where a physician re-types
    // the note's note_type directly (defense in depth, not reachable via the create endpoint).
    const hpByRn = await call('POST', `${NOTES_BASE}/notes/create`, { token: rn.token, body: { patientId: patient.id, encounterId, type: 'hp', content: {} } });
    assert.equal(hpByRn.status, 403, 'nurse cannot author H&P');

    // Retained note versions: each edit keeps the real prior content, not just a checksum.
    const draft = await call('POST', `${NOTES_BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'progress', content: { assessment: 'stable' } } });
    const upd = await call('PUT', `${NOTES_BASE}/notes/update/${draft.body.data.id}`, { token: md.token, body: { content: { assessment: 'improving' } } });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    assert.equal(upd.body.data.versionHistory.length, 2);
    assert.equal(upd.body.data.versionHistory[0].content.assessment, 'stable', 'prior version content is recoverable');
    assert.equal(upd.body.data.versionHistory[1].content.assessment, 'improving');

    // Overdue H&P worklist: this encounter has no signed H&P and was admitted >24h ago once backdated.
    await pool.query(`UPDATE encounters SET admitted_at = now() - interval '2 days' WHERE id = $1`, [encounterId]);
    const worklist = await call('GET', `${NOTES_BASE}/hp-worklist`, { token: t.token });
    assert.equal(worklist.status, 200, JSON.stringify(worklist.body));
    const row = worklist.body.data.find((r) => r.encounterId === encounterId);
    assert.ok(row, 'overdue encounter appears on the worklist');
    assert.ok(row.hoursOverdue > 0);

    const hp = await call('POST', `${NOTES_BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'hp', content: { hpi: 'x' } } });
    await call('POST', `${NOTES_BASE}/notes/sign/${hp.body.data.id}`, { token: md.token });
    const worklistAfter = await call('GET', `${NOTES_BASE}/hp-worklist`, { token: t.token });
    assert.ok(!worklistAfter.body.data.some((r) => r.encounterId === encounterId), 'signing the H&P removes it from the worklist');

    // Late entry: documentation touched after the encounter is discharged is flagged, not blocked.
    await pool.query(`UPDATE encounters SET status = 'discharged' WHERE id = $1`, [encounterId]);
    const lateNote = await call('POST', `${NOTES_BASE}/notes/create`, { token: md.token, body: { patientId: patient.id, encounterId, type: 'progress', content: { note: 'late' } } });
    assert.equal(lateNote.status, 201, 'note creation is still allowed after discharge');
    assert.equal(lateNote.body.data.isLateEntry, true);
    const lateAddendum = await call('POST', `${NOTES_BASE}/notes/addendum/${hp.body.data.id}`, { token: md.token, body: { text: 'late addendum' } });
    assert.equal(lateAddendum.status, 200, 'addendum is still allowed after discharge');
    assert.equal(lateAddendum.body.data.isLateEntry, true);
});
