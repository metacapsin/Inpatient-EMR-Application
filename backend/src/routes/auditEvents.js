import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { h, ok, parse, rows } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { requirePlatformAuth } from '../middleware/platformAuth.js';

export const auditEventsRouter = Router();
// Separate router: platform-admin requests never pass through the tenant-scoped requireAuth, so
// this must be mounted alongside platformAdminRouter (before requireAuth), not in the post-auth list.
export const platformAuditEventsRouter = Router();

const admins = requireRole('admin');

const filterSchema = z.object({
    patientId: z.string().trim().min(1).optional(),
    actorId: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    resource: z.string().trim().min(1).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    skip: z.coerce.number().int().min(0).default(0),
});

/** Builds `WHERE tenant_id = $1 AND ...` plus the matching params array for the filters above. */
function buildWhere(f, tenantId) {
    const clauses = ['tenant_id = $1'];
    const params = [tenantId];
    if (f.patientId) {
        params.push(f.patientId);
        clauses.push(`patient_id = $${params.length}`);
    }
    if (f.actorId) {
        params.push(f.actorId);
        clauses.push(`actor_id = $${params.length}`);
    }
    if (f.action) {
        params.push(f.action);
        clauses.push(`action = $${params.length}`);
    }
    if (f.resource) {
        params.push(f.resource);
        clauses.push(`resource = $${params.length}`);
    }
    if (f.from) {
        params.push(f.from);
        clauses.push(`at >= $${params.length}`);
    }
    if (f.to) {
        params.push(f.to);
        clauses.push(`at <= $${params.length}`);
    }
    return { where: clauses.join(' AND '), params };
}

// GET /api/audit-events — admin-only, scoped to the caller's own tenant.
auditEventsRouter.get(
    '/api/audit-events',
    admins,
    h(async (req, res) => {
        const f = parse(filterSchema, req.query);
        const { where, params } = buildWhere(f, req.user.tenantId);
        params.push(f.limit, f.skip);
        const r = await query(
            `SELECT * FROM audit_events WHERE ${where} ORDER BY at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );
        ok(res, rows(r.rows));
    }),
);

// GET /api/audit-events/export.csv — same filters, capped at 5000 rows, no pagination envelope.
auditEventsRouter.get(
    '/api/audit-events/export.csv',
    admins,
    h(async (req, res) => {
        const f = parse(filterSchema.omit({ limit: true, skip: true }), req.query);
        const { where, params } = buildWhere(f, req.user.tenantId);
        const r = await query(`SELECT * FROM audit_events WHERE ${where} ORDER BY at DESC LIMIT 5000`, params);
        const header = ['at', 'actorType', 'actorId', 'actorRole', 'action', 'resource', 'resourceId', 'patientId', 'encounterId', 'method', 'path', 'status', 'latencyMs', 'ip'];
        const lines = [header.join(',')];
        for (const raw of rows(r.rows)) {
            lines.push(
                header
                    .map((k) => {
                        const v = raw[k];
                        if (v == null) return '';
                        const s = String(v).replace(/"/g, '""');
                        return /[",\n]/.test(s) ? `"${s}"` : s;
                    })
                    .join(','),
            );
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-events.csv"');
        res.send(lines.join('\n'));
    }),
);

// GET /api/platform/audit-events — Super Admin branch, not tenant-scoped; filterable by tenantId.
platformAuditEventsRouter.get(
    '/api/platform/audit-events',
    requirePlatformAuth,
    h(async (req, res) => {
        const f = parse(filterSchema.extend({ tenantId: z.string().trim().min(1).optional() }), req.query);
        const clauses = [];
        const params = [];
        if (f.tenantId) {
            params.push(f.tenantId);
            clauses.push(`tenant_id = $${params.length}`);
        }
        if (f.actorId) {
            params.push(f.actorId);
            clauses.push(`actor_id = $${params.length}`);
        }
        if (f.action) {
            params.push(f.action);
            clauses.push(`action = $${params.length}`);
        }
        if (f.from) {
            params.push(f.from);
            clauses.push(`at >= $${params.length}`);
        }
        if (f.to) {
            params.push(f.to);
            clauses.push(`at <= $${params.length}`);
        }
        params.push(f.limit, f.skip);
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const r = await query(
            `SELECT * FROM audit_events ${where} ORDER BY at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );
        ok(res, rows(r.rows));
    }),
);
