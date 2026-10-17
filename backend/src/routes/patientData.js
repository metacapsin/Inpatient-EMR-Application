import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const patientDataRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

async function assertPatient(req, patientId) {
    const r = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
}

// ============================================================ health metrics (vitals)
const METRICS = ['blood_pressure', 'heart_rate', 'temperature', 'oxygen_saturation', 'weight', 'height', 'respiratory_rate', 'glucose'];

const metricOut = (m) => ({
    id: m.id,
    _id: m.id,
    patientId: m.patient_id,
    metricType: m.metric_type,
    valuePrimary: m.value_primary,
    valueSecondary: m.value_secondary,
    unit: m.unit,
    recordedAt: m.recorded_at.toISOString(),
});

patientDataRouter.post('/api/health/metrics/add', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().min(1),
            metricType: z.enum(METRICS),
            valuePrimary: z.coerce.number().finite(),
            valueSecondary: z.coerce.number().finite().optional().nullable(),
            unit: z.string().trim().max(20).default(''),
            recordedAt: z.string().datetime({ offset: true }).or(z.string().datetime({ local: true })).optional(),
        }),
        req.body,
    );
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO health_metrics (tenant_id, patient_id, metric_type, value_primary, value_secondary, unit, recorded_at, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, now()),$8) RETURNING *`,
        [req.user.tenantId, b.patientId, b.metricType, b.valuePrimary, b.valueSecondary ?? null, b.unit, b.recordedAt ?? null, req.user.id],
    );
    created(res, metricOut(r.rows[0]));
}));

patientDataRouter.get('/api/health/metrics/patient/:patientId', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM health_metrics WHERE tenant_id = $1 AND patient_id = $2 ORDER BY recorded_at DESC LIMIT 1000`,
        [req.user.tenantId, req.params.patientId],
    );
    ok(res, r.rows.map(metricOut));
}));

// Latest reading per metric type, keyed by metric type.
patientDataRouter.get('/api/health/metrics/latest', h(async (req, res) => {
    const { patientId } = parse(z.object({ patientId: z.string().min(1) }), req.query);
    const r = await query(
        `SELECT DISTINCT ON (metric_type) * FROM health_metrics
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY metric_type, recorded_at DESC`,
        [req.user.tenantId, patientId],
    );
    ok(res, Object.fromEntries(r.rows.map((m) => [m.metric_type, metricOut(m)])));
}));

patientDataRouter.get('/api/health/metrics/trend', h(async (req, res) => {
    const q = parse(
        z.object({ patientId: z.string().min(1), metricType: z.enum(METRICS), period: z.coerce.number().int().min(1).max(365).default(30) }),
        req.query,
    );
    const r = await query(
        `SELECT to_char(date_trunc('day', recorded_at), 'YYYY-MM-DD') AS date,
                avg(value_primary)::float AS avg_primary, avg(value_secondary)::float AS avg_secondary, count(*)::int AS n
         FROM health_metrics
         WHERE tenant_id = $1 AND patient_id = $2 AND metric_type = $3 AND recorded_at >= now() - ($4 || ' days')::interval
         GROUP BY 1 ORDER BY 1`,
        [req.user.tenantId, q.patientId, q.metricType, String(q.period)],
    );
    ok(res, { metricType: q.metricType, period: q.period, trends: r.rows.map((x) => ({ date: x.date, avgPrimary: x.avg_primary, avgSecondary: x.avg_secondary, count: x.n })) });
}));

// ============================================================ visitors
const visitorOut = (v) => ({
    id: v.id,
    _id: v.id,
    patientId: v.patient_id,
    firstName: v.first_name,
    checkInAt: v.check_in_at?.toISOString() ?? null,
    checkInTime: v.check_in_at?.toISOString() ?? null,
    checkOutAt: v.check_out_at?.toISOString() ?? null,
    checkOutTime: v.check_out_at?.toISOString() ?? null,
    restrictions: v.restrictions,
    status: v.status,
});

// Frontend sends '' for empty timestamps.
const nullableTs = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().datetime({ offset: true }).or(z.string().datetime({ local: true })).nullable());
const visitorBody = z.object({
    patientId: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    checkInAt: nullableTs.optional(),
    checkInTime: nullableTs.optional(),
    checkOutAt: nullableTs.optional(),
    checkOutTime: nullableTs.optional(),
    restrictions: z.string().trim().max(1000).optional().nullable(),
    status: z.string().trim().max(30).default('scheduled'),
});

patientDataRouter.get('/Visitors/getVisitorList', h(async (req, res) => {
    const pid = req.query.patientId ?? req.query.PatientId;
    const params = [req.user.tenantId];
    let sql = 'SELECT * FROM visitors WHERE tenant_id = $1';
    if (typeof pid === 'string' && pid) { params.push(pid); sql += ` AND patient_id = $2`; }
    ok(res, (await query(`${sql} ORDER BY created_at DESC`, params)).rows.map(visitorOut));
}));

