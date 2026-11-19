import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config, devTokensAllowed } from '../config.js';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, created, h, notFound, ok, parse, row, rows } from '../lib/http.js';
import { requirePlatformAuth } from '../middleware/platformAuth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { recordAuditEvent } from '../lib/audit.js';
import { sendEmail } from '../lib/email.js';

export const platformAdminRouter = Router();
// Every platform-admin route below takes auditMiddleware as its own handler-chain entry (never
// platformAdminRouter.use(...) — this router, like every router in app.js, is mounted at "/" with
// no prefix, so an unprefixed .use() here would run for every request in the whole app, not just
// this router's own routes; see memory note backend_router_middleware_gotcha). The handlers below
// additionally call recordAuditEvent() for the specific, higher-value events (plan item 3).

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Stand in for the real Stripe subscription call until live keys exist (see plan's stub list). */
function createStripeSubscriptionStub(tenantName, plan) {
    const id = `stub_sub_${crypto.randomUUID()}`;
    console.log(`[stripe:stub] would create subscription for "${tenantName}" (plan=${plan ?? 'none'}): ${id}`);
    return id;
}

/** Emails the invited admin their set-password link. Falls back to logging when SMTP isn't configured (see lib/email.js). */
async function sendInviteEmail(email, tenantName, resetToken) {
    const link = `${config.frontendUrl}/set-password?token=${resetToken}`;
    return sendEmail({
        to: email,
        subject: `You're invited to administer ${tenantName}`,
        text: `You've been invited as an administrator for ${tenantName}.\n\nSet your password to finish setting up your account:\n${link}\n\nThis link expires in 7 days.`,
        html: `
            <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:480px">
                <p>You've been invited as an administrator for <strong>${tenantName}</strong>.</p>
                <p style="margin:24px 0">
                    <a href="${link}"
                       style="background:#97704f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:bold">
                        Set your password
                    </a>
                </p>
                <p style="color:#6b7280;font-size:13px">
                    If the button above doesn't work, copy and paste this link into your browser:<br>
                    <a href="${link}" style="color:#97704f;word-break:break-all">${link}</a>
                </p>
                <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you weren't expecting this invite, you can ignore this email.</p>
            </div>
        `,
    });
}

// GET /api/platform/tenants
platformAdminRouter.get(
    '/api/platform/tenants',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const r = await query(
            `SELECT t.*, (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id) AS user_count
             FROM tenants t ORDER BY t.created_at DESC`,
        );
        ok(res, rows(r.rows));
    }),
);

