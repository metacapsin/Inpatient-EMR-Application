import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

// Patient record lists: documents, allergies, immunizations, history, lab orders, lab results.
export const recordsRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');
const prescriber = requireRole('physician', 'nurse');

async function assertPatient(req, patientId) {
    const r = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD').transform((s) => s.slice(0, 10));
const optDate = z.preprocess((v) => (v === '' ? null : v), isoDate.nullable().optional());
const optText = (max = 500) => z.string().trim().max(max).optional().nullable();
const dateOf = (v) => (v ? String(v).slice(0, 10) : '');

// ================================================================= documents
const docOut = (d) => ({
    id: d.id,
    _id: d.id,
    patientId: d.patient_id,
    name: d.name,
    documentName: d.name,
    documentType: d.document_type ?? '',
    notes: d.notes ?? '',
    date: dateOf(d.document_date),
    createdAt: d.created_at.toISOString(),
    mimeType: d.mime_type,
    size: d.size ?? 0,
    hasContent: (d.size ?? 0) > 0,
    fileURL: `/Patient/downloadDocument/${d.id}`,
});
const DOC_COLS = `id, patient_id, name, document_type, notes, mime_type, document_date, created_at, coalesce(octet_length(content),0) AS size`;

recordsRouter.get('/Patient/getAllDocument/:patientId', h(async (req, res) => {
    const r = await query(`SELECT ${DOC_COLS} FROM patient_documents WHERE tenant_id = $1 AND patient_id = $2 ORDER BY document_date DESC, created_at DESC`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(docOut));
}));

recordsRouter.get('/Patient/getDocumentById/:id', h(async (req, res) => {
    const r = await query(`SELECT ${DOC_COLS} FROM patient_documents WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Document not found');
    ok(res, docOut(r.rows[0]));
}));

recordsRouter.get('/Patient/downloadDocument/:id', h(async (req, res) => {
    const r = await query('SELECT name, mime_type, content FROM patient_documents WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Document not found');
    if (!r.rows[0].content) throw notFound('This document has no stored file');
    res.set({
        'Content-Type': r.rows[0].mime_type,
        'Content-Disposition': `attachment; filename="${r.rows[0].name.replace(/[^\w.\- ]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
    });
    res.send(r.rows[0].content);
}));

// File bytes arrive base64-encoded (raw or as a data URL); the JSON body limit (2 MB) caps the file size.
recordsRouter.post('/Patient/uploadDocument', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            name: z.string().trim().min(1).max(200),
            documentType: optText(60),
            notes: optText(2000),
            documentDate: optDate,
            mimeType: z.string().trim().max(100).regex(/^[\w.+-]+\/[\w.+-]+$/, 'Invalid mime type').default('application/octet-stream'),
            contentBase64: z.string().max(2_000_000).optional(),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    let content = null;
    let mime = b.mimeType;
    if (b.contentBase64) {
        const m = /^data:([\w.+-]+\/[\w.+-]+);base64,(.*)$/s.exec(b.contentBase64);
        const raw = m ? m[2] : b.contentBase64;
        if (m) mime = m[1];
        if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) throw badRequest('contentBase64 is not valid base64');
        content = Buffer.from(raw, 'base64');
    }
    const r = await query(
        `INSERT INTO patient_documents (tenant_id, patient_id, name, document_type, notes, mime_type, content, document_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9) RETURNING id`,
        [req.user.tenantId, b.patientId, b.name, b.documentType || null, b.notes || null, mime, content, b.documentDate ?? null, req.user.id],
    );
    const d = (await query(`SELECT ${DOC_COLS} FROM patient_documents WHERE id = $1`, [r.rows[0].id])).rows[0];
    created(res, docOut(d));
}));

recordsRouter.delete('/Patient/deleteDocumentById/:id', clinical, h(async (req, res) => {
    const r = await query('DELETE FROM patient_documents WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Document not found');
    res.json({ status: 'success', message: 'Document deleted' });
}));

