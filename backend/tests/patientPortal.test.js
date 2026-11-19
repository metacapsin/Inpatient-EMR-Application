// Patient portal / SMART (#SEC-06, 14, 15): portal-invite can no longer be redirected to an
// arbitrary email or null an active account's password; login/forgot-password are no longer
// ambiguous across tenants sharing an email; SMART discovery is spec-correct and `aud`/revoke are
// validated.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';

let server;
let base;
const tenantIds = [];
const suffix = `pp${Date.now().toString(36)}`;

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

async function createPatient(token, label, email) {
    const r = await call('POST', '/Patient/createPatient', {
        token,
        body: { firstName: label, lastName: 'Portal', dOB: '1990-01-01', sex: 'F', ...(email ? { email } : {}) },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data;
}

// ----------------------------------------------------------------------------------------- SEC-06
test('portal-invite: a caller-supplied email is ignored — always uses the email on file', async () => {
    const t = await newTenant('inviteIgnore');
    const email = `patient-${suffix}@test.example`;
    const patient = await createPatient(t.token, 'IgnoreOverride', email);

    const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, {
        token: t.token,
        body: { email: 'attacker@evil.example' },
    });
    assert.equal(invite.status, 200, JSON.stringify(invite.body));
    assert.equal(invite.body.data.email, email, 'invite must go to the email on file, not the request body');
});

test('portal-invite: fails clearly when the patient has no email on file', async () => {
    const t = await newTenant('inviteNoEmail');
    const patient = await createPatient(t.token, 'NoEmail');

    const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    assert.equal(invite.status, 409);
    assert.match(invite.body.message, /no email on file/i);
});

test('portal-invite: cannot re-invite (and cannot null the password of) an already-active account', async () => {
    const t = await newTenant('inviteActive');
    const email = `patient-${suffix}-active@test.example`;
    const patient = await createPatient(t.token, 'Active', email);

    const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    assert.equal(invite.status, 200, JSON.stringify(invite.body));
    const setPw = await call('POST', '/patient-auth/set-password', {
        body: { token: invite.body.data.inviteToken, newPassword: 'Patient-passw0rd!', confirmPassword: 'Patient-passw0rd!' },
    });
    assert.equal(setPw.status, 200, JSON.stringify(setPw.body));

    const reinvite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    assert.equal(reinvite.status, 409, JSON.stringify(reinvite.body));
    assert.match(reinvite.body.message, /forgot password/i);

    // The original password must still work — the blocked re-invite must not have touched it.
    const login = await call('POST', '/patient-auth/login', { body: { email, password: 'Patient-passw0rd!' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
});

test('portal-invite: resending to a not-yet-activated account is unaffected', async () => {
    const t = await newTenant('inviteResend');
    const email = `patient-${suffix}-resend@test.example`;
    const patient = await createPatient(t.token, 'Resend', email);

    const first = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    assert.equal(first.status, 200);
    const second = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.notEqual(second.body.data.inviteToken, first.body.data.inviteToken);
});

// ----------------------------------------------------------------------------------------- SEC-14
test('patient-auth/login: the correct tenant account is found when two tenants share an email', async () => {
    const email = `shared-${suffix}@test.example`;
    const tA = await newTenant('loginA');
    const tB = await newTenant('loginB');
    const patientA = await createPatient(tA.token, 'SharedA', email);
    const patientB = await createPatient(tB.token, 'SharedB', email);

    const inviteA = await call('POST', `/api/patients/${patientA.id}/portal-invite`, { token: tA.token, body: {} });
    assert.equal(inviteA.status, 200, JSON.stringify(inviteA.body));
    await call('POST', '/patient-auth/set-password', {
        body: { token: inviteA.body.data.inviteToken, newPassword: 'PasswordA1!', confirmPassword: 'PasswordA1!' },
    });
    const inviteB = await call('POST', `/api/patients/${patientB.id}/portal-invite`, { token: tB.token, body: {} });
    assert.equal(inviteB.status, 200, JSON.stringify(inviteB.body));
    await call('POST', '/patient-auth/set-password', {
        body: { token: inviteB.body.data.inviteToken, newPassword: 'PasswordB1!', confirmPassword: 'PasswordB1!' },
    });

    const loginA = await call('POST', '/patient-auth/login', { body: { email, password: 'PasswordA1!' } });
    assert.equal(loginA.status, 200, JSON.stringify(loginA.body));
    assert.equal(loginA.body.data.tenantId, tA.user.tenant.id);

    const loginB = await call('POST', '/patient-auth/login', { body: { email, password: 'PasswordB1!' } });
    assert.equal(loginB.status, 200, JSON.stringify(loginB.body));
    assert.equal(loginB.body.data.tenantId, tB.user.tenant.id);
});

test('patient-auth/forgot-password: every matching tenant account gets a fresh reset token, not just one', async () => {
    const email = `shared-fp-${suffix}@test.example`;
    const tA = await newTenant('fpA');
    const tB = await newTenant('fpB');
    const patientA = await createPatient(tA.token, 'FpA', email);
    const patientB = await createPatient(tB.token, 'FpB', email);
    for (const [t, patient] of [[tA, patientA], [tB, patientB]]) {
        const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
        await call('POST', '/patient-auth/set-password', {
            body: { token: invite.body.data.inviteToken, newPassword: 'ResetMe1!', confirmPassword: 'ResetMe1!' },
        });
    }

    const before = await pool.query(`SELECT id, invite_token_hash FROM patient_accounts WHERE lower(email) = lower($1)`, [email]);
    assert.equal(before.rowCount, 2);

    const fp = await call('POST', '/patient-auth/forgot-password', { body: { email } });
    assert.equal(fp.status, 200);

    const after1 = await pool.query(`SELECT id, invite_token_hash FROM patient_accounts WHERE lower(email) = lower($1)`, [email]);
    assert.equal(after1.rowCount, 2);
    for (const row of after1.rows) {
        const prior = before.rows.find((r) => r.id === row.id);
        assert.ok(row.invite_token_hash, 'a reset token hash must be set');
        assert.notEqual(row.invite_token_hash, prior.invite_token_hash, 'each matching account must get its own fresh token');
    }
});

// ----------------------------------------------------------------------------------------- SEC-15
test('SMART discovery: served at the FHIR-relative path with absolute URLs; old path redirects', async () => {
    const doc = await call('GET', '/fhir/.well-known/smart-configuration');
    assert.equal(doc.status, 200, JSON.stringify(doc.body));
    assert.equal(doc.body.authorization_endpoint, `${config.backendUrl}/oauth/authorize`);
    assert.equal(doc.body.token_endpoint, `${config.backendUrl}/oauth/token`);
    assert.equal(doc.body.revocation_endpoint, `${config.backendUrl}/oauth/revoke`);

    const old = await fetch(`${base}/.well-known/smart-configuration`, { redirect: 'manual' });
    assert.ok([301, 302].includes(old.status));
    assert.match(old.headers.get('location') || '', /\/fhir\/\.well-known\/smart-configuration$/);
});

test('oauth/authorize: aud is required and must match the FHIR base URL', async () => {
    const t = await newTenant('audReq');
    const client = await call('POST', '/api/smart-clients', {
        token: t.token,
        body: { name: 'Aud Test App', redirectUris: ['http://127.0.0.1:9999/cb'], allowedScopes: ['patient/*.read'] },
    });
    assert.equal(client.status, 201, JSON.stringify(client.body));
    const clientId = client.body.data.clientId;
    const challenge = crypto.createHash('sha256').update('verifier').digest('base64url');
    const qs = (extra) =>
        `/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://127.0.0.1:9999/cb')}&scope=${encodeURIComponent('patient/*.read')}&state=xyz&code_challenge=${challenge}&code_challenge_method=S256${extra}`;

    const missingAud = await call('GET', qs(''));
    assert.equal(missingAud.status, 400, JSON.stringify(missingAud.body));

    const wrongAud = await fetch(base + qs(`&aud=${encodeURIComponent('http://evil.example/fhir')}`), { redirect: 'manual' });
    assert.equal(wrongAud.status, 302);
    assert.match(wrongAud.headers.get('location') || '', /error=invalid_request/);

    const correctAud = await fetch(base + qs(`&aud=${encodeURIComponent(`${config.backendUrl}/fhir`)}`), { redirect: 'manual' });
    assert.equal(correctAud.status, 302);
    assert.match(correctAud.headers.get('location') || '', /\/patient\/authorize/);
});

test('oauth/revoke: a client cannot revoke a grant belonging to a different client', async () => {
    const t = await newTenant('revokeScope');
    const email = `patient-${suffix}-revoke@test.example`;
    const patient = await createPatient(t.token, 'Revoke', email);
    const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
    await call('POST', '/patient-auth/set-password', {
        body: { token: invite.body.data.inviteToken, newPassword: 'RevokeMe1!', confirmPassword: 'RevokeMe1!' },
    });
    const login = await call('POST', '/patient-auth/login', { body: { email, password: 'RevokeMe1!' } });
    const patientJwt = login.body.data.token;

    const clientA = await call('POST', '/api/smart-clients', {
        token: t.token,
        body: { name: 'Client A', redirectUris: ['http://127.0.0.1:9999/cb'], allowedScopes: ['patient/*.read', 'offline_access'] },
    });
    const clientB = await call('POST', '/api/smart-clients', {
        token: t.token,
        body: { name: 'Client B', redirectUris: ['http://127.0.0.1:9998/cb'], allowedScopes: ['patient/*.read', 'offline_access'] },
    });
    const clientIdA = clientA.body.data.clientId;
    const clientIdB = clientB.body.data.clientId;

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const decision = await call('POST', '/oauth/authorize/decision', {
        token: patientJwt,
        body: {
            allow: true,
            client_id: clientIdA,
            redirect_uri: 'http://127.0.0.1:9999/cb',
            scope: 'patient/*.read offline_access',
            state: 'xyz',
            code_challenge: challenge,
            code_challenge_method: 'S256',
        },
    });
    assert.equal(decision.status, 200, JSON.stringify(decision.body));
    const code = new URL(decision.body.data.redirectUrl).searchParams.get('code');

    const tokenRes = await call('POST', '/oauth/token', {
        body: { grant_type: 'authorization_code', code, redirect_uri: 'http://127.0.0.1:9999/cb', client_id: clientIdA, code_verifier: verifier },
    });
    assert.equal(tokenRes.status, 200, JSON.stringify(tokenRes.body));
    const refresh = tokenRes.body.refresh_token;

    // Client B presents Client A's refresh token to revoke — must not touch Client A's grant.
    const crossRevoke = await call('POST', '/oauth/revoke', { body: { token: refresh, client_id: clientIdB } });
    assert.equal(crossRevoke.status, 200);

    const stillGood = await call('POST', '/oauth/token', {
        body: { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientIdA },
    });
    assert.equal(stillGood.status, 200, 'a different client revoking by id must not have revoked this grant');

    // The owning client can actually revoke it.
    const ownRevoke = await call('POST', '/oauth/revoke', { body: { token: stillGood.body.refresh_token, client_id: clientIdA } });
    assert.equal(ownRevoke.status, 200);
    const nowDead = await call('POST', '/oauth/token', {
        body: { grant_type: 'refresh_token', refresh_token: stillGood.body.refresh_token, client_id: clientIdA },
    });
    assert.equal(nowDead.status, 400);
});
