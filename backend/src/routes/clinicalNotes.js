import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { ApiError, conflict, forbidden, h, notFound, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

/**
 * Physician documentation — the backend for the Clinical Workspace "physician" tab.
 * Path contract and payload shape are exactly what `features/clinical-workflows/api/clinicalApi.ts` already
 * calls, mirroring the reference implementation (EMR-Backend `Clinical/PhysicianNoteController` +
 * `physicianNoteService`): note `content` is a JSON object with the template sections (hpi / ros /
 * assessment / plan), `versionHistory` records a checksum per edit, `addenda` is append-only after signing.
 *
 * Deliberately NOT implemented here (separate features sharing the same client file): /nursing-notes,
 * /handover, /vitals, /orders, /alerts/*.
 */
export const clinicalNotesRouter = Router();
const BASE = '/api/inpatient/clinical';
const NOTE_TYPES = ['hp', 'progress', 'discharge_summary', 'consult'];
/** Note types only a physician may author (admin always passes requireRole). */
const PHYSICIAN_ONLY_TYPES = new Set(['hp', 'consult', 'discharge_summary']);
const authors = requireRole('physician', 'nurse');
const signers = requireRole('physician');
const H_P_DEADLINE_HOURS = 24; // 42 CFR 482.24(c)(4): H&P in the record within 24h of admission

const success = (res, message, data) => res.json({ status: 'success', message, data });
const checksum = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex').slice(0, 24);
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

/** CMS timing flag for H&P notes — surfaced, never enforced (a late H&P still has to be saved). */
function cmsCompliance(note, admittedAt) {
    if (note.note_type !== 'hp' || !admittedAt) return null;
    const deadline = new Date(new Date(admittedAt).getTime() + H_P_DEADLINE_HOURS * 3600_000);
    const signedAt = note.signed_at ? new Date(note.signed_at) : null;
    const isLate = signedAt ? signedAt > deadline : new Date() > deadline;
    return { deadline: deadline.toISOString(), signedAt: iso(signedAt), isLate, rule: '42 CFR 482.24(c)(4)' };
}

function noteOut(n) {
    return {
        id: n.id,
        _id: n.id,
        patientId: n.patient_id,
        encounterId: n.encounter_id,
        type: n.note_type,
        title: n.title,
        content: n.content ?? {},
        richText: n.rich_text,
        status: n.status,
        createdBy: n.created_by,
        createdByName: n.created_by_name ?? null,
        signedBy: n.signed_by,
        signedByName: n.signed_by_name ?? null,
        signedAt: iso(n.signed_at),
        versionHistory: n.version_history ?? [],
        addenda: n.addenda ?? [],
        linkedOrderIds: n.linked_order_ids ?? [],
        tenantId: n.tenant_id,
        createdAt: iso(n.created_at),
        updatedAt: iso(n.updated_at),
        cmsCompliance: cmsCompliance(n, n.admitted_at),
    };
}

const NOTE_SELECT = `
    SELECT n.*, e.admitted_at,
           cu.first_name || ' ' || cu.last_name AS created_by_name,
           su.first_name || ' ' || su.last_name AS signed_by_name
    FROM clinical_notes n
    JOIN encounters e ON e.id = n.encounter_id
    LEFT JOIN users cu ON cu.id = n.created_by
    LEFT JOIN users su ON su.id = n.signed_by`;

async function loadNote(req, id) {
    const r = await query(`${NOTE_SELECT} WHERE n.id = $1 AND n.tenant_id = $2`, [id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Note not found');
    return r.rows[0];
}

/** Mirrors the reference `requireActiveEncounter`: the encounter must belong to the patient and not be discharged. */
async function requireActiveEncounter(req, encounterId, patientId) {
    const e = (await query('SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId])).rows[0];
    if (!e) throw notFound('Encounter not found');
    if (e.patient_id !== patientId) throw new ApiError(400, 'Encounter does not belong to this patient');
    if (e.status === 'discharged') throw conflict('Encounter is discharged; notes can no longer be added or changed');
    return e;
}

const contentSchema = z.record(z.string(), z.string().max(20000));
const createBody = z.object({
    patientId: z.string().trim().min(1),
    encounterId: z.string().trim().min(1),
    type: z.enum(NOTE_TYPES),
    title: z.string().trim().max(200).optional().nullable(),
    content: contentSchema.optional().default({}),
    richText: z.string().max(100000).optional().nullable(),
    linkedOrderIds: z.array(z.string()).optional(),
});

// POST /notes/create
clinicalNotesRouter.post(`${BASE}/notes/create`, authors, h(async (req, res) => {
    const b = parse(createBody, req.body);
    if (PHYSICIAN_ONLY_TYPES.has(b.type) && !['physician', 'admin'].includes(req.user.role)) {
        throw forbidden('Only a physician can author this note type');
    }
    await requireActiveEncounter(req, b.encounterId, b.patientId);
    const version = [{ version: 1, checksum: checksum(b.content), editedBy: req.user.id, editedAt: new Date().toISOString() }];
    const r = await query(
        `INSERT INTO clinical_notes (tenant_id, patient_id, encounter_id, note_type, title, content, rich_text, version_history, linked_order_ids, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [req.user.tenantId, b.patientId, b.encounterId, b.type, b.title ?? null, JSON.stringify(b.content), b.richText ?? null,
         JSON.stringify(version), JSON.stringify(b.linkedOrderIds ?? []), req.user.id],
    );
    success(res, 'Note created', noteOut(await loadNote(req, r.rows[0].id)));
}));

// GET /notes/patient/:patientId?encounterId=&limit=&skip=
clinicalNotesRouter.get(`${BASE}/notes/patient/:patientId`, h(async (req, res) => {
    const q = parse(z.object({ encounterId: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50), skip: z.coerce.number().int().min(0).default(0) }), req.query);
    const params = [req.user.tenantId, req.params.patientId];
    let where = 'n.tenant_id = $1 AND n.patient_id = $2';
    if (q.encounterId) { params.push(q.encounterId); where += ` AND n.encounter_id = $${params.length}`; }
    params.push(q.limit, q.skip);
    const r = await query(`${NOTE_SELECT} WHERE ${where} ORDER BY n.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    success(res, '', r.rows.map(noteOut));
}));

// GET /notes/:id
clinicalNotesRouter.get(`${BASE}/notes/:id`, h(async (req, res) => {
    success(res, '', noteOut(await loadNote(req, req.params.id)));
}));

// PUT /notes/update/:id — draft only; a signed note is immutable (use an addendum).
clinicalNotesRouter.put(`${BASE}/notes/update/:id`, authors, h(async (req, res) => {
    const b = parse(z.object({
        content: contentSchema.optional(),
        richText: z.string().max(100000).optional().nullable(),
        title: z.string().trim().max(200).optional().nullable(),
        linkedOrderIds: z.array(z.string()).optional(),
    }), req.body);
    const existing = await loadNote(req, req.params.id);
    if (existing.status === 'signed') throw conflict('Signed note cannot be modified; use addendum');
    await requireActiveEncounter(req, existing.encounter_id, existing.patient_id);
    const nextContent = b.content ? { ...(existing.content ?? {}), ...b.content } : existing.content ?? {};
    const history = [...(existing.version_history ?? []), { version: (existing.version_history?.length ?? 0) + 1, checksum: checksum(nextContent), editedBy: req.user.id, editedAt: new Date().toISOString() }];
    await query(
        `UPDATE clinical_notes SET content = $1, rich_text = $2, title = $3, version_history = $4, linked_order_ids = $5, updated_at = now() WHERE id = $6`,
        [JSON.stringify(nextContent), b.richText !== undefined ? b.richText : existing.rich_text, b.title !== undefined ? b.title : existing.title,
         JSON.stringify(history), JSON.stringify(b.linkedOrderIds ?? existing.linked_order_ids ?? []), existing.id],
    );
    success(res, 'Note updated', noteOut(await loadNote(req, existing.id)));
}));

// POST /notes/sign/:id — draft → signed; response carries the CMS 24h H&P compliance flag.
clinicalNotesRouter.post(`${BASE}/notes/sign/:id`, signers, h(async (req, res) => {
    const existing = await loadNote(req, req.params.id);
    if (existing.status === 'signed') throw conflict('Note already signed');
    await requireActiveEncounter(req, existing.encounter_id, existing.patient_id);
    await query(`UPDATE clinical_notes SET status = 'signed', signed_by = $1, signed_at = now(), updated_at = now() WHERE id = $2`, [req.user.id, existing.id]);
    const signed = await loadNote(req, existing.id);
    const out = noteOut(signed);
    const late = out.cmsCompliance?.isLate;
    success(res, late ? 'Note signed (H&P signed after the 24-hour CMS window)' : 'Note signed', out);
}));

// POST /notes/addendum/:id — signed notes only; append-only.
clinicalNotesRouter.post(`${BASE}/notes/addendum/:id`, signers, h(async (req, res) => {
    const b = parse(z.object({ text: z.string().trim().min(1).max(20000) }), req.body);
    const existing = await loadNote(req, req.params.id);
    if (existing.status !== 'signed') throw new ApiError(400, 'Addendum only allowed on signed notes');
    await requireActiveEncounter(req, existing.encounter_id, existing.patient_id);
    const addenda = [...(existing.addenda ?? []), { text: b.text, createdBy: req.user.id, createdByName: req.user.name ?? null, createdAt: new Date().toISOString() }];
    await query(`UPDATE clinical_notes SET addenda = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(addenda), existing.id]);
    success(res, 'Addendum saved', noteOut(await loadNote(req, existing.id)));
}));