// POST /api/platform/tenants
platformAdminRouter.post(
    '/api/platform/tenants',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const b = parse(
            z.object({
                name: z.string().trim().min(1).max(200),
                plan: z.string().trim().max(100).optional(),
                enabledModules: z.array(z.string().trim().min(1).max(100)).default(['adt', 'patients', 'medication', 'billing', 'staffing', 'ai']),
            }),
            req.body,
        );
        const stripeSubscriptionId = createStripeSubscriptionStub(b.name, b.plan);
        const t = (
            await query(
                `INSERT INTO tenants (name, plan, stripe_subscription_id, enabled_modules) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
                [b.name, b.plan ?? null, stripeSubscriptionId, JSON.stringify(b.enabledModules)],
            )
        ).rows[0];
        await recordAuditEvent({
            tenantId: t.id,
            actorType: 'platform_admin',
            actorId: req.platformAdmin.id,
            action: 'create',
            resource: 'tenant',
            resourceId: t.id,
            details: { name: b.name, plan: b.plan ?? null, enabledModules: b.enabledModules },
        });
        created(res, row(t));
    }),
);

// POST /api/platform/tenants/:id/invite-admin
platformAdminRouter.post(
    '/api/platform/tenants/:id/invite-admin',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const b = parse(
            z.object({
                email: z.string().trim().email(),
                firstName: z.string().trim().max(100).default(''),
                lastName: z.string().trim().max(100).default(''),
            }),
            req.body,
        );
        const tenant = (await query('SELECT * FROM tenants WHERE id = $1', [req.params.id])).rows[0];
        if (!tenant) throw notFound('Tenant not found');
        const dup = await query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [b.email]);
        if (dup.rowCount) throw conflict('An account with this email already exists');

        const resetToken = crypto.randomBytes(32).toString('hex');
        const user = await withTx(async (db) => {
            // Password is a random value the invited admin never sees; they set their own via the reset-password link.
            const unusablePassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
            const u = (
                await db.query(
                    `INSERT INTO users (tenant_id, email, username, password_hash, first_name, last_name, role, reset_token_hash, reset_expires_at)
                     VALUES ($1,$2,$2,$3,$4,$5,'admin',$6, now() + interval '7 days') RETURNING *`,
                    [tenant.id, b.email, unusablePassword, b.firstName, b.lastName, sha256(resetToken)],
                )
            ).rows[0];
            return u;
        });
        const { sent } = await sendInviteEmail(user.email, tenant.name, resetToken);
        await recordAuditEvent({
            tenantId: tenant.id,
            actorType: 'platform_admin',
            actorId: req.platformAdmin.id,
            action: 'create',
            resource: 'user',
            resourceId: user.id,
            details: { email: user.email, role: user.role, emailSent: sent },
        });
        created(res, {
            id: user.id,
            _id: user.id,
            email: user.email,
            tenantId: user.tenant_id,
            role: user.role,
            emailSent: sent,
            // Gated on an explicit flag (SEC-20), not NODE_ENV: a deployment that forgets to set
            // NODE_ENV=production would otherwise leak this. Off by default; on in dev/test.
            ...(devTokensAllowed() ? { devSetPasswordToken: resetToken } : {}),
        });
    }),
);

// PATCH /api/platform/tenants/:id
platformAdminRouter.patch(
    '/api/platform/tenants/:id',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const b = parse(
            z.object({
                status: z.enum(['trial', 'active', 'suspended']).optional(),
                plan: z.string().trim().max(100).optional(),
                enabledModules: z.array(z.string().trim().min(1).max(100)).optional(),
            }),
            req.body,
        );
        const r = await query(
            `UPDATE tenants SET status = COALESCE($1, status), plan = COALESCE($2, plan),
                    enabled_modules = COALESCE($3::jsonb, enabled_modules)
             WHERE id = $4 RETURNING *`,
            [b.status ?? null, b.plan ?? null, b.enabledModules ? JSON.stringify(b.enabledModules) : null, req.params.id],
        );
        if (!r.rowCount) throw notFound('Tenant not found');
        await recordAuditEvent({
            tenantId: r.rows[0].id,
            actorType: 'platform_admin',
            actorId: req.platformAdmin.id,
            action: 'update',
            resource: 'tenant',
            resourceId: r.rows[0].id,
            details: { status: b.status ?? undefined, plan: b.plan ?? undefined, enabledModules: b.enabledModules ?? undefined },
        });
        ok(res, row(r.rows[0]));
    }),
);

// GET /api/platform/tenants/:id/deletion-impact — counts to show in the confirmation dialog before DELETE.
platformAdminRouter.get(
    '/api/platform/tenants/:id/deletion-impact',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const tenant = (await query('SELECT id, name FROM tenants WHERE id = $1', [req.params.id])).rows[0];
        if (!tenant) throw notFound('Tenant not found');
        const counts = (
            await query(
                `SELECT
                    (SELECT count(*)::int FROM patients WHERE tenant_id = $1) AS patients,
                    (SELECT count(*)::int FROM users WHERE tenant_id = $1) AS users,
                    (SELECT count(*)::int FROM encounters WHERE tenant_id = $1) AS encounters`,
                [tenant.id],
            )
        ).rows[0];
        ok(res, { tenantId: tenant.id, tenantName: tenant.name, patientCount: counts.patients, userCount: counts.users, encounterCount: counts.encounters });
    }),
);

// DELETE /api/platform/tenants/:id — every tenant_id FK in the schema is ON DELETE CASCADE (checked
// across all migrations), so this one statement removes every clinical/operational row for the
// tenant. Irreversible, so it requires the caller to echo back the tenant's exact current name —
// the frontend's confirmation dialog collects that from the admin, not just an ID in a URL.
platformAdminRouter.delete(
    '/api/platform/tenants/:id',
    requirePlatformAuth,
    auditMiddleware,
    h(async (req, res) => {
        const { confirmName } = parse(z.object({ confirmName: z.string().trim().min(1) }), req.body);
        const tenant = (await query('SELECT id, name FROM tenants WHERE id = $1', [req.params.id])).rows[0];
        if (!tenant) throw notFound('Tenant not found');
        if (confirmName !== tenant.name) throw badRequest('Tenant name does not match — type the exact tenant name to confirm deletion');
        const counts = (
            await query(
                `SELECT
                    (SELECT count(*)::int FROM patients WHERE tenant_id = $1) AS patients,
                    (SELECT count(*)::int FROM users WHERE tenant_id = $1) AS users,
                    (SELECT count(*)::int FROM encounters WHERE tenant_id = $1) AS encounters`,
                [tenant.id],
            )
        ).rows[0];
        await query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
        // tenantId is null, not tenant.id — the row (and its FK) no longer exists once the tenant is gone.
        await recordAuditEvent({
            tenantId: null,
            actorType: 'platform_admin',
            actorId: req.platformAdmin.id,
            action: 'delete',
            resource: 'tenant',
            resourceId: tenant.id,
            details: { name: tenant.name, patientCount: counts.patients, userCount: counts.users, encounterCount: counts.encounters },
        });
        ok(res, { id: tenant.id, deleted: true });
    }),
);
