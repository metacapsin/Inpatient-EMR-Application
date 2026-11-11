import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { boss, QUEUES } from '../db/queue.js';
import { deliverAdt } from '../lib/adtTransport.js';
import { buildAdtMessage } from '../lib/hl7Adt.js';
import { processAdtNotificationJob } from '../lib/adtNotify.js';

/** Recipient directory (admin) + delivery log / retry for CMS CoP ADT notifications (#65). */
export const adtNotificationsRouter = Router();
const admin = requireRole();
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

const recipientOut = (r) => ({
    id: r.id, _id: r.id, name: r.name, kind: r.kind, transport: r.transport, endpoint: r.endpoint ?? '',
    hasSecret: Boolean(r.auth_header_secret), enabled: r.enabled, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const recipientFields = {
    name: z.string().trim().min(1).max(200),
    kind: z.enum(['pcp', 'post_acute', 'hie', 'other']),
    transport: z.enum(['stub', 'https_webhook', 'mllp', 'email', 'direct']),
    endpoint: z.string().trim().max(500).optional().nullable(),
    authHeaderSecret: z.string().max(500).optional().nullable(),
    enabled: z.boolean().optional(),
};
const refineEndpoint = (b, ctx) => {
    if (b.transport === 'https_webhook' && !/^https?:\/\//.test(b.endpoint ?? '')) ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'Webhook transport needs an http(s) URL' });
    if (b.transport === 'mllp' && !/^(mllp:\/\/)?[^:/\s]+:\d+$/.test(b.endpoint ?? '')) ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'MLLP transport needs host:port' });
    if (b.transport === 'email' && !/^[^@\s]+@[^@\s]+$/.test(b.endpoint ?? '')) ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'Email transport needs an email address' });
};
// Zod v4: .partial() cannot be used on schemas with refinements — keep create vs patch separate.
const recipientBody = z.object(recipientFields).superRefine(refineEndpoint);
const recipientPatch = z.object({
    name: recipientFields.name.optional(),
    kind: recipientFields.kind.optional(),
    transport: recipientFields.transport.optional(),
    endpoint: recipientFields.endpoint,
    authHeaderSecret: recipientFields.authHeaderSecret,
    enabled: recipientFields.enabled,
}).superRefine((b, ctx) => {
    if (b.transport !== undefined) refineEndpoint(b, ctx);
});

adtNotificationsRouter.get('/api/notification-recipients', h(async (req, res) => {
    const r = await query('SELECT * FROM notification_recipients WHERE tenant_id = $1 ORDER BY kind, name', [req.user.tenantId]);
    ok(res, r.rows.map(recipientOut));
}));

