// Audit logging (#SEC-02): the generic per-request middleware, explicit login/platform/SMART
// events, the admin-only read API, and the append-only trigger on audit_events.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const platformAdminIds = [];
const suffix = `audit${Date.now().toString(36)}`;

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    for (const id of tenantIds) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    for (const id of platformAdminIds) await pool.query('DELETE FROM platform_admins WHERE id = $1', [id]);
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

// The generic per-request middleware writes its row from a res.on('finish') handler without
// awaiting it (fire-and-forget, by design — see middleware/audit.js), so the row can land a few
// milliseconds after the HTTP client already has its response. Poll briefly instead of asserting
// immediately. Explicit recordAuditEvent() calls elsewhere are awaited before the response is sent
// and never need this.
async function pollForRow(queryText, params, tries = 20, delayMs = 25) {
    for (let i = 0; i < tries; i++) {
        const row = (await pool.query(queryText, params)).rows[0];
        if (row) return row;
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return undefined;
}

async function newPlatformAdmin(label) {
    const email = `platform-${label}-${suffix}@test.example`;
    const password = 'Platform-passw0rd!';
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO platform_admins (email, password_hash) VALUES ($1,$2) RETURNING id', [email, hash]);
    platformAdminIds.push(r.rows[0].id);
    const login = await call('POST', '/api/platform/login', { body: { email, password } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return { token: login.body.data.token };
}

test('audit: chart read logs a row with the patient id', async () => {
    const t = await newTenant('read');
    const { patient } = await admitPatient(t.token, 'Read');
    const r = await call('GET', `/Patient/getPatientById/${patient.id}`, { token: t.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    const row = await pollForRow(
        `SELECT * FROM audit_events WHERE tenant_id = $1 AND patient_id = $2 AND path = $3 ORDER BY at DESC LIMIT 1`,
        [t.user.tenant.id, patient.id, `/Patient/getPatientById/${patient.id}`],
    );
    assert.ok(row, 'expected an audit row for the chart read');
    assert.equal(row.actor_type, 'staff');
    assert.equal(row.action, 'read');
    assert.equal(row.status, 200);
});

test('audit: search query values are never stored, only the key names', async () => {
    const t = await newTenant('search');
    const secret = 'SuperSecretSearchTerm9000';
    const r = await call('GET', `/Patient/getAllPatientListPaginated?search=${encodeURIComponent(secret)}`, { token: t.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    const row = await pollForRow(
        `SELECT * FROM audit_events WHERE tenant_id = $1 AND path LIKE '/Patient/getAllPatientListPaginated%' ORDER BY at DESC LIMIT 1`,
        [t.user.tenant.id],
    );
    assert.ok(row);
    assert.deepEqual(row.query_keys, ['search']);
    assert.ok(!JSON.stringify(row).includes(secret), 'the raw search term must never be persisted');
    assert.ok(!row.path.includes(secret), 'the stored path must not carry the query string');
});

test('audit: a failed login is logged with no authenticated user', async () => {
    const t = await newTenant('badlogin');
    const bad = await call('POST', '/login', { body: { username: t.email, password: 'definitely-wrong' } });
    assert.equal(bad.status, 401);

    const row = (
        await pool.query(
            `SELECT * FROM audit_events WHERE tenant_id = $1 AND action = 'login_failed' ORDER BY at DESC LIMIT 1`,
            [t.user.tenant.id],
        )
    ).rows[0];
    assert.ok(row, 'expected a login_failed row');
    assert.equal(row.actor_type, 'anonymous');
    assert.equal(row.actor_id, null);
    assert.ok(!JSON.stringify(row).toLowerCase().includes(t.email.toLowerCase()), 'the raw email must not be persisted');
});

test('audit: a platform tenant delete is logged with the impact counts', async () => {
    const admin = await newPlatformAdmin('del');
    const created = await call('POST', '/api/platform/tenants', { token: admin.token, body: { name: `Delete Me ${suffix}` } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const tenantId = created.body.data.id ?? created.body.data._id;

    const del = await call('DELETE', `/api/platform/tenants/${tenantId}`, { token: admin.token, body: { confirmName: `Delete Me ${suffix}` } });
    assert.equal(del.status, 200, JSON.stringify(del.body));

    const row = (
        await pool.query(
            `SELECT * FROM audit_events WHERE actor_type = 'platform_admin' AND action = 'delete' AND resource = 'tenant' AND resource_id = $1 ORDER BY at DESC LIMIT 1`,
            [tenantId],
        )
    ).rows[0];
    assert.ok(row, 'expected a tenant delete row');
    assert.equal(row.tenant_id, null, 'the deleted tenant no longer exists, so tenant_id must be null');
    assert.equal(typeof row.details.patientCount, 'number');
    assert.equal(typeof row.details.userCount, 'number');
});

test('audit: an unauthenticated FHIR request is logged in fhir_access_log', async () => {
    const res = await fetch(`${base}/fhir/Patient/does-not-matter`);
    assert.equal(res.status, 401);

    const row = (
        await pool.query(
            `SELECT * FROM fhir_access_log WHERE resource_type = 'Patient' AND status = 401 AND tenant_id IS NULL ORDER BY at DESC LIMIT 1`,
        )
    ).rows[0];
    assert.ok(row, 'expected a null-tenant fhir_access_log row for the unauthenticated request');
});

test('audit: audit_events is append-only — UPDATE and DELETE both raise', async () => {
    const t = await newTenant('immutable');
    await call('GET', '/Wards/getWardList', { token: t.token });
    const row = await pollForRow(`SELECT id FROM audit_events WHERE tenant_id = $1 ORDER BY at DESC LIMIT 1`, [t.user.tenant.id]);
    assert.ok(row);

    await assert.rejects(
        pool.query('UPDATE audit_events SET status = 999 WHERE id = $1', [row.id]),
        /append-only/,
    );
    await assert.rejects(
        pool.query('DELETE FROM audit_events WHERE id = $1', [row.id]),
        /append-only/,
    );
});

test('audit: GET /api/audit-events is admin-only and tenant-scoped', async () => {
    const t = await newTenant('scope');
    const nurse = await addUser(t, 'nursescope', 'nurse');
    const { patient } = await admitPatient(t.token, 'Scope');
    await call('GET', `/Patient/getPatientById/${patient.id}`, { token: t.token });
    assert.ok(
        await pollForRow(`SELECT 1 FROM audit_events WHERE tenant_id = $1 AND patient_id = $2`, [t.user.tenant.id, patient.id]),
        'expected the chart read to be logged before querying for it',
    );

    const forbidden = await call('GET', '/api/audit-events', { token: nurse.token });
    assert.equal(forbidden.status, 403);

    const mine = await call('GET', `/api/audit-events?patientId=${patient.id}`, { token: t.token });
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.ok(mine.body.data.some((e) => e.patientId === patient.id));

    const other = await newTenant('scopeOther');
    const crossTenant = await call('GET', `/api/audit-events?patientId=${patient.id}`, { token: other.token });
    assert.equal(crossTenant.status, 200, JSON.stringify(crossTenant.body));
    assert.equal(crossTenant.body.data.length, 0, "a different tenant's admin must see none of this patient's events");
});
