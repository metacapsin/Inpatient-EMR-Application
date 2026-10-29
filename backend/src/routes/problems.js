import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, created, h, notFound, ok, parse, row, rows } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const problemsRouter = Router();

const clinicalWriters = requireRole('physician', 'nurse');
const STATUSES = ['active', 'inactive', 'resolved', 'entered_in_error'];
const CHRONICITIES = ['acute', 'chronic'];

const dateOnly = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .optional()
    .nullable();

async function assertPatient(req, patientId) {
    const r = await query('SELECT id FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
}

async function assertEncounterOptional(req, encounterId, patientId) {
    if (!encounterId) return;
    const r = await query(
        'SELECT id, patient_id FROM encounters WHERE id = $1 AND tenant_id = $2',
        [encounterId, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Encounter not found');
    if (r.rows[0].patient_id !== patientId) throw badRequest('encounterId does not belong to this patient');
}

function problemOut(p) {
    return row(p);
}

const LIST_ORDER = `
    CASE p.status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
    CASE
        WHEN p.status = 'active' AND p.chronicity = 'chronic' THEN 0
        WHEN p.status = 'active' AND p.chronicity = 'acute' THEN 1
        WHEN p.status = 'active' THEN 2
        ELSE 3
    END,
    p.created_at DESC`;

/** Allowed status transitions. entered_in_error is terminal. */
const ALLOWED_TRANSITIONS = {
    active: new Set(['active', 'inactive', 'resolved', 'entered_in_error']),
    inactive: new Set(['inactive', 'active', 'resolved', 'entered_in_error']),
    resolved: new Set(['resolved', 'active', 'inactive', 'entered_in_error']),
    entered_in_error: new Set(['entered_in_error']),
};

// ------------------------------------------------------------ ICD-10 search
problemsRouter.get('/api/icd10/search', h(async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    if (q.length < 1) return ok(res, []);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const codePrefix = `${q.replace(/[\\%_]/g, '\\$&')}%`;
    const r = await query(
        `SELECT code, description, billable, effective_year
         FROM icd10_codes
         WHERE code ILIKE $1 OR description ILIKE $2
         ORDER BY
           CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END,
           length(code),
           code
         LIMIT 20`,
        [codePrefix, like],
    );
    ok(res, rows(r.rows));
}));

// ------------------------------------------------------------ list problems
problemsRouter.get('/api/patients/:patientId/problems', h(async (req, res) => {
    await assertPatient(req, req.params.patientId);
    const includeResolved =
        String(req.query.includeResolved ?? '').toLowerCase() === 'true' ||
        req.query.includeResolved === '1';

    const statusFilter = includeResolved
        ? `AND p.status IN ('active','inactive','resolved')`
        : `AND p.status = 'active'`;

    const r = await query(
        `SELECT p.*
         FROM problems p
         WHERE p.tenant_id = $1 AND p.patient_id = $2
         ${statusFilter}
         ORDER BY ${LIST_ORDER}`,
        [req.user.tenantId, req.params.patientId],
    );
    ok(res, r.rows.map(problemOut));
}));

// ------------------------------------------------------------ add problem
problemsRouter.post('/api/patients/:patientId/problems', clinicalWriters, h(async (req, res) => {
    const patientId = req.params.patientId;
    const b = parse(
        z.object({
            icd10Code: z.string().trim().min(1).max(12),
            encounterId: z.string().trim().min(1).max(64).optional().nullable(),
            chronicity: z.enum(CHRONICITIES).optional().nullable(),
            onsetDate: dateOnly,
            status: z.enum(['active', 'inactive']).optional().default('active'),
        }),
        req.body,
    );

    await assertPatient(req, patientId);
    await assertEncounterOptional(req, b.encounterId ?? null, patientId);

    const codeKey = b.icd10Code.trim().toUpperCase();
    const codeRow = (
        await query(
            `SELECT code, description FROM icd10_codes
             WHERE upper(code) = $1 OR replace(upper(code), '.', '') = replace($1, '.', '')`,
            [codeKey],
        )
    ).rows[0];
    if (!codeRow) throw badRequest('ICD-10 code not found in catalog');

    try {
        const r = await query(
            `INSERT INTO problems (
                tenant_id, patient_id, encounter_id, icd10_code, icd10_description,
                status, chronicity, onset_date, noted_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [
                req.user.tenantId,
                patientId,
                b.encounterId ?? null,
                codeRow.code,
                codeRow.description,
                b.status ?? 'active',
                b.chronicity ?? null,
                b.onsetDate ?? null,
                req.user.id,
            ],
        );
        created(res, problemOut(r.rows[0]));
    } catch (e) {
        if (e.code === '23505') {
            throw conflict('An active problem with this ICD-10 code already exists for this patient');
        }
        throw e;
    }
}));

// ------------------------------------------------------------ patch problem
problemsRouter.patch('/api/problems/:id', clinicalWriters, h(async (req, res) => {
    const b = parse(
        z
            .object({
                status: z.enum(STATUSES).optional(),
                chronicity: z.enum(CHRONICITIES).nullable().optional(),
                onsetDate: dateOnly,
                resolvedDate: dateOnly,
                encounterId: z.string().trim().min(1).max(64).nullable().optional(),
            })
            .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' }),
        req.body,
    );

    const existing = (
        await query('SELECT * FROM problems WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])
    ).rows[0];
    if (!existing) throw notFound('Problem not found');

    const nextStatus = b.status ?? existing.status;
    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed?.has(nextStatus)) {
        throw badRequest(`Cannot transition problem status from ${existing.status} to ${nextStatus}`);
    }

    let onsetDate = b.onsetDate !== undefined ? b.onsetDate : existing.onset_date;
    let resolvedDate = b.resolvedDate !== undefined ? b.resolvedDate : existing.resolved_date;
    const chronicity = b.chronicity !== undefined ? b.chronicity : existing.chronicity;
    let encounterId = existing.encounter_id;
    if (b.encounterId !== undefined) {
        if (b.encounterId) await assertEncounterOptional(req, b.encounterId, existing.patient_id);
        encounterId = b.encounterId;
    }

    if (nextStatus === 'resolved') {
        if (!resolvedDate) resolvedDate = new Date().toISOString().slice(0, 10);
    } else if (b.status && (nextStatus === 'active' || nextStatus === 'inactive')) {
        if (b.resolvedDate === undefined) resolvedDate = null;
    }

    const onsetStr = onsetDate ? String(onsetDate).slice(0, 10) : null;
    const resolvedStr = resolvedDate ? String(resolvedDate).slice(0, 10) : null;
    if (onsetStr && resolvedStr && resolvedStr < onsetStr) {
        throw badRequest('resolvedDate cannot be before onsetDate');
    }

    try {
        const r = await query(
            `UPDATE problems SET
                status = $1,
                chronicity = $2,
                onset_date = $3,
                resolved_date = $4,
                encounter_id = $5,
                updated_at = now()
             WHERE id = $6 AND tenant_id = $7
             RETURNING *`,
            [nextStatus, chronicity, onsetDate, resolvedDate, encounterId, req.params.id, req.user.tenantId],
        );
        ok(res, problemOut(r.rows[0]));
    } catch (e) {
        if (e.code === '23505') {
            throw conflict('An active problem with this ICD-10 code already exists for this patient');
        }
        throw e;
    }
}));
