// Transfer / bed-request queue. Replaces dashboard.js's hardcoded `transferRequests: []`.
// Priority is a manually entered field, deliberately NOT an acuity score (see the build plan's out-of-scope list).
import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, created, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { iso, performTransfer } from '../lib/bedManagement.js';

export const transferRequestsRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

export const TRANSFER_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_RANK = `CASE tr.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

const TR_SELECT = `
    SELECT tr.*, p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
           e.bed_id AS current_bed_id, e.status AS encounter_status,
           cb.label AS current_bed_label, cr.room_number AS current_room_number, cw.name AS current_ward_name,
           w.name AS requested_ward_name,
           u.first_name || ' ' || u.last_name AS requested_by_name,
           fb.label AS fulfilled_bed_label
    FROM transfer_requests tr
    JOIN patients p ON p.id = tr.patient_id
    JOIN encounters e ON e.id = tr.encounter_id
    LEFT JOIN beds cb ON cb.id = e.bed_id
    LEFT JOIN rooms cr ON cr.id = cb.room_id
    LEFT JOIN wards cw ON cw.id = cr.ward_id
    LEFT JOIN wards w ON w.id = tr.requested_ward_id
    LEFT JOIN users u ON u.id = tr.requested_by
    LEFT JOIN beds fb ON fb.id = tr.fulfilled_bed_id`;

const requestOut = (x) => ({
    id: x.id,
    _id: x.id,
    patientId: x.patient_id,
    patientName: x.patient_name?.trim() || '',
    mrn: x.mrn,
    encounterId: x.encounter_id,
    encounterStatus: x.encounter_status,
    currentBedId: x.current_bed_id,
    currentLocation: [x.current_ward_name, x.current_room_number, x.current_bed_label].filter(Boolean).join(' · ') || null,
    requestedWardId: x.requested_ward_id,
    requestedWardName: x.requested_ward_name ?? null,
    requestedBy: x.requested_by,
    requestedByName: x.requested_by_name?.trim() || null,
    requestedAt: iso(x.requested_at),
    priority: x.priority,
    reason: x.reason,
    status: x.status,
    fulfilledBedId: x.fulfilled_bed_id,
    fulfilledBedLabel: x.fulfilled_bed_label ?? null,
    resolvedAt: iso(x.resolved_at),
});

async function loadRequest(db, id, tenantId) {
    const r = await db.query(`${TR_SELECT} WHERE tr.id = $1 AND tr.tenant_id = $2`, [id, tenantId]);
    if (!r.rowCount) throw notFound('Transfer request not found');
    return r.rows[0];
}

// GET /api/transfer-requests?status=open|fulfilled|cancelled|all&wardId=
transferRequestsRouter.get('/api/transfer-requests', h(async (req, res) => {
    const params = [req.user.tenantId];
    const where = ['tr.tenant_id = $1'];
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'open';
    if (status && status !== 'all') { params.push(status); where.push(`tr.status = $${params.length}`); }
    if (typeof req.query.wardId === 'string' && req.query.wardId) { params.push(req.query.wardId); where.push(`tr.requested_ward_id = $${params.length}`); }
    const r = await query(`${TR_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${PRIORITY_RANK}, tr.requested_at ASC LIMIT 500`, params);
    ok(res, r.rows.map(requestOut));
}));

// POST /api/transfer-requests { patientId | encounterId, requestedWardId?, priority, reason? }
transferRequestsRouter.post('/api/transfer-requests', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().trim().min(1).optional(),
            encounterId: z.string().trim().min(1).optional(),
            requestedWardId: z.string().trim().min(1).optional(),
            priority: z.enum(TRANSFER_PRIORITIES).default('medium'),
            reason: z.string().trim().max(1000).optional(),
        }),
        req.body,
    );
    if (!b.patientId && !b.encounterId) throw badRequest('patientId or encounterId is required');
    const tenantId = req.user.tenantId;
    const row = await withTx(async (db) => {
        const enc = (
            await db.query(
                `SELECT * FROM encounters WHERE tenant_id = $1 AND status <> 'discharged' AND (id = $2 OR ($2 IS NULL AND patient_id = $3)) ORDER BY admitted_at DESC LIMIT 1`,
                [tenantId, b.encounterId ?? null, b.patientId ?? null],
            )
        ).rows[0];
        if (!enc) throw notFound('No active encounter found for this patient');
        if (b.patientId && enc.patient_id !== b.patientId) throw badRequest('encounterId does not belong to patientId');
        if (b.requestedWardId) {
            const w = await db.query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.requestedWardId, tenantId]);
            if (!w.rowCount) throw notFound('Requested ward not found');
        }
        const dup = await db.query(`SELECT id FROM transfer_requests WHERE encounter_id = $1 AND status = 'open'`, [enc.id]);
        if (dup.rowCount) throw conflict('This patient already has an open transfer request');
        const ins = await db.query(
            `INSERT INTO transfer_requests (tenant_id, patient_id, encounter_id, requested_ward_id, requested_by, priority, reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [tenantId, enc.patient_id, enc.id, b.requestedWardId ?? null, req.user.id, b.priority, b.reason ?? null],
        );
        return loadRequest(db, ins.rows[0].id, tenantId);
    });
    created(res, requestOut(row), { message: 'Transfer request created' });
}));

