// @ts-check
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config.js';
import { q } from '../lib/sql.js';
import { conflict, created, h, notFound, ok, parse } from '../lib/http.js';
import { sendEmail } from '../lib/email.js';
import { requireRole } from '../middleware/auth.js';

export const patientAccountsRouter = Router();

const sha256 = (/** @type {string} */ s) => crypto.createHash('sha256').update(s).digest('hex');

const FHIR_READ_SCOPES = [
    'openid',
    'fhirUser',
    'launch/patient',
    'offline_access',
    'patient/*.read',
    'patient/Patient.read',
    'patient/Encounter.read',
    'patient/Condition.read',
    'patient/AllergyIntolerance.read',
    'patient/MedicationRequest.read',
    'patient/Observation.read',
    'patient/Immunization.read',
    'patient/DocumentReference.read',
];

const portalStaff = requireRole('admin', 'physician', 'nurse');

/**
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 */
const route = (fn) => h(fn);

/**
 * @param {string} email
 * @param {string} patientName
 * @param {string} inviteToken
 */
async function sendPortalInviteEmail(email, patientName, inviteToken) {
    const link = `${config.frontendUrl}/patient/set-password?token=${inviteToken}`;
    return sendEmail({
        to: email,
        subject: 'Your patient portal invitation',
        text: `Hello ${patientName},\n\nYou have been invited to access your patient health information.\n\nSet your password:\n${link}\n\nThis link expires in 7 days.`,
        html: `
            <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:480px">
                <p>Hello <strong>${patientName}</strong>,</p>
                <p>You have been invited to access your patient health information through the patient portal.</p>
                <p style="margin:24px 0">
                    <a href="${link}"
                       style="background:#97704f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:bold">
                        Set your password
                    </a>
                </p>
                <p style="color:#6b7280;font-size:13px">This link expires in 7 days.</p>
            </div>
        `,
    });
}

/** @param {Record<string, any> | null | undefined} a */
function accountStatus(a) {
    if (!a) return 'none';
    if (a.is_active === false) return 'deactivated';
    if (!a.password_hash) return 'invited';
    return 'active';
}

/** @param {Record<string, any> | null | undefined} a */
function publicAccount(a) {
    if (!a) return null;
    return {
        id: a.id,
        patientId: a.patient_id,
        email: a.email,
        isActive: a.is_active,
        status: accountStatus(a),
        lastLoginAt: a.last_login_at instanceof Date ? a.last_login_at.toISOString() : a.last_login_at ?? null,
        createdAt: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at,
        hasPassword: Boolean(a.password_hash),
    };
}

/**
 * @param {Record<string, any>} c
 * @param {{ clientSecret?: string }} [extra]
 */
function publicClient(c, extra = {}) {
    return {
        id: c.id,
        clientId: c.client_id,
        name: c.name,
        redirectUris: c.redirect_uris,
        allowedScopes: c.allowed_scopes,
        isConfidential: c.is_confidential,
        isActive: c.is_active,
        createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
        hasSecret: Boolean(c.client_secret_hash),
        ...extra,
    };
}

