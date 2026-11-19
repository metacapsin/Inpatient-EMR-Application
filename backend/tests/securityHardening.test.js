// Security hardening (#SEC-12, 18, 22): webhook secrets encrypted at rest, https-only webhooks,
// plaintext MLLP gated behind an explicit flag, soft-deleted documents, upload mime allowlist +
// magic-bytes check, and config-level checks for DB TLS / ENCRYPTION_KEY in production.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { encryptSecret, decryptSecret, looksEncrypted } from '../src/lib/crypto.js';

let server;
let base;
const tenantIds = [];
const suffix = `sh${Date.now().toString(36)}`;

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    for (const id of tenantIds) await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    await new Promise((r) => server.close(r));
    await pool.end();
});

async function call(method, path_, { body, token } = {}) {
    const res = await fetch(base + path_, {
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

async function createPatient(token, label) {
    const r = await call('POST', '/Patient/createPatient', { token, body: { firstName: label, lastName: 'Security', dOB: '1990-01-01', sex: 'F' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data;
}

// ------------------------------------------------------------------------------------------ crypto
test('lib/crypto: encrypt/decrypt round-trips and rejects a tampered value', () => {
    const enc = encryptSecret('Bearer my-secret-token');
    assert.ok(looksEncrypted(enc));
    assert.equal(decryptSecret(enc), 'Bearer my-secret-token');
    assert.equal(looksEncrypted('Bearer plain-legacy-value'), false);

    const [iv, tag, ct] = enc.split(':');
    const tampered = [iv, tag, Buffer.from('tampered').toString('base64')].join(':');
    assert.throws(() => decryptSecret(tampered));
});

// -------------------------------------------------------------------------------------------- 12
test('notification recipient: auth_header_secret is encrypted at rest and never echoed back', async () => {
    const t = await newTenant('secretRest');
    const created = await call('POST', '/api/notification-recipients', {
        token: t.token,
        body: { name: 'Vendor', kind: 'hie', transport: 'stub', authHeaderSecret: 'Bearer sensitive-value' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.hasSecret, true);
    assert.equal('authHeaderSecret' in created.body.data, false);

    const row = (await pool.query('SELECT auth_header_secret FROM notification_recipients WHERE id = $1', [created.body.data.id])).rows[0];
    assert.notEqual(row.auth_header_secret, 'Bearer sensitive-value');
    assert.ok(looksEncrypted(row.auth_header_secret));
    assert.equal(decryptSecret(row.auth_header_secret), 'Bearer sensitive-value');

    // Re-saving via PUT re-encrypts the new value; clearing it with '' sets it to NULL.
    const updated = await call('PUT', `/api/notification-recipients/${created.body.data.id}`, {
        token: t.token,
        body: { authHeaderSecret: 'Bearer rotated-value' },
    });
    assert.equal(updated.status, 200);
    const row2 = (await pool.query('SELECT auth_header_secret FROM notification_recipients WHERE id = $1', [created.body.data.id])).rows[0];
    assert.equal(decryptSecret(row2.auth_header_secret), 'Bearer rotated-value');

    const cleared = await call('PUT', `/api/notification-recipients/${created.body.data.id}`, { token: t.token, body: { authHeaderSecret: '' } });
    assert.equal(cleared.body.data.hasSecret, false);
});

test('notification recipient: http:// webhook endpoint is rejected; https:// is accepted', async () => {
    const t = await newTenant('httpsOnly');
    const httpAttempt = await call('POST', '/api/notification-recipients', {
        token: t.token,
        body: { name: 'Plain HTTP', kind: 'hie', transport: 'https_webhook', endpoint: 'http://example.test/adt' },
    });
    assert.equal(httpAttempt.status, 400, JSON.stringify(httpAttempt.body));

    const httpsOk = await call('POST', '/api/notification-recipients', {
        token: t.token,
        body: { name: 'Plain HTTPS', kind: 'hie', transport: 'https_webhook', endpoint: 'https://example.test/adt' },
    });
    assert.equal(httpsOk.status, 201, JSON.stringify(httpsOk.body));
});

test('notification recipient: plaintext MLLP is rejected unless ALLOW_PLAINTEXT_MLLP=true; mllps:// always attempts TLS', async () => {
    const t = await newTenant('mllpGate');
    const recipient = await call('POST', '/api/notification-recipients', {
        token: t.token,
        body: { name: 'Interface Engine', kind: 'hie', transport: 'mllp', endpoint: 'mllp://127.0.0.1:1' },
    });
    assert.equal(recipient.status, 201, JSON.stringify(recipient.body));

    delete process.env.ALLOW_PLAINTEXT_MLLP;
    const blocked = await call('POST', `/api/notification-recipients/${recipient.body.data.id}/test`, { token: t.token });
    assert.equal(blocked.body.data.ok, false);
    assert.match(blocked.body.data.error, /Plaintext MLLP is disabled/);

    process.env.ALLOW_PLAINTEXT_MLLP = 'true';
    try {
        // Port 1 isn't listening, so this still fails — but with a connection error, not the gate.
        const allowedButUnreachable = await call('POST', `/api/notification-recipients/${recipient.body.data.id}/test`, { token: t.token });
        assert.equal(allowedButUnreachable.body.data.ok, false);
        assert.doesNotMatch(allowedButUnreachable.body.data.error, /Plaintext MLLP is disabled/);
    } finally {
        delete process.env.ALLOW_PLAINTEXT_MLLP;
    }

    const tlsRecipient = await call('POST', '/api/notification-recipients', {
        token: t.token,
        body: { name: 'TLS Interface Engine', kind: 'hie', transport: 'mllp', endpoint: 'mllps://127.0.0.1:1' },
    });
    const tlsAttempt = await call('POST', `/api/notification-recipients/${tlsRecipient.body.data.id}/test`, { token: t.token });
    // Never the plaintext-disabled message — mllps:// is exempt from that gate by design.
    assert.doesNotMatch(tlsAttempt.body.data.error, /Plaintext MLLP is disabled/);
});

// -------------------------------------------------------------------------------------------- 18
test('documents: delete is a soft delete — the row survives but reads/downloads treat it as gone', async () => {
    const t = await newTenant('softDelete');
    const patient = await createPatient(t.token, 'SoftDelete');
    const bytes = Buffer.from('%PDF-1.4 soft-delete-test');
    const doc = await call('POST', '/Patient/uploadDocument', {
        token: t.token,
        body: { patientId: patient.id, name: 'note.pdf', contentBase64: `data:application/pdf;base64,${bytes.toString('base64')}` },
    });
    assert.equal(doc.status, 201, JSON.stringify(doc.body));

    const del = await call('DELETE', `/Patient/deleteDocumentById/${doc.body.data.id}`, { token: t.token });
    assert.equal(del.status, 200);

    assert.equal((await call('GET', `/Patient/getDocumentById/${doc.body.data.id}`, { token: t.token })).status, 404);
    assert.equal((await call('GET', `/Patient/downloadDocument/${doc.body.data.id}`, { token: t.token })).status, 404);
    assert.equal((await call('GET', `/Patient/getAllDocument/${patient.id}`, { token: t.token })).body.data.length, 0);

    const row = (await pool.query('SELECT deleted_at, deleted_by, content IS NOT NULL AS has_content FROM patient_documents WHERE id = $1', [doc.body.data.id])).rows[0];
    assert.ok(row, 'the row must still exist after a soft delete');
    assert.ok(row.deleted_at);
    assert.equal(row.has_content, true, 'content is retained, not purged');
});

test('documents: upload rejects a disallowed mime type and a magic-bytes mismatch', async () => {
    const t = await newTenant('mimeCheck');
    const patient = await createPatient(t.token, 'MimeCheck');

    const disallowed = await call('POST', '/Patient/uploadDocument', {
        token: t.token,
        body: { patientId: patient.id, name: 'app.exe', contentBase64: `data:application/x-msdownload;base64,${Buffer.from('MZ fake exe').toString('base64')}` },
    });
    assert.equal(disallowed.status, 400, JSON.stringify(disallowed.body));
    assert.match(disallowed.body.message, /Unsupported document type/);

    const mismatch = await call('POST', '/Patient/uploadDocument', {
        token: t.token,
        body: { patientId: patient.id, name: 'fake.pdf', contentBase64: `data:application/pdf;base64,${Buffer.from('not actually a pdf').toString('base64')}` },
    });
    assert.equal(mismatch.status, 400, JSON.stringify(mismatch.body));
    assert.match(mismatch.body.message, /doesn't look like/);
});

test("documents: a data: URL's embedded mime type is what gets validated, not a separate declared field", async () => {
    const t = await newTenant('mimeOverride');
    const patient = await createPatient(t.token, 'MimeOverride');
    // Declares mimeType: application/pdf (allowed) but the data: URL itself says a disallowed type —
    // the resolved (data: URL) mime is what must pass the allowlist, closing the override bypass.
    const r = await call('POST', '/Patient/uploadDocument', {
        token: t.token,
        body: {
            patientId: patient.id,
            name: 'sneaky.exe',
            mimeType: 'application/pdf',
            contentBase64: `data:application/x-msdownload;base64,${Buffer.from('MZ fake exe').toString('base64')}`,
        },
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.message, /Unsupported document type 'application\/x-msdownload'/);
});

// -------------------------------------------------------------------------------------------- config
test('config: ENCRYPTION_KEY is required when NODE_ENV=production', () => {
    const script = `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'x'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/doesnotmatter';
        process.env.PLATFORM_JWT_SECRET = 'p'.repeat(32);
        process.env.SMART_JWT_SECRET = 's'.repeat(32);
        process.env.BACKEND_URL = 'https://api.example.com';
        delete process.env.ENCRYPTION_KEY;
        import('./src/config.js').then(() => {
            console.log('DID_NOT_THROW');
        }).catch((e) => {
            console.log('THREW:' + e.message);
        });
    `;
    const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: backendRoot, env: { ...process.env }, encoding: 'utf8' });
    assert.match(out, /THREW:.*ENCRYPTION_KEY/);
});

test('config: DATABASE_SSL defaults to required in production and can be explicitly disabled', () => {
    const script = (dbSsl) => `
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'x'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
        process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/doesnotmatter';
        process.env.PLATFORM_JWT_SECRET = 'p'.repeat(32);
        process.env.SMART_JWT_SECRET = 's'.repeat(32);
        process.env.BACKEND_URL = 'https://api.example.com';
        process.env.ENCRYPTION_KEY = '${'a'.repeat(64)}';
        ${dbSsl ? `process.env.DATABASE_SSL = '${dbSsl}';` : "delete process.env.DATABASE_SSL;"}
        import('./src/config.js').then(({ config }) => {
            console.log('SSL:' + JSON.stringify(config.databaseSsl));
        });
    `;
    const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const defaultOut = execFileSync(process.execPath, ['--input-type=module', '-e', script(null)], { cwd: backendRoot, env: { ...process.env }, encoding: 'utf8' });
    assert.match(defaultOut, /SSL:\{"rejectUnauthorized":true\}/);

    const disabledOut = execFileSync(process.execPath, ['--input-type=module', '-e', script('disable')], { cwd: backendRoot, env: { ...process.env }, encoding: 'utf8' });
    assert.match(disabledOut, /SSL:false/);
});
