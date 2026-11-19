// AI assistant routes: server-side Gemini proxy, role gate, validation, audit rows, tenant isolation.
// The Gemini HTTP call is never made here: NODE_ENV=test disables the provider (503 AI_DISABLED)
// unless the test installs a stub responder.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { __setGeminiStubForTests } from '../src/lib/gemini.js';

let server;
let base;
const tenantIds = [];
const suffix = `ai${Date.now().toString(36)}`;

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    __setGeminiStubForTests(null);
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
    return { token: r.body.token, tenantId: r.body.user.tenant.id, userId: r.body.user.id };
}

async function addUser(adminToken, role) {
    const email = `${role}-${suffix}@test.example`;
    const mk = await call('POST', '/auth/register-user', { token: adminToken, body: { email, password: 'Staff-passw0rd', role, firstName: role, lastName: 'User' } });
    assert.equal(mk.status, 201, JSON.stringify(mk.body));
    const login = await call('POST', '/login', { body: { username: email, password: 'Staff-passw0rd' } });
    assert.equal(login.status, 200);
    return login.body.token;
}

test('AI assistant: disabled by default, role gate, validation, stubbed provider, audit row, tenant isolation', async () => {
    const t = await newTenant('aiA');
    const physician = await addUser(t.token, 'physician');
    const billing = await addUser(t.token, 'billing');

    // migration 022 turned the module on for every tenant (incl. newly registered ones via default)
    const status = await call('GET', '/api/ai/status', { token: physician });
    assert.equal(status.status, 200);
    assert.equal(status.body.data.enabled, false, 'provider is disabled under NODE_ENV=test');

    // disabled provider → 503 with a stable code, and an audit row is still written
    const med = { genericName: 'Lisinopril', strength: '10 mg', route: 'PO', frequency: 'Daily' };
    const disabled = await call('POST', '/api/ai/medication-explanation', { token: physician, body: med });
    assert.equal(disabled.status, 503);
    assert.equal(disabled.body.code, 'AI_DISABLED');

    // billing role cannot use AI
    assert.equal((await call('POST', '/api/ai/medication-explanation', { token: billing, body: med })).status, 403);
    // validation
    assert.equal((await call('POST', '/api/ai/medication-explanation', { token: physician, body: {} })).status, 400);
    assert.equal((await call('POST', '/api/ai/chatbot', { token: physician, body: { query: 'hi' } })).status, 400);

    // stub the provider and exercise the happy paths
    const prompts = [];
    __setGeminiStubForTests(async (opts) => {
        prompts.push(opts);
        if (opts.json) {
            return '```json\n' + JSON.stringify({ medicationName: 'Lisinopril', medicationType: 'ACE inhibitor', usedFor: ['High blood pressure'], howItWorks: 'Relaxes blood vessels.', howToTake: { dose: '10 mg', route: 'By mouth', duration: 'Ongoing', instructions: ['Take once daily'] }, importantPrecautions: ['Tell your doctor if pregnant'], commonSideEffects: ['Dizziness'], seriousSideEffects: ['Swelling of face'], whenToContactDoctor: ['Swelling'], additionalNotes: '' }) + '\n```';
        }
        return 'The chart lists lisinopril 10 mg daily and an active penicillin allergy.';
    });

    const ex = await call('POST', '/api/ai/medication-explanation', { token: physician, body: med });
    assert.equal(ex.status, 200, JSON.stringify(ex.body));
    assert.equal(ex.body.data.medicationName, 'Lisinopril');
    assert.equal(ex.body.data.howToTake.instructions[0], 'Take once daily');
    assert.ok(ex.body.data.disclaimer.includes('AI-generated'));
    assert.ok(prompts[0].user.includes('Lisinopril') && !prompts[0].user.includes('@test.example'), 'prompt carries medication facts only');

    // chatbot needs a patient in this tenant; context must not include identity fields
    const p = (await call('POST', '/Patient/createPatient', { token: physician, body: { firstName: 'Ai', lastName: 'Context', dOB: '1950-01-01', sex: 'F', email: `ai-ctx-${suffix}@test.example` } })).body.data;
    await call('POST', '/Patient/createAllergy', { token: physician, body: { patientId: p.id, allergyName: 'Penicillin', reaction: 'Rash', severity: 'Severe', onsetDate: '2020-02-03' } });
    await call('POST', `/api/patients/${p.id}/medications`, { token: physician, body: { name: 'Lisinopril', dose: '10 mg', route: 'PO', frequency: 'Daily' } });

    const chat = await call('POST', '/api/ai/chatbot', { token: physician, body: { patientId: p.id, query: 'What allergies are documented?', history: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }] } });
    assert.equal(chat.status, 200, JSON.stringify(chat.body));
    assert.equal(chat.body.message.role, 'assistant');
    assert.ok(chat.body.content.includes('penicillin'));
    const chatPrompt = prompts[1].user;
    assert.ok(chatPrompt.includes('Penicillin') && chatPrompt.includes('Lisinopril'), 'context includes clinical facts');
    assert.ok(!chatPrompt.includes('Context') && !chatPrompt.includes('@test.example') && !chatPrompt.includes(p.mrn), 'context excludes name, email and MRN');
    assert.equal(prompts[1].history.length, 2);

    // audit rows: 1 disabled error + 2 ok; no prompt text persisted
    const rows = (await pool.query('SELECT endpoint, status, error_code, patient_id FROM ai_requests WHERE tenant_id=$1 ORDER BY created_at', [t.tenantId])).rows;
    assert.deepEqual(rows.map((r) => [r.endpoint, r.status, r.error_code]), [
        ['medication-explanation', 'error', 'AI_DISABLED'],
        ['medication-explanation', 'ok', null],
        ['chatbot', 'ok', null],
    ]);
    assert.equal(rows[2].patient_id, p.id);
    const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_requests'`)).rows.map((r) => r.column_name);
    assert.ok(!cols.some((c) => /prompt_text|response/.test(c)));

    // tenant isolation: another tenant's physician cannot build context for this patient
    const other = await newTenant('aiB');
    const foreign = await call('POST', '/api/ai/chatbot', { token: other.token, body: { patientId: p.id, query: 'anything' } });
    assert.equal(foreign.status, 404);

    // module gate: disabling 'ai' blocks the routes
    await pool.query(`UPDATE tenants SET enabled_modules = enabled_modules - 'ai' WHERE id = $1`, [t.tenantId]);
    assert.equal((await call('GET', '/api/ai/status', { token: physician })).status, 403);
});