patientAccountsRouter.post(
    '/api/patients/:id/portal-invite',
    portalStaff,
    route(async (req, res) => {
        const b = parse(
            z.object({
                email: z.string().trim().email().optional(),
            }),
            req.body || {},
        );
        const patient = (await q('SELECT * FROM patients WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user?.tenantId]))
            .rows[0];
        if (!patient) throw notFound('Patient not found');

        const email = (b.email || patient.email || '').trim().toLowerCase();
        if (!email) throw conflict('Patient has no email; provide one in the invite request');

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const existing = (
            await q('SELECT * FROM patient_accounts WHERE patient_id = $1 AND tenant_id = $2', [
                patient.id,
                req.user?.tenantId,
            ])
        ).rows[0];

        if (existing) {
            const emailTaken = (
                await q(
                    `SELECT 1 FROM patient_accounts WHERE tenant_id = $1 AND lower(email) = lower($2) AND patient_id <> $3`,
                    [req.user?.tenantId, email, patient.id],
                )
            ).rowCount;
            if (emailTaken) throw conflict('Another patient portal account already uses this email');
            await q(
                `UPDATE patient_accounts
                 SET email = $1, invite_token_hash = $2, invite_expires_at = now() + interval '7 days',
                     is_active = TRUE, password_hash = NULL
                 WHERE id = $3`,
                [email, sha256(inviteToken), existing.id],
            );
        } else {
            const emailTaken = (
                await q(`SELECT 1 FROM patient_accounts WHERE tenant_id = $1 AND lower(email) = lower($2)`, [
                    req.user?.tenantId,
                    email,
                ])
            ).rowCount;
            if (emailTaken) throw conflict('Another patient portal account already uses this email');
            await q(
                `INSERT INTO patient_accounts (tenant_id, patient_id, email, invite_token_hash, invite_expires_at)
                 VALUES ($1,$2,$3,$4, now() + interval '7 days')`,
                [req.user?.tenantId, patient.id, email, sha256(inviteToken)],
            );
        }

        const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient';
        const { sent } = await sendPortalInviteEmail(email, patientName, inviteToken);
        const updated = (
            await q('SELECT * FROM patient_accounts WHERE patient_id = $1 AND tenant_id = $2', [
                patient.id,
                req.user?.tenantId,
            ])
        ).rows[0];

        ok(res, {
            ...publicAccount(updated),
            emailSent: sent,
            status: accountStatus(updated),
            ...(config.env === 'production' ? {} : { inviteToken }),
        });
    }),
);

patientAccountsRouter.get(
    '/api/patients/:id/portal-account',
    portalStaff,
    route(async (req, res) => {
        const patient = (
            await q('SELECT id FROM patients WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user?.tenantId])
        ).rows[0];
        if (!patient) throw notFound('Patient not found');
        const a = (
            await q('SELECT * FROM patient_accounts WHERE patient_id = $1 AND tenant_id = $2', [
                patient.id,
                req.user?.tenantId,
            ])
        ).rows[0];
        ok(res, publicAccount(a));
    }),
);

patientAccountsRouter.post(
    '/api/patients/:id/portal-account/deactivate',
    portalStaff,
    route(async (req, res) => {
        const a = (
            await q(
                `UPDATE patient_accounts SET is_active = FALSE, invite_token_hash = NULL, invite_expires_at = NULL
                 WHERE patient_id = $1 AND tenant_id = $2 RETURNING *`,
                [req.params.id, req.user?.tenantId],
            )
        ).rows[0];
        if (!a) throw notFound('Portal account not found');
        await q(
            `UPDATE smart_authorizations SET revoked_at = now()
             WHERE patient_account_id = $1 AND revoked_at IS NULL`,
            [a.id],
        );
        ok(res, publicAccount(a));
    }),
);

patientAccountsRouter.get(
    '/api/smart-clients',
    requireRole(),
    route(async (req, res) => {
        const r = await q(`SELECT * FROM smart_clients WHERE tenant_id = $1 ORDER BY created_at DESC`, [
            req.user?.tenantId,
        ]);
        ok(
            res,
            r.rows.map((c) => publicClient(c)),
        );
    }),
);

patientAccountsRouter.post(
    '/api/smart-clients',
    requireRole(),
    route(async (req, res) => {
        const b = parse(
            z.object({
                name: z.string().trim().min(1).max(200),
                redirectUris: z.array(z.string().url()).min(1).max(20),
                allowedScopes: z.array(z.string().trim().min(1).max(100)).default(FHIR_READ_SCOPES),
                isConfidential: z.boolean().default(false),
            }),
            req.body,
        );
        const clientId = `smart_${crypto.randomBytes(16).toString('hex')}`;
        let clientSecret = /** @type {string | undefined} */ (undefined);
        let secretHash = /** @type {string | null} */ (null);
        if (b.isConfidential) {
            clientSecret = crypto.randomBytes(32).toString('hex');
            secretHash = await bcrypt.hash(clientSecret, 10);
        }
        const c = (
            await q(
                `INSERT INTO smart_clients
                    (tenant_id, client_id, name, redirect_uris, allowed_scopes, is_confidential, client_secret_hash)
                 VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7) RETURNING *`,
                [
                    req.user?.tenantId,
                    clientId,
                    b.name,
                    JSON.stringify(b.redirectUris),
                    JSON.stringify(b.allowedScopes),
                    b.isConfidential,
                    secretHash,
                ],
            )
        ).rows[0];
        if (!c) throw conflict('Failed to create SMART client');
        created(res, publicClient(c, clientSecret ? { clientSecret } : {}));
    }),
);

patientAccountsRouter.put(
    '/api/smart-clients/:id',
    requireRole(),
    route(async (req, res) => {
        const b = parse(
            z.object({
                name: z.string().trim().min(1).max(200).optional(),
                redirectUris: z.array(z.string().url()).min(1).max(20).optional(),
                allowedScopes: z.array(z.string().trim().min(1).max(100)).optional(),
                isActive: z.boolean().optional(),
            }),
            req.body,
        );
        const r = await q(
            `UPDATE smart_clients SET
                name = COALESCE($1, name),
                redirect_uris = COALESCE($2::jsonb, redirect_uris),
                allowed_scopes = COALESCE($3::jsonb, allowed_scopes),
                is_active = COALESCE($4, is_active)
             WHERE id = $5 AND tenant_id = $6 RETURNING *`,
            [
                b.name ?? null,
                b.redirectUris ? JSON.stringify(b.redirectUris) : null,
                b.allowedScopes ? JSON.stringify(b.allowedScopes) : null,
                b.isActive ?? null,
                req.params.id,
                req.user?.tenantId,
            ],
        );
        if (!r.rowCount || !r.rows[0]) throw notFound('SMART client not found');
        ok(res, publicClient(r.rows[0]));
    }),
);

patientAccountsRouter.delete(
    '/api/smart-clients/:id',
    requireRole(),
    route(async (req, res) => {
        const r = await q(`DELETE FROM smart_clients WHERE id = $1 AND tenant_id = $2 RETURNING id`, [
            req.params.id,
            req.user?.tenantId,
        ]);
        if (!r.rowCount) throw notFound('SMART client not found');
        res.json({ status: 'success' });
    }),
);