// ================================================================= allergies
// Emitted in the nested eRx shape the Allergies page parses, plus flat fields for other consumers.
const allergyOut = (a) => {
    const date = dateOf(a.onset_date);
    return {
        id: a.id,
        _id: a.id,
        patientId: a.patient_id,
        allergyName: a.allergen,
        allergyType: a.allergy_type,
        reaction: a.reaction ?? '',
        severity: a.severity ?? '',
        onsetDate: date,
        status: a.is_active,
        Allergen: [{ Name: [a.allergen], ...(a.allergy_type === 'Ingredient' ? { Ingredient: [a.allergen] } : { Drug: [a.allergen] }) }],
        ReactionList: a.reaction ? [{ Reaction: [{ Description: [a.reaction] }] }] : [],
        Severity: a.severity ? [{ Description: [a.severity] }] : [],
        OnsetDate: date ? [date] : [],
        Status: [a.is_active ? { Active: ['true'] } : { Inactive: ['true'] }],
    };
};

const allergyBody = z.object({
    patientId: z.string().min(1),
    allergyName: z.string().trim().min(1).max(200),
    allergyType: z.enum(['Drug', 'Ingredient', 'Food', 'Environmental', 'Other']).default('Drug'),
    reaction: optText(500),
    severity: z.enum(['Mild', 'Moderate', 'Severe', 'Life-threatening']).optional().nullable(),
    onsetDate: optDate,
    status: z.boolean().default(true),
});

recordsRouter.get('/Patient/getAllAllergyList', h(async (req, res) => {
    const { rcopiaID } = parse(z.object({ rcopiaID: z.string().min(1) }), req.query);
    const r = await query('SELECT * FROM patient_allergies WHERE tenant_id = $1 AND patient_id = $2 ORDER BY is_active DESC, created_at DESC', [req.user.tenantId, rcopiaID]);
    ok(res, r.rows.map(allergyOut));
}));

recordsRouter.post('/Patient/createAllergy', prescriber, h(async (req, res) => {
    const b = parse(allergyBody, req.body);
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO patient_allergies (tenant_id, patient_id, allergen, allergy_type, reaction, severity, onset_date, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.tenantId, b.patientId, b.allergyName, b.allergyType, b.reaction || null, b.severity ?? null, b.onsetDate ?? null, b.status],
    );
    created(res, allergyOut(r.rows[0]));
}));

recordsRouter.put('/Patient/updateAllergy/:id', prescriber, h(async (req, res) => {
    const b = parse(allergyBody.omit({ patientId: true }), req.body);
    const r = await query(
        `UPDATE patient_allergies SET allergen=$1, allergy_type=$2, reaction=$3, severity=$4, onset_date=$5, is_active=$6 WHERE id=$7 AND tenant_id=$8 RETURNING *`,
        [b.allergyName, b.allergyType, b.reaction || null, b.severity ?? null, b.onsetDate ?? null, b.status, req.params.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Allergy not found');
    ok(res, allergyOut(r.rows[0]));
}));

recordsRouter.delete('/Patient/deleteAllergy/:id', prescriber, h(async (req, res) => {
    const r = await query('DELETE FROM patient_allergies WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Allergy not found');
    res.json({ status: 'success', message: 'Allergy deleted' });
}));

// ================================================================= immunizations
const immOut = (i) => ({
    id: i.id,
    _id: i.id,
    patientId: i.patient_id,
    vaccineName: i.vaccine_name,
    vaccineText: i.vaccine_name,
    vaccineType: i.vaccine_type ?? '',
    dose: i.dose ?? '',
    unit: i.unit ?? '',
    routes: i.route ?? '',
    numberInSeries: i.number_in_series,
    consentObtained: i.consent_obtained,
    comments: i.comments ?? '',
    orderedDate: dateOf(i.ordered_date),
    orderedTime: i.ordered_time ?? '',
    provider: i.provider ?? '',
    serviceLocation: i.service_location ?? '',
});

const immBody = z.object({
    patientId: z.string().min(1),
    vaccineName: z.string().trim().min(1).max(200),
    vaccineType: optText(100),
    dose: optText(50),
    unit: optText(30),
    routes: optText(50),
    numberInSeries: z.coerce.number().int().min(1).max(20).optional().nullable(),
    consentObtained: z.array(z.string().trim().max(100)).max(10).default([]),
    comments: optText(1000),
    orderedDate: optDate,
    orderedTime: optText(20),
    provider: optText(200),
    serviceLocation: optText(200),
});

recordsRouter.get('/Patient/getPatientImmunizationList/:patientId', h(async (req, res) => {
    const r = await query('SELECT * FROM patient_immunizations WHERE tenant_id = $1 AND patient_id = $2 ORDER BY ordered_date DESC NULLS LAST, created_at DESC', [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(immOut));
}));

recordsRouter.get('/Patient/getPatientImmunizationById/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM patient_immunizations WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Immunization not found');
    ok(res, immOut(r.rows[0]));
}));