patientDataRouter.post('/Visitors/CreateVisitor', clinical, h(async (req, res) => {
    const b = parse(visitorBody, req.body);
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO visitors (tenant_id, patient_id, first_name, check_in_at, check_out_at, restrictions, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.tenantId, b.patientId, b.firstName, b.checkInAt ?? b.checkInTime ?? null, b.checkOutAt ?? b.checkOutTime ?? null, b.restrictions || null, b.status],
    );
    created(res, visitorOut(r.rows[0]));
}));

patientDataRouter.put('/Visitors/updateVisitorById', clinical, h(async (req, res) => {
    const b = parse(visitorBody.extend({ id: z.string().optional(), _id: z.string().optional() }), req.body);
    const id = b.id ?? b._id;
    if (!id) throw parse(z.object({ id: z.string().min(1) }), {});
    const r = await query(
        `UPDATE visitors SET first_name = $1, check_in_at = $2, check_out_at = $3, restrictions = $4, status = $5
         WHERE id = $6 AND tenant_id = $7 RETURNING *`,
        [b.firstName, b.checkInAt ?? b.checkInTime ?? null, b.checkOutAt ?? b.checkOutTime ?? null, b.restrictions || null, b.status, id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Visitor not found');
    ok(res, visitorOut(r.rows[0]));
}));

patientDataRouter.delete('/Visitors/deleteVisitorById/:id', clinical, h(async (req, res) => {
    const r = await query('DELETE FROM visitors WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Visitor not found');
    res.json({ status: 'success', message: 'Visitor deleted' });
}));

// ============================================================ family contacts
const familyOut = (f) => ({
    id: f.id,
    _id: f.id,
    patientId: f.patient_id,
    firstName: f.first_name,
    lastName: f.last_name,
    mobilePhone: f.mobile_phone ?? '',
    emailAddress: f.email_address ?? '',
    relationship: f.relationship ?? '',
    isEmergencyContact: f.is_emergency_contact,
    isAuthorizedForInfo: f.is_authorized_for_info,
    status: f.is_active,
});

const familyBody = z.object({
    patientId: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).default(''),
    mobilePhone: z.string().trim().max(30).default(''),
    emailAddress: z.string().trim().max(200).default('').refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Invalid email'),
    relationship: z.string().trim().max(50).default(''),
    isEmergencyContact: z.boolean().default(false),
    isAuthorizedForInfo: z.boolean().default(true),
    status: z.boolean().default(true),
});

patientDataRouter.get('/PatientFamily/getFamilyContactList', h(async (req, res) => {
    const pid = req.query.patientId ?? req.query.PatientId;
    const params = [req.user.tenantId];
    let sql = 'SELECT * FROM family_contacts WHERE tenant_id = $1 AND is_active';
    if (typeof pid === 'string' && pid) { params.push(pid); sql += ` AND patient_id = $2`; }
    ok(res, (await query(`${sql} ORDER BY is_emergency_contact DESC, created_at`, params)).rows.map(familyOut));
}));

patientDataRouter.post('/PatientFamily/CreateFamilyContact', clinical, h(async (req, res) => {
    const b = parse(familyBody, req.body);
    await assertPatient(req, b.patientId);
    const r = await query(
        `INSERT INTO family_contacts (tenant_id, patient_id, first_name, last_name, mobile_phone, email_address, relationship,
                                      is_emergency_contact, is_authorized_for_info, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.user.tenantId, b.patientId, b.firstName, b.lastName, b.mobilePhone || null, b.emailAddress || null, b.relationship || null, b.isEmergencyContact, b.isAuthorizedForInfo, b.status],
    );
    created(res, familyOut(r.rows[0]));
}));

patientDataRouter.put('/PatientFamily/updateFamilyContactById', clinical, h(async (req, res) => {
    const b = parse(familyBody.extend({ id: z.string().optional(), _id: z.string().optional() }), req.body);
    const id = b.id ?? b._id;
    if (!id) throw parse(z.object({ id: z.string().min(1) }), {});
    const r = await query(
        `UPDATE family_contacts SET first_name=$1, last_name=$2, mobile_phone=$3, email_address=$4, relationship=$5,
                is_emergency_contact=$6, is_authorized_for_info=$7, is_active=$8
         WHERE id=$9 AND tenant_id=$10 RETURNING *`,
        [b.firstName, b.lastName, b.mobilePhone || null, b.emailAddress || null, b.relationship || null, b.isEmergencyContact, b.isAuthorizedForInfo, b.status, id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Family contact not found');
    ok(res, familyOut(r.rows[0]));
}));

patientDataRouter.delete('/PatientFamily/deleteFamilyContactById/:id', clinical, h(async (req, res) => {
    const r = await query('DELETE FROM family_contacts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Family contact not found');
    res.json({ status: 'success', message: 'Family contact deleted' });
}));

