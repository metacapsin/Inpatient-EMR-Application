import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { ApiError, conflict, created, forbidden, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

/**
 * Facesheet chart notes — free-text types + structured CPT forms (payload in structured_payload).
 * Shape mirrors EMR-Backend PatientNote fields the EMR-ng create-notes shell uses
 * (notesType, notesText, date, time, assignedProvider, providerSigned, noteStatus, encounterId).
 * PDF / AI / email / cosign are intentionally not implemented here yet.
 * Admin may author and sign (requireRole admin-bypass) for operational coverage.
 */
export const patientChartNotesRouter = Router();

const ALLOWED_NOTE_TYPES = [
    'Office Note Free Text Progress Note',
    'Office Note Free Text HP',
    'Office Note Free Text TCM Note',
    'Office Note Free Text CCM Note',
    'Office Form',
    'Work Note',
    'Phone Note',
    'Follow-Up Progress Note (99212-99215/99308-99310/99347-99350)',
];
const DEFAULT_NOTE_TYPE = ALLOWED_NOTE_TYPES[0];
const authors = requireRole('physician', 'nurse', 'staff');
const readers = requireRole('physician', 'nurse', 'staff');
const signers = requireRole('physician', 'nurse');
const canSignRole = (role) => role === 'admin' || role === 'physician' || role === 'nurse';

const success = (res, message, data) => res.json({ status: 'success', message, data });

function noteOut(n) {
    return {
        id: n.id,
        _id: n.id,
        patientId: n.patient_id,
        encounterId: n.encounter_id,
        notesType: n.notes_type,
        notesText: n.notes_text ?? '',
        structuredPayload: n.structured_payload ?? null,
        date: n.visit_date instanceof Date
            ? n.visit_date.toISOString().slice(0, 10)
            : String(n.visit_date ?? '').slice(0, 10),
        time: n.visit_time ?? '',
        assignedProvider: n.assigned_provider_id
            ? { _id: n.assigned_provider_id, id: n.assigned_provider_id, name: n.assigned_provider_name || '' }
            : null,
        noteStatus: n.note_status,
        providerSigned: n.provider_signed || '',
        signedDate: n.signed_date || '',
        signedTime: n.signed_time || '',
        inErrorReason: n.in_error_reason ?? null,
        status: n.status !== false,
        createdBy: n.created_by,
        createdByName: n.created_by_name ?? null,
        createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : n.created_at,
        updatedAt: n.updated_at instanceof Date ? n.updated_at.toISOString() : n.updated_at,
        tenantId: n.tenant_id,
    };
}

const NOTE_SELECT = `
    SELECT n.*,
           cu.first_name || ' ' || cu.last_name AS created_by_name
    FROM patient_chart_notes n
    LEFT JOIN users cu ON cu.id = n.created_by`;

async function loadNote(req, id) {
    const r = await query(`${NOTE_SELECT} WHERE n.id = $1 AND n.tenant_id = $2`, [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Note not found');
    return r.rows[0];
}

async function requireEncounterForPatient(req, encounterId, patientId) {
    const e = (
        await query('SELECT id, patient_id, status FROM encounters WHERE id = $1 AND tenant_id = $2', [
            encounterId,
            req.user.tenantId,
        ])
    ).rows[0];
    if (!e) throw notFound('Encounter not found');
    if (e.patient_id !== patientId) throw new ApiError(400, 'Encounter does not belong to this patient');
    return e;
}

async function resolveAssignedProvider(req, assignedProviderId, assignedProviderName) {
    if (!assignedProviderId) throw new ApiError(400, 'Assigned Provider is required');
    const u = (
        await query(
            `SELECT id, first_name, last_name, role FROM users
             WHERE id = $1 AND tenant_id = $2 AND is_active`,
            [assignedProviderId, req.user.tenantId],
        )
    ).rows[0];
    if (!u) throw notFound('Assigned provider not found');
    const name =
        (assignedProviderName && String(assignedProviderName).trim()) ||
        `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
        u.id;
    return { id: u.id, name };
}

function nowTimeLabel() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatSignedDate() {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Accept yyyy-MM-dd or MM/dd/yyyy (EMR-ng calendar). */
function toYmd(value) {
    const s = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
        const mm = m[1].padStart(2, '0');
        const dd = m[2].padStart(2, '0');
        let yyyy = m[3];
        if (yyyy.length === 2) yyyy = `20${yyyy}`;
        return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    throw new ApiError(400, 'Visit Date is required.');
}

const createBody = z.object({
    patientId: z.string().trim().min(1),
    encounterId: z.string().trim().min(1),
    notesType: z
        .enum([
            'Office Note Free Text Progress Note',
            'Office Note Free Text HP',
            'Office Note Free Text TCM Note',
            'Office Note Free Text CCM Note',
            'Office Form',
            'Work Note',
            'Phone Note',
            'Follow-Up Progress Note (99212-99215/99308-99310/99347-99350)',
        ])
        .default(DEFAULT_NOTE_TYPE),
    notesText: z.string().trim().min(5, 'Input should be more than 5 characters').max(100000),
    structuredPayload: z.any().optional().nullable(),
    date: z.string().trim().min(1, 'Visit Date is required'),
    time: z.string().trim().max(40).optional().nullable(),
    assignedProviderId: z.string().trim().min(1, 'Assigned Provider is required'),
    assignedProviderName: z.string().trim().max(200).optional().nullable(),
    providerSigned: z.string().trim().max(200).optional().nullable(),
    signedDate: z.string().trim().max(80).optional().nullable(),
    signedTime: z.string().trim().max(40).optional().nullable(),
    noteStatus: z.enum(['In Draft', 'Completed']).optional(),
});

const updateBody = z.object({
    notesText: z.string().trim().min(5).max(100000).optional(),
    structuredPayload: z.any().optional().nullable(),
    date: z.string().trim().min(1).optional(),
    time: z.string().trim().max(40).optional().nullable(),
    assignedProviderId: z.string().trim().min(1).optional(),
    assignedProviderName: z.string().trim().max(200).optional().nullable(),
    encounterId: z.string().trim().min(1).optional(),
    providerSigned: z.string().trim().max(200).optional().nullable(),
    signedDate: z.string().trim().max(80).optional().nullable(),
    signedTime: z.string().trim().max(40).optional().nullable(),
    noteStatus: z.enum(['In Draft', 'Completed']).optional(),
});

// POST /Patient/createPatientNote
patientChartNotesRouter.post(
    '/Patient/createPatientNote',
    authors,
    h(async (req, res) => {
        const b = parse(createBody, { ...req.body, notesType: req.body?.notesType || DEFAULT_NOTE_TYPE });
        await requireEncounterForPatient(req, b.encounterId, b.patientId);
        const provider = await resolveAssignedProvider(req, b.assignedProviderId, b.assignedProviderName);

        const signing = Boolean(b.providerSigned && String(b.providerSigned).trim());
        const noteStatus = signing ? 'Completed' : b.noteStatus || 'In Draft';
        const providerSigned = signing ? String(b.providerSigned).trim() : '';
        const signedDate = signing ? b.signedDate || formatSignedDate() : '';
        const signedTime = signing ? b.signedTime || nowTimeLabel() : '';

        if (signing && !canSignRole(req.user.role)) {
            throw forbidden('You do not have permission to sign this note');
        }

        const visitDate = toYmd(b.date);
        const payload = b.structuredPayload ?? null;
        const r = await query(
            `INSERT INTO patient_chart_notes (
                tenant_id, patient_id, encounter_id, notes_type, notes_text, visit_date, visit_time,
                assigned_provider_id, assigned_provider_name, note_status,
                provider_signed, signed_date, signed_time, structured_payload, created_by, updated_by
             ) VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$15)
             RETURNING id`,
            [
                req.user.tenantId,
                b.patientId,
                b.encounterId,
                b.notesType,
                b.notesText,
                visitDate,
                b.time || null,
                provider.id,
                provider.name,
                noteStatus,
                providerSigned,
                signedDate,
                signedTime,
                payload ? JSON.stringify(payload) : null,
                req.user.id,
            ],
        );
        created(res, noteOut(await loadNote(req, r.rows[0].id)), { message: 'Note created' });
    }),
);

// POST /Patient/getPatientWiseNotesList
patientChartNotesRouter.post(
    '/Patient/getPatientWiseNotesList',
    readers,
    h(async (req, res) => {
        const b = parse(
            z.object({
                patientId: z.string().trim().min(1),
                encounterId: z.string().trim().optional(),
                notesType: z.string().trim().optional(),
                noteStatus: z.string().trim().optional(),
                assignedProvider: z.string().trim().optional(),
                includeInError: z.boolean().optional().default(true),
            }),
            req.body ?? {},
        );

        const params = [req.user.tenantId, b.patientId];
        let where = 'n.tenant_id = $1 AND n.patient_id = $2 AND n.status = TRUE';

        if (b.encounterId) {
            params.push(b.encounterId);
            where += ` AND n.encounter_id = $${params.length}`;
        }
        if (b.notesType) {
            params.push(b.notesType);
            where += ` AND n.notes_type = $${params.length}`;
        }
        if (b.noteStatus) {
            params.push(b.noteStatus);
            where += ` AND n.note_status = $${params.length}`;
        }
        if (b.assignedProvider) {
            params.push(b.assignedProvider);
            where += ` AND n.assigned_provider_id = $${params.length}`;
        }
        if (!b.includeInError) {
            where += ` AND n.note_status <> 'Marked in Error'`;
        }

        const r = await query(
            `${NOTE_SELECT} WHERE ${where} ORDER BY n.visit_date DESC, n.created_at DESC`,
            params,
        );
        success(res, '', r.rows.map(noteOut));
    }),
);

// GET /Patient/getPatientNoteById/:id
patientChartNotesRouter.get(
    '/Patient/getPatientNoteById/:id',
    readers,
    h(async (req, res) => {
        success(res, '', noteOut(await loadNote(req, req.params.id)));
    }),
);

// PUT /Patient/updatePatientNote
patientChartNotesRouter.put(
    '/Patient/updatePatientNote',
    authors,
    h(async (req, res) => {
        const id = String(req.body?.id || req.body?._id || '').trim();
        if (!id) throw new ApiError(400, 'Note id is required');
        const b = parse(updateBody, req.body);
        const existing = await loadNote(req, id);

        if (existing.note_status === 'Completed' && !b.providerSigned) {
            throw conflict('Signed note cannot be modified');
        }
        if (existing.note_status === 'Marked in Error') {
            throw conflict('Marked-in-error note cannot be modified; restore it first');
        }

        const patientId = existing.patient_id;
        const encounterId = b.encounterId || existing.encounter_id;
        await requireEncounterForPatient(req, encounterId, patientId);

        let providerId = existing.assigned_provider_id;
        let providerName = existing.assigned_provider_name;
        if (b.assignedProviderId) {
            const provider = await resolveAssignedProvider(req, b.assignedProviderId, b.assignedProviderName);
            providerId = provider.id;
            providerName = provider.name;
        }

        const signing = Boolean(b.providerSigned && String(b.providerSigned).trim());
        if (signing && !canSignRole(req.user.role)) {
            throw forbidden('You do not have permission to sign this note');
        }

        const nextText = b.notesText ?? existing.notes_text;
        const nextDate = b.date
            ? toYmd(b.date)
            : (existing.visit_date instanceof Date
                ? existing.visit_date.toISOString().slice(0, 10)
                : String(existing.visit_date).slice(0, 10));
        const nextTime = b.time !== undefined ? b.time : existing.visit_time;
        const nextPayload =
            b.structuredPayload !== undefined ? b.structuredPayload : existing.structured_payload;
        const noteStatus = signing ? 'Completed' : b.noteStatus || existing.note_status;
        const providerSigned = signing ? String(b.providerSigned).trim() : existing.provider_signed || '';
        const signedDate = signing ? b.signedDate || formatSignedDate() : existing.signed_date || '';
        const signedTime = signing ? b.signedTime || nowTimeLabel() : existing.signed_time || '';

        await query(
            `UPDATE patient_chart_notes SET
                notes_text = $1,
                visit_date = $2::date,
                visit_time = $3,
                assigned_provider_id = $4,
                assigned_provider_name = $5,
                encounter_id = $6,
                note_status = $7,
                provider_signed = $8,
                signed_date = $9,
                signed_time = $10,
                structured_payload = $11::jsonb,
                updated_by = $12,
                updated_at = now()
             WHERE id = $13 AND tenant_id = $14`,
            [
                nextText,
                nextDate,
                nextTime || null,
                providerId,
                providerName,
                encounterId,
                noteStatus,
                providerSigned,
                signedDate,
                signedTime,
                nextPayload != null ? JSON.stringify(nextPayload) : null,
                req.user.id,
                id,
                req.user.tenantId,
            ],
        );
        ok(res, noteOut(await loadNote(req, id)), { message: signing ? 'Note signed' : 'Note updated' });
    }),
);

// PUT /Patient/markNoteInError/:noteId
patientChartNotesRouter.put(
    '/Patient/markNoteInError/:noteId',
    authors,
    h(async (req, res) => {
        const reason = String(req.body?.reason || req.body?.inErrorReason || '').trim();
        if (!reason) throw new ApiError(400, 'Error reason is required');
        const existing = await loadNote(req, req.params.noteId);
        if (existing.note_status === 'Marked in Error') throw conflict('Note is already marked in error');
        await query(
            `UPDATE patient_chart_notes SET note_status = 'Marked in Error', in_error_reason = $1,
                    updated_by = $2, updated_at = now()
             WHERE id = $3 AND tenant_id = $4`,
            [reason, req.user.id, req.params.noteId, req.user.tenantId],
        );
        ok(res, noteOut(await loadNote(req, req.params.noteId)), { message: 'Note marked in error' });
    }),
);

// PUT /Patient/restoreNote/:id
patientChartNotesRouter.put(
    '/Patient/restoreNote/:id',
    authors,
    h(async (req, res) => {
        const existing = await loadNote(req, req.params.id);
        if (existing.note_status !== 'Marked in Error') throw conflict('Only marked-in-error notes can be restored');
        const nextStatus = existing.provider_signed ? 'Completed' : 'In Draft';
        await query(
            `UPDATE patient_chart_notes SET note_status = $1, in_error_reason = NULL,
                    updated_by = $2, updated_at = now()
             WHERE id = $3 AND tenant_id = $4`,
            [nextStatus, req.user.id, req.params.id, req.user.tenantId],
        );
        ok(res, noteOut(await loadNote(req, req.params.id)), { message: 'Note restored' });
    }),
);

// DELETE /Patient/deletePatientNote/:id — soft delete
patientChartNotesRouter.delete(
    '/Patient/deletePatientNote/:id',
    authors,
    h(async (req, res) => {
        const existing = await loadNote(req, req.params.id);
        if (existing.note_status === 'Completed') {
            throw conflict('Signed notes cannot be deleted; mark in error instead');
        }
        await query(
            `UPDATE patient_chart_notes SET status = FALSE, updated_by = $1, updated_at = now()
             WHERE id = $2 AND tenant_id = $3`,
            [req.user.id, req.params.id, req.user.tenantId],
        );
        success(res, 'Note deleted', { id: req.params.id });
    }),
);

// Convenience: sign endpoint (same rules as update with providerSigned)
patientChartNotesRouter.post(
    '/Patient/signPatientNote/:id',
    signers,
    h(async (req, res) => {
        const existing = await loadNote(req, req.params.id);
        if (existing.note_status === 'Completed') throw conflict('Note is already signed');
        if (existing.note_status === 'Marked in Error') throw conflict('Cannot sign a marked-in-error note');
        const isAssigned = existing.assigned_provider_id && existing.assigned_provider_id === req.user.id;
        if (!isAssigned && req.user.role !== 'admin' && req.user.role !== 'physician') {
            throw forbidden('Only the assigned provider can sign this note');
        }
        const signerName = req.user.name || req.body?.providerSigned || 'Provider';
        await query(
            `UPDATE patient_chart_notes SET
                note_status = 'Completed',
                provider_signed = $1,
                signed_date = $2,
                signed_time = $3,
                updated_by = $4,
                updated_at = now()
             WHERE id = $5 AND tenant_id = $6`,
            [signerName, formatSignedDate(), nowTimeLabel(), req.user.id, req.params.id, req.user.tenantId],
        );
        ok(res, noteOut(await loadNote(req, req.params.id)), { message: 'Note signed' });
    }),
);