recordsRouter.get('/Patient/downloadImmunization/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM patient_immunizations WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Immunization not found');
    const i = immOut(r.rows[0]);
    const text = [`Immunization record`, `Vaccine: ${i.vaccineName}`, `Type: ${i.vaccineType}`, `Dose: ${i.dose} ${i.unit}`.trim(), `Route: ${i.routes}`, `Series #: ${i.numberInSeries ?? ''}`, `Date: ${i.orderedDate} ${i.orderedTime}`.trim(), `Provider: ${i.provider}`, `Location: ${i.serviceLocation}`, `Comments: ${i.comments}`].join('\n');
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="immunization.txt"' });
    res.send(text);
}));

recordsRouter.post('/Patient/createImmunization', prescriber, h(async (req, res) => {
    const b = parse(immBody, req.body);
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO patient_immunizations (tenant_id, patient_id, vaccine_name, vaccine_type, dose, unit, route, number_in_series, consent_obtained,
                                            comments, ordered_date, ordered_time, provider, service_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [req.user.tenantId, b.patientId, b.vaccineName, b.vaccineType || null, b.dose || null, b.unit || null, b.routes || null, b.numberInSeries ?? null,
         JSON.stringify(b.consentObtained), b.comments || null, b.orderedDate ?? null, b.orderedTime || null, b.provider || null, b.serviceLocation || null],
    );
    created(res, immOut(r.rows[0]));
}));

recordsRouter.delete('/Patient/deleteImmunization/:id', prescriber, h(async (req, res) => {
    const r = await query('DELETE FROM patient_immunizations WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Immunization not found');
    res.json({ status: 'success', message: 'Immunization deleted' });
}));

// ================================================================= history
const DEFAULT_CATEGORIES = ['Medical', 'Surgical', 'Family', 'Social', 'Obstetric'];

const histOut = (x) => ({
    id: x.id,
    _id: x.id,
    patientId: x.patient_id,
    categoryId: x.category_id,
    category: x.category_id ? { _id: x.category_id, id: x.category_id, name: x.category_name } : null,
    categoryName: x.category_name ?? '',
    conditions: x.conditions,
    diagonosisDate: dateOf(x.diagnosis_date), // field spelling matches the existing frontend contract
    diagnosisDate: dateOf(x.diagnosis_date),
    notes: x.notes ?? '',
});
const HIST_SELECT = `SELECT x.*, c.name AS category_name FROM patient_history x LEFT JOIN history_categories c ON c.id = x.category_id`;

recordsRouter.get('/Patient/getAllHistoryCategories', h(async (req, res) => {
    // Categories are created on first use so a new tenant gets the standard set.
    await query(
        `INSERT INTO history_categories (tenant_id, name) SELECT $1, n FROM unnest($2::text[]) AS n ON CONFLICT (tenant_id, name) DO NOTHING`,
        [req.user.tenantId, DEFAULT_CATEGORIES],
    );
    const r = await query('SELECT id, name FROM history_categories WHERE tenant_id = $1 ORDER BY name', [req.user.tenantId]);
    ok(res, r.rows.map((c) => ({ id: c.id, _id: c.id, name: c.name })));
}));

