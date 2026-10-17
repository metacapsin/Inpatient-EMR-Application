import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const consentRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

const REQUIRED_DISCHARGE_CONSENTS = ['General Treatment', 'HIPAA NPP'];
const CONSENT_TYPES = ['General Treatment', 'Surgery', 'Anesthesia', 'Blood Products', 'Research', 'HIPAA NPP', 'Procedure-Specific', 'Telemedicine'];
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

// The consent record is stored as indexed columns (status/type/dates) plus a JSONB bag for the remaining form fields.
function consentOut(c) {
    const today = new Date().toISOString().slice(0, 10);
    const expired = c.status === 'Signed' && c.expiry_date && c.expiry_date < today;
    return {
        capacityAssessmentNote: null,
        interpreterType: null,
        linkedProcedureNoteId: null,
        ...c.data,
        consentId: c.consent_id,
        patientId: c.patient_id,
        encounterId: c.encounter_id,
        tenantId: c.tenant_id,
        consentType: c.consent_type,
        status: expired ? 'Expired' : c.status,
        signedAt: iso(c.signed_at),
        expiryDate: c.expiry_date,
        revokedAt: iso(c.revoked_at),
        revokedReason: c.revoked_reason,
        updatedAt: iso(c.updated_at),
    };
}

const nullableStr = (n = 500) => z.string().max(n).nullable().optional();
const consentBody = z.object({
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    consentType: z.enum(CONSENT_TYPES),
    procedureName: nullableStr(300),
    templateVersion: z.string().max(50).default('v1'),
    templateS3Key: nullableStr(),
    signedByType: z.enum(['Patient', 'Legal Guardian', 'Healthcare Proxy', 'Power of Attorney']),
    signedByName: z.string().trim().min(1).max(200),
    signedByRelationship: nullableStr(100),
    patientHasCapacity: z.boolean(),
    capacityAssessmentNote: nullableStr(2000),
    interpreterUsed: z.boolean().default(false),
    interpreterName: nullableStr(200),
    interpreterType: z.enum(['In-person', 'Phone', 'Video']).nullable().optional(),
    languageUsed: z.string().max(50).default('English'),
    patientSignatureData: nullableStr(500_000),
    witnessSignatureData: nullableStr(500_000),
    witnessId: nullableStr(100),
    witnessName: nullableStr(200),
    signedAt: nullableStr(40),
    status: z.enum(['Signed', 'Pending', 'Revoked', 'Expired']).default('Pending'),
    expiryDate: nullableStr(10),
    revokedAt: nullableStr(40),
    revokedReason: nullableStr(1000),
    signedPdfS3Key: nullableStr(),
    obtainedBy: nullableStr(100),
    obtainedByName: nullableStr(200),
    linkedProcedureNoteId: nullableStr(100),
});

const COLUMN_KEYS = ['patientId', 'encounterId', 'tenantId', 'consentType', 'status', 'signedAt', 'expiryDate', 'revokedAt', 'revokedReason'];

