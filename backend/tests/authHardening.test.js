// Authentication / session hardening (#SEC-07, 08, 09, 13, 19, 20, 21): lockout, opt-in TOTP MFA,
// immediate token revocation via token_version, logout-all, dev-token gating, and the removed
// X-Client-Route header.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { generateTotpCode } from '../src/lib/totp.js';

let server;
let base;
const tenantIds = [];
const suffix = `authhard${Date.now().toString(36)}`;

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    for (const id of tenantIds) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    await new Promise((r) => server.close(r));
    await pool.end();
});

function extractCookie(res) {
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    const refreshCookie = setCookie.find((c) => c.startsWith('refreshToken='));
    if (!refreshCookie) return undefined;
    return /refreshToken=;/.test(refreshCookie) ? null : refreshCookie.split(';')[0];
}

async function call(method, path, { body, token, jar } = {}) {
    const res = await fetch(base + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(jar?.cookie ? { Cookie: jar.cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (jar) {
        const c = extractCookie(res);
        if (c !== undefined) jar.cookie = c;
    }
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json, raw: res };
}

async function newTenant(label) {
    const email = `${label}-${suffix}@test.example`;
    const password = 'Test-passw0rd!';
    const r = await call('POST', '/auth/register', { body: { username: `${label}${suffix}`, email, password, organization: `Org ${label}` } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    tenantIds.push(r.body.user.tenant.id);
    return { ...r.body, email, password };
}

test('auth hardening: 5 failed logins lock the account; the correct password is rejected while locked', async () => {
    const t = await newTenant('lock');
    for (let i = 0; i < 4; i++) {
        const bad = await call('POST', '/login', { body: { username: t.email, password: 'wrong-one' } });
        assert.equal(bad.status, 401);
    }
    const fifth = await call('POST', '/login', { body: { username: t.email, password: 'wrong-one' } });
    assert.equal(fifth.status, 423);
    assert.equal(fifth.body.code, 'ACCOUNT_LOCKED');

    // Correct password is still rejected while locked.
    const stillLocked = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    assert.equal(stillLocked.status, 423);

    const row = (await pool.query('SELECT failed_login_count, locked_until FROM users WHERE id = $1', [t.user.id])).rows[0];
    assert.equal(row.failed_login_count, 0, 'the counter resets once it trips the lock');
    assert.ok(new Date(row.locked_until) > new Date());
});

test('auth hardening: opt-in TOTP MFA — enroll, confirm, login challenge, backup code is single-use', async () => {
    const t = await newTenant('mfa');

    const badEnrollConfirm = await call('POST', '/auth/mfa/confirm', { token: t.token, body: { code: '000000' } });
    assert.equal(badEnrollConfirm.status, 400, 'cannot confirm before enrolling');

    const enroll = await call('POST', '/auth/mfa/enroll', { token: t.token });
    assert.equal(enroll.status, 200, JSON.stringify(enroll.body));
    const secret = enroll.body.data.secret;
    assert.ok(enroll.body.data.otpauthUri.startsWith('otpauth://totp/'));

    const wrongConfirm = await call('POST', '/auth/mfa/confirm', { token: t.token, body: { code: '000000' } });
    assert.equal(wrongConfirm.status, 401);

    const confirm = await call('POST', '/auth/mfa/confirm', { token: t.token, body: { code: generateTotpCode(secret) } });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    const backupCodes = confirm.body.data.backupCodes;
    assert.equal(backupCodes.length, 10);

    // Login now stops short of issuing tokens and asks for the second factor.
    const login = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.status, 'mfa_required');
    assert.ok(login.body.mfaToken);

    const wrongVerify = await call('POST', '/auth/mfa/verify', { body: { mfaToken: login.body.mfaToken, code: '000000' } });
    assert.equal(wrongVerify.status, 401);

    const verify = await call('POST', '/auth/mfa/verify', { body: { mfaToken: login.body.mfaToken, code: generateTotpCode(secret) } });
    assert.equal(verify.status, 200, JSON.stringify(verify.body));
    assert.ok(verify.body.token);

    // A backup code works once...
    const login2 = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    const backupVerify = await call('POST', '/auth/mfa/verify', { body: { mfaToken: login2.body.mfaToken, backupCode: backupCodes[0] } });
    assert.equal(backupVerify.status, 200, JSON.stringify(backupVerify.body));

    // ...and never again.
    const login3 = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    const reuseBackup = await call('POST', '/auth/mfa/verify', { body: { mfaToken: login3.body.mfaToken, backupCode: backupCodes[0] } });
    assert.equal(reuseBackup.status, 401);

    // Disabling MFA requires the password and turns login back to normal.
    const disable = await call('POST', '/auth/mfa/disable', { token: verify.body.token, body: { password: t.password } });
    assert.equal(disable.status, 200, JSON.stringify(disable.body));
    const loginAfterDisable = await call('POST', '/login', { body: { username: t.email, password: t.password } });
    assert.equal(loginAfterDisable.body.status, 'success');
});

test('auth hardening: deactivation invalidates an already-issued, unexpired access token immediately', async () => {
    const admin = await newTenant('deact');
    const email = `nurse-${suffix}@test.example`;
    const mk = await call('POST', '/auth/register-user', { token: admin.token, body: { email, password: 'Nurse-passw0rd1', role: 'nurse', firstName: 'N' } });
    assert.equal(mk.status, 201, JSON.stringify(mk.body));
    const nurseLogin = await call('POST', '/login', { body: { username: email, password: 'Nurse-passw0rd1' } });
    assert.equal(nurseLogin.status, 200);
    const nurseToken = nurseLogin.body.token;

    // The token is still unexpired — before deactivation it works.
    assert.equal((await call('GET', '/auth/profile', { token: nurseToken })).status, 200);

    const deactivate = await call('PUT', `/auth/users/${mk.body.data.id}`, { token: admin.token, body: { isActive: false } });
    assert.equal(deactivate.status, 200, JSON.stringify(deactivate.body));

    // Same still-unexpired token, immediately rejected — not just at its natural expiry.
    assert.equal((await call('GET', '/auth/profile', { token: nurseToken })).status, 401);
});

test('auth hardening: a role change bumps token_version and invalidates the old token', async () => {
    const admin = await newTenant('rolechg');
    const email = `nurse2-${suffix}@test.example`;
    const mk = await call('POST', '/auth/register-user', { token: admin.token, body: { email, password: 'Nurse-passw0rd2', role: 'nurse', firstName: 'N' } });
    const nurseLogin = await call('POST', '/login', { body: { username: email, password: 'Nurse-passw0rd2' } });
    const nurseToken = nurseLogin.body.token;
    assert.equal((await call('GET', '/auth/profile', { token: nurseToken })).status, 200);

    const promote = await call('PUT', `/auth/users/${mk.body.data.id}`, { token: admin.token, body: { role: 'physician' } });
    assert.equal(promote.status, 200, JSON.stringify(promote.body));

    assert.equal((await call('GET', '/auth/profile', { token: nurseToken })).status, 401);
});

test('auth hardening: logout-all revokes every refresh token and bumps token_version', async () => {
    const jarA = {};
    const jarB = {};
    const t = await newTenant('logoutall');
    const loginA = await call('POST', '/login', { body: { username: t.email, password: t.password }, jar: jarA });
    const loginB = await call('POST', '/login', { body: { username: t.email, password: t.password }, jar: jarB });
    assert.ok(jarA.cookie && jarB.cookie);

    const all = await call('POST', '/auth/logout-all', { token: loginA.body.token });
    assert.equal(all.status, 200, JSON.stringify(all.body));

    // Both refresh cookies are now dead...
    assert.equal((await call('POST', '/auth/refresh', { jar: jarA })).status, 401);
    assert.equal((await call('POST', '/auth/refresh', { jar: jarB })).status, 401);
    // ...and so is the still-unexpired access token used to call logout-all itself.
    assert.equal((await call('GET', '/auth/profile', { token: loginA.body.token })).status, 401);
});

test('auth hardening: dev-only tokens are gated on ALLOW_DEV_TOKENS, not NODE_ENV', async () => {
    const t = await newTenant('devtok');
    const patient = (
        await call('POST', '/Patient/createPatient', { token: t.token, body: { firstName: 'Dev', lastName: 'Tok', dOB: '1990-01-01', sex: 'F' } })
    ).body.data;
    // Portal invites always use the patient's email on file now (SEC-06) — no caller-supplied override.
    await pool.query(`UPDATE patients SET email = $1 WHERE id = $2`, [`patient-devtok-${suffix}@test.example`, patient.id]);

    process.env.ALLOW_DEV_TOKENS = 'false';
    try {
        const invite = await call('POST', `/api/patients/${patient.id}/portal-invite`, { token: t.token, body: {} });
        assert.equal(invite.status, 200, JSON.stringify(invite.body));
        assert.equal(invite.body.data.inviteToken, undefined, 'inviteToken must not leak when ALLOW_DEV_TOKENS=false');
    } finally {
        delete process.env.ALLOW_DEV_TOKENS;
    }
});

test('auth hardening: X-Client-Route is no longer an allowed CORS header', async () => {
    const res = await fetch(`${base}/login`, {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        },
    });
    const allowed = res.headers.get('access-control-allow-headers') || '';
    assert.ok(!allowed.toLowerCase().includes('x-client-route'));
});

test('auth hardening: PLATFORM_JWT_SECRET/SMART_JWT_SECRET are required when NODE_ENV=production (SEC-13)', () => {
    const script = `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'x'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/doesnotmatter';
        delete process.env.PLATFORM_JWT_SECRET;
        delete process.env.SMART_JWT_SECRET;
        import('./src/config.js').then(() => {
            console.log('DID_NOT_THROW');
        }).catch((e) => {
            console.log('THREW:' + e.message);
        });
    `;
    const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: backendRoot,
        env: { ...process.env },
        encoding: 'utf8',
    });
    assert.match(out, /THREW:.*PLATFORM_JWT_SECRET/);
});