recordsRouter.get('/Patient/getAllPatientHistory/:patientId', h(async (req, res) => {
    const r = await query(`${HIST_SELECT} WHERE x.tenant_id = $1 AND x.patient_id = $2 ORDER BY x.diagnosis_date DESC NULLS LAST, x.created_at DESC`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(histOut));
}));

recordsRouter.get('/Patient/getPatientHistoryById/:id', h(async (req, res) => {
    const r = await query(`${HIST_SELECT} WHERE x.id = $1 AND x.tenant_id = $2`, [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('History record not found');
    ok(res, histOut(r.rows[0]));
}));

recordsRouter.post('/Patient/createPatientHistory', prescriber, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            categoryId: z.string().optional().nullable(),
            conditions: z.string().trim().min(1).max(1000),
            diagonosisDate: optDate,
            diagnosisDate: optDate,
            notes: optText(2000),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    if (b.categoryId && !(await query('SELECT 1 FROM history_categories WHERE id = $1 AND tenant_id = $2', [b.categoryId, req.user.tenantId])).rowCount) throw notFound('Category not found');
    const r = await query(
        `INSERT INTO patient_history (tenant_id, patient_id, category_id, conditions, diagnosis_date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [req.user.tenantId, b.patientId, b.categoryId || null, b.conditions, b.diagonosisDate ?? b.diagnosisDate ?? null, b.notes || null],
    );
    created(res, histOut((await query(`${HIST_SELECT} WHERE x.id = $1`, [r.rows[0].id])).rows[0]));
}));

recordsRouter.delete('/Patient/deletePatientHistory/:id', prescriber, h(async (req, res) => {
    const r = await query('DELETE FROM patient_history WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('History record not found');
    res.json({ status: 'success', message: 'History record deleted' });
}));

// ================================================================= lab orders
const labOrderOut = (o) => ({
    id: o.id,
    _id: o.id,
    labOrderId: o.id,
    patientId: o.patient_id,
    encounterId: o.encounter_id,
    labTests: o.lab_tests,
    testName: o.lab_tests.map((t) => t.name).filter(Boolean).join(', '),
    orderDate: dateOf(o.order_date),
    orderStatus: o.order_status,
    status: o.order_status,
    priority: o.priority,
    orderingProviderName: o.ordering_provider_name ?? '',
    officeNotes: o.office_notes ?? '',
    patientContactNotes: o.patient_contact_notes ?? '',
    createdAt: o.created_at.toISOString(),
});

const labBody = z.object({
    patientId: z.string().min(1),
    encounterId: z.string().optional().nullable(),
    labTests: z.array(z.object({ name: z.string().trim().min(1).max(200), code: optText(30), specimen: optText(60) })).min(1).max(50),
    orderDate: optDate,
    priority: z.enum(['Routine', 'Urgent', 'STAT']).default('Routine'),
    orderingProviderName: optText(200),
    officeNotes: optText(2000),
    patientContactNotes: optText(2000),
});
const LAB_STATUSES = ['Ordered', 'Collected', 'In Progress', 'Resulted', 'Cancelled'];

recordsRouter.get('/lab-orders/by-patient/:patientId', h(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(1000).default(20) }), req.query);
    const where = 'tenant_id = $1 AND patient_id = $2';
    const total = (await query(`SELECT count(*)::int AS n FROM lab_orders WHERE ${where}`, [req.user.tenantId, req.params.patientId])).rows[0].n;
    const r = await query(`SELECT * FROM lab_orders WHERE ${where} ORDER BY order_date DESC, created_at DESC LIMIT $3 OFFSET $4`, [req.user.tenantId, req.params.patientId, q.limit, (q.page - 1) * q.limit]);
    ok(res, { orders: r.rows.map(labOrderOut), total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) });
}));

recordsRouter.get('/lab-orders/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Lab order not found');
    ok(res, labOrderOut(r.rows[0]));
}));

recordsRouter.post('/lab-orders', prescriber, h(async (req, res) => {
    const b = parse(labBody, req.body);
    await assertPatient(req, b.patientId);
    if (b.encounterId && !(await query('SELECT 1 FROM encounters WHERE id = $1 AND tenant_id = $2 AND patient_id = $3', [b.encounterId, req.user.tenantId, b.patientId])).rowCount) throw notFound('Encounter not found for this patient');
    const r = await query(
        `INSERT INTO lab_orders (tenant_id, patient_id, encounter_id, lab_tests, order_date, priority, ordering_provider_name, office_notes, patient_contact_notes, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId || null, JSON.stringify(b.labTests), b.orderDate ?? null, b.priority, b.orderingProviderName || req.user.name || null, b.officeNotes || null, b.patientContactNotes || null, req.user.id],
    );
    created(res, labOrderOut(r.rows[0]));
}));