// PUT /api/transfer-requests/:id { priority?, requestedWardId?, reason? }
transferRequestsRouter.put('/api/transfer-requests/:id', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            priority: z.enum(TRANSFER_PRIORITIES).optional(),
            requestedWardId: z.string().trim().min(1).nullable().optional(),
            reason: z.string().trim().max(1000).nullable().optional(),
        }),
        req.body,
    );
    if (b.requestedWardId) {
        const w = await query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.requestedWardId, req.user.tenantId]);
        if (!w.rowCount) throw notFound('Requested ward not found');
    }
    const r = await query(
        `UPDATE transfer_requests SET priority = COALESCE($1, priority),
                requested_ward_id = CASE WHEN $2::boolean THEN $3 ELSE requested_ward_id END,
                reason = CASE WHEN $4::boolean THEN $5 ELSE reason END
         WHERE id = $6 AND tenant_id = $7 AND status = 'open' RETURNING id`,
        [b.priority ?? null, b.requestedWardId !== undefined, b.requestedWardId ?? null, b.reason !== undefined, b.reason ?? null, req.params.id, req.user.tenantId],
    );
    if (!r.rowCount) {
        await loadRequest({ query }, req.params.id, req.user.tenantId);
        throw conflict('Only an open transfer request can be edited');
    }
    ok(res, requestOut(await loadRequest({ query }, req.params.id, req.user.tenantId)));
}));

// POST /api/transfer-requests/:id/cancel
transferRequestsRouter.post('/api/transfer-requests/:id/cancel', clinical, h(async (req, res) => {
    const r = await query(
        `UPDATE transfer_requests SET status = 'cancelled', resolved_at = now(), resolved_by = $3 WHERE id = $1 AND tenant_id = $2 AND status = 'open' RETURNING id`,
        [req.params.id, req.user.tenantId, req.user.id],
    );
    if (!r.rowCount) {
        await loadRequest({ query }, req.params.id, req.user.tenantId);
        throw conflict('Transfer request is no longer open');
    }
    ok(res, requestOut(await loadRequest({ query }, req.params.id, req.user.tenantId)), { message: 'Transfer request cancelled' });
}));

// POST /api/transfer-requests/:id/fulfill { bedId, reason? } — performs the ADT transfer and closes the request.
transferRequestsRouter.post('/api/transfer-requests/:id/fulfill', clinical, h(async (req, res) => {
    const b = parse(z.object({ bedId: z.string().min(1), reason: z.string().trim().max(1000).optional() }), req.body);
    const tenantId = req.user.tenantId;
    const out = await withTx(async (db) => {
        const lock = await db.query('SELECT * FROM transfer_requests WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, tenantId]);
        if (!lock.rowCount) throw notFound('Transfer request not found');
        const tr = lock.rows[0];
        if (tr.status !== 'open') throw conflict('Transfer request is no longer open');
        const transfer = await performTransfer(db, {
            tenantId,
            userId: req.user.id,
            encounterId: tr.encounter_id,
            newBedId: b.bedId,
            transferType: 'bed-request',
            reason: b.reason ?? tr.reason ?? null,
        });
        // performTransfer auto-fulfils when the ward matches; make it explicit in case a different ward was chosen.
        await db.query(
            `UPDATE transfer_requests SET status = 'fulfilled', fulfilled_bed_id = $1, resolved_at = now(), resolved_by = $2 WHERE id = $3 AND status = 'open'`,
            [b.bedId, req.user.id, tr.id],
        );
        return { request: requestOut(await loadRequest(db, tr.id, tenantId)), encounterId: transfer.encounterId, currentBedId: transfer.currentBedId, transfer: transfer.transfer };
    });
    ok(res, out, { message: 'Transfer request fulfilled' });
}));