async function encounterBelongs(req, encounterId, patientId) {
    const r = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [encounterId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Encounter not found');
    if (r.rows[0].patient_id !== patientId) throw badRequest('patientId does not match the encounter');
}

consentRouter.post('/api/Consent/create', clinical, h(async (req, res) => {
    const b = parse(consentBody, req.body);
    await encounterBelongs(req, b.encounterId, b.patientId);
    if (b.status === 'Signed' && !b.signedAt) b.signedAt = new Date().toISOString();
    const data = Object.fromEntries(Object.entries(b).filter(([k]) => !COLUMN_KEYS.includes(k)));
    const r = await query(
        `INSERT INTO consents (tenant_id, patient_id, encounter_id, consent_type, status, signed_at, expiry_date, revoked_at, revoked_reason, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.tenantId, b.patientId, b.encounterId, b.consentType, b.status, b.signedAt || null, b.expiryDate || null, b.revokedAt || null, b.revokedReason || null, JSON.stringify(data)],
    );
    res.status(201).json(consentOut(r.rows[0]));
}));

consentRouter.get('/api/Consent/completeness/:encounterId', h(async (req, res) => {
    const r = await query(
        `SELECT DISTINCT consent_type FROM consents
         WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'Signed' AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)`,
        [req.user.tenantId, req.params.encounterId],
    );
    const signed = new Set(r.rows.map((x) => x.consent_type));
    const missing = REQUIRED_DISCHARGE_CONSENTS.filter((t) => !signed.has(t));
    res.json({ required: REQUIRED_DISCHARGE_CONSENTS, missing, complete: missing.length === 0 });
}));

consentRouter.get('/api/Consent/encounter/:encounterId', h(async (req, res) => {
    const r = await query(`SELECT * FROM consents WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY created_at DESC`, [req.user.tenantId, req.params.encounterId]);
    ok(res, r.rows.map(consentOut));
}));

consentRouter.put('/api/Consent/:consentId/sign', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientSignatureData: z.string().min(1).max(500_000),
            witnessSignatureData: z.string().min(1).max(500_000),
            witnessId: z.string().max(100).default(''),
            witnessName: z.string().trim().min(1).max(200),
            signedAt: z.string().max(40).optional(),
            signedPdfS3Key: nullableStr(),
        }),
        req.body,
    );
    const cur = (await query('SELECT * FROM consents WHERE consent_id = $1 AND tenant_id = $2', [req.params.consentId, req.user.tenantId])).rows[0];
    if (!cur) throw notFound('Consent not found');
    if (cur.status !== 'Pending') throw conflict(`A ${cur.status.toLowerCase()} consent cannot be signed`);
    const patch = { patientSignatureData: b.patientSignatureData, witnessSignatureData: b.witnessSignatureData, witnessId: b.witnessId, witnessName: b.witnessName, signedPdfS3Key: b.signedPdfS3Key ?? null };
    const r = await query(
        `UPDATE consents SET status = 'Signed', signed_at = COALESCE($1::timestamptz, now()), data = data || $2::jsonb, updated_at = now()
         WHERE consent_id = $3 RETURNING *`,
        [b.signedAt ?? null, JSON.stringify(patch), cur.consent_id],
    );
    res.json(consentOut(r.rows[0]));
}));

consentRouter.put('/api/Consent/:consentId/revoke', clinical, h(async (req, res) => {
    const { revokedReason } = parse(z.object({ revokedReason: z.string().trim().min(1, 'A revocation reason is required').max(1000) }), req.body);
    const r = await query(
        `UPDATE consents SET status = 'Revoked', revoked_at = now(), revoked_reason = $1, updated_at = now()
         WHERE consent_id = $2 AND tenant_id = $3 AND status IN ('Signed','Pending') RETURNING *`,
        [revokedReason, req.params.consentId, req.user.tenantId],
    );
    if (!r.rowCount) {
        const exists = await query('SELECT status FROM consents WHERE consent_id = $1 AND tenant_id = $2', [req.params.consentId, req.user.tenantId]);
        if (!exists.rowCount) throw notFound('Consent not found');
        throw conflict(`A ${exists.rows[0].status.toLowerCase()} consent cannot be revoked`);
    }
    res.json(consentOut(r.rows[0]));
}));

// ------------------------------------------------------------ patient rights
const rightsOut = (p) => ({
    ...p.data,
    id: p.id,
    patientId: p.patient_id,
    requestType: p.request_type,
    createdAt: iso(p.created_at),
    updatedAt: iso(p.updated_at),
});

consentRouter.get('/api/PatientRights/:patientId', h(async (req, res) => {
    const r = await query('SELECT * FROM patient_rights_requests WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC', [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(rightsOut));
}));

consentRouter.post('/api/PatientRights/request', clinical, h(async (req, res) => {
    const { patientId, requestType, ...rest } = parse(
        z
            .object({
                patientId: z.string().min(1),
                requestType: z.enum(['Access Request', 'Amendment Request', 'Restriction Request', 'Accounting of Disclosures', 'Patient Representative Designation']),
                access: z.record(z.string(), z.unknown()).optional(),
                amendment: z.record(z.string(), z.unknown()).optional(),
                restriction: z.record(z.string(), z.unknown()).optional(),
                disclosures: z.array(z.record(z.string(), z.unknown())).optional(),
                representative: z.record(z.string(), z.unknown()).optional(),
            }),
        req.body,
    );
    const p = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!p.rowCount) throw notFound('Patient not found');
    const r = await query(
        `INSERT INTO patient_rights_requests (tenant_id, patient_id, request_type, data) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user.tenantId, patientId, requestType, JSON.stringify(rest)],
    );
    res.status(201).json(rightsOut(r.rows[0]));
}));