recordsRouter.put('/lab-orders/:id', prescriber, h(async (req, res) => {
    const b = parse(
        z.object({ orderStatus: z.enum(LAB_STATUSES).optional(), officeNotes: optText(2000), patientContactNotes: optText(2000), priority: z.enum(['Routine', 'Urgent', 'STAT']).optional() }),
        req.body,
    );
    const r = await query(
        `UPDATE lab_orders SET order_status = COALESCE($1, order_status), office_notes = COALESCE($2, office_notes),
                patient_contact_notes = COALESCE($3, patient_contact_notes), priority = COALESCE($4, priority), updated_at = now()
         WHERE id = $5 AND tenant_id = $6 RETURNING *`,
        [b.orderStatus ?? null, b.officeNotes ?? null, b.patientContactNotes ?? null, b.priority ?? null, req.params.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Lab order not found');
    ok(res, labOrderOut(r.rows[0]));
}));

// ================================================================= lab results (documents)
const labDocOut = (l) => ({
    id: l.id,
    _id: l.id,
    patientId: l.patient_id,
    name: l.name,
    labName: l.lab_name ?? '',
    value: l.value ?? '',
    unit: l.unit ?? '',
    referenceRange: l.reference_range ?? '',
    notes: l.notes ?? '',
    date: dateOf(l.lab_date),
    status: l.is_active,
});

recordsRouter.get('/LabDetails/getAllLabDocuments/:patientId', h(async (req, res) => {
    const r = await query('SELECT * FROM lab_documents WHERE tenant_id = $1 AND patient_id = $2 ORDER BY lab_date DESC, created_at DESC', [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(labDocOut));
}));

recordsRouter.get('/LabDetails/getLabDocumentById/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM lab_documents WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Lab result not found');
    ok(res, labDocOut(r.rows[0]));
}));

recordsRouter.get('/LabDetails/downloadLabDocument/:id', h(async (req, res) => {
    const r = await query('SELECT * FROM lab_documents WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Lab result not found');
    const l = labDocOut(r.rows[0]);
    const text = [`Lab result`, `Test: ${l.name}`, `Lab: ${l.labName}`, `Date: ${l.date}`, `Result: ${l.value} ${l.unit}`.trim(), `Reference range: ${l.referenceRange}`, `Notes: ${l.notes}`].join('\n');
    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="lab-result.txt"' });
    res.send(text);
}));

recordsRouter.post('/LabDetails/createLabDocument', prescriber, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            name: z.string().trim().min(1).max(200),
            labName: optText(200),
            value: optText(100),
            unit: optText(30),
            referenceRange: optText(100),
            notes: optText(2000),
            date: optDate,
            status: z.boolean().default(true),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO lab_documents (tenant_id, patient_id, name, lab_name, value, unit, reference_range, notes, lab_date, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date, CURRENT_DATE),$10) RETURNING *`,
        [req.user.tenantId, b.patientId, b.name, b.labName || null, b.value || null, b.unit || null, b.referenceRange || null, b.notes || null, b.date ?? null, b.status],
    );
    created(res, labDocOut(r.rows[0]));
}));