adtNotificationsRouter.post('/api/notification-recipients', admin, h(async (req, res) => {
    const b = parse(recipientBody, req.body);
    const r = await query(
        `INSERT INTO notification_recipients (tenant_id, name, kind, transport, endpoint, auth_header_secret, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.tenantId, b.name, b.kind, b.transport, b.endpoint ?? null, b.authHeaderSecret || null, b.enabled ?? true],
    );
    created(res, recipientOut(r.rows[0]));
}));

adtNotificationsRouter.put('/api/notification-recipients/:id', admin, h(async (req, res) => {
    const b = parse(recipientPatch, req.body);
    const r = await query(
        `UPDATE notification_recipients SET name = COALESCE($1, name), kind = COALESCE($2, kind), transport = COALESCE($3, transport),
                endpoint = COALESCE($4, endpoint), auth_header_secret = CASE WHEN $5::text IS NULL THEN auth_header_secret WHEN $5 = '' THEN NULL ELSE $5 END,
                enabled = COALESCE($6, enabled), updated_at = now()
         WHERE id = $7 AND tenant_id = $8 RETURNING *`,
        [b.name ?? null, b.kind ?? null, b.transport ?? null, b.endpoint ?? null, b.authHeaderSecret ?? null, b.enabled ?? null, req.params.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Recipient not found');
    ok(res, recipientOut(r.rows[0]));
}));

adtNotificationsRouter.delete('/api/notification-recipients/:id', admin, h(async (req, res) => {
    const r = await query('DELETE FROM notification_recipients WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Recipient not found');
    res.json({ status: 'success', message: 'Recipient removed' });
}));

// POST /api/notification-recipients/:id/test — sends a sample A08 straight through the transport (not logged)
adtNotificationsRouter.post('/api/notification-recipients/:id/test', admin, h(async (req, res) => {
    const r = (await query('SELECT r.*, t.name AS tenant_name FROM notification_recipients r JOIN tenants t ON t.id = r.tenant_id WHERE r.id = $1 AND r.tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!r) throw notFound('Recipient not found');
    const message = buildAdtMessage({
        eventType: 'A08', sendingFacility: r.tenant_name, receivingApp: r.name,
        patient: { mrn: 'TEST000001', firstName: 'Test', lastName: 'Patient', dob: '1970-01-01', sex: 'U' },
        encounter: { id: 'TEST-ENCOUNTER', admittedAt: new Date(), admissionType: 'elective', diagnosis: 'Connectivity test' },
        location: { ward: 'Test Ward', room: '0', bed: '0' },
    });
    try {
        const d = await deliverAdt(r, message, { subject: 'ADT connectivity test' });
        ok(res, { ok: true, detail: d.detail, message });
    } catch (e) {
        ok(res, { ok: false, error: e.message, message });
    }
}));

const logOut = (l) => ({
    id: l.id, _id: l.id, encounterId: l.encounter_id, patientId: l.patient_id, patientName: l.patient_name ?? null, eventType: l.event_type,
    recipientId: l.recipient_id, recipientName: l.recipient_name ?? '', transport: l.transport, status: l.status, attempts: l.attempts,
    lastError: l.last_error ?? null, sentAt: iso(l.sent_at), createdAt: iso(l.created_at), message: l.message,
});

// GET /api/adt-notifications?encounterId=&patientId=&status=&limit=
adtNotificationsRouter.get('/api/adt-notifications', h(async (req, res) => {
    const q = parse(z.object({ encounterId: z.string().optional(), patientId: z.string().optional(), status: z.enum(['queued', 'sent', 'failed']).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    const params = [req.user.tenantId];
    let where = 'l.tenant_id = $1';
    if (q.encounterId) { params.push(q.encounterId); where += ` AND l.encounter_id = $${params.length}`; }
    if (q.patientId) { params.push(q.patientId); where += ` AND l.patient_id = $${params.length}`; }
    if (q.status) { params.push(q.status); where += ` AND l.status = $${params.length}`; }
    params.push(q.limit);
    const r = await query(`SELECT l.*, p.first_name || ' ' || p.last_name AS patient_name FROM adt_notification_log l LEFT JOIN patients p ON p.id = l.patient_id WHERE ${where} ORDER BY l.created_at DESC LIMIT $${params.length}`, params);
    ok(res, r.rows.map(logOut));
}));

// POST /api/adt-notifications/:id/retry — re-queue a failed delivery
adtNotificationsRouter.post('/api/adt-notifications/:id/retry', requireRole('physician', 'nurse', 'staff'), h(async (req, res) => {
    const l = (await query('SELECT * FROM adt_notification_log WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!l) throw notFound('Notification not found');
    if (l.status === 'sent') throw conflict('Notification was already delivered');
    await query(`UPDATE adt_notification_log SET status = 'queued', last_error = NULL WHERE id = $1`, [l.id]);
    await boss.send(QUEUES.ADT_NOTIFICATION, { encounterId: l.encounter_id, tenantId: l.tenant_id, patientId: l.patient_id, eventType: l.event_type, logIds: [l.id], retryOf: l.id }, { retryLimit: 5, retryBackoff: true });
    const row = (await query('SELECT * FROM adt_notification_log WHERE id = $1', [l.id])).rows[0];
    ok(res, logOut(row));
}));

// POST /api/adt-notifications/:id/deliver-now — synchronous delivery (used by the UI retry button and tests)
adtNotificationsRouter.post('/api/adt-notifications/:id/deliver-now', requireRole('physician', 'nurse', 'staff'), h(async (req, res) => {
    const l = (await query('SELECT * FROM adt_notification_log WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rows[0];
    if (!l) throw notFound('Notification not found');
    if (l.status === 'sent') throw conflict('Notification was already delivered');
    try { await processAdtNotificationJob({ logIds: [l.id] }); } catch { /* row status carries the outcome */ }
    const row = (await query('SELECT * FROM adt_notification_log WHERE id = $1', [l.id])).rows[0];
    ok(res, logOut(row));
}));
