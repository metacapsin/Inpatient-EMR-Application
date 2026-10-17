import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { h, notFound, ok, created, parse, badRequest } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const patientsRouter = Router();

// Patient with its current bed placement (active encounter), as the frontend list/facesheet expects.
const PATIENT_SELECT = `
    SELECT p.*, e.id AS encounter_id, e.bed_id,
           b.label AS bed_label, r.id AS room_id, r.room_number, w.id AS ward_id, w.name AS ward_name
    FROM patients p
    LEFT JOIN encounters e ON e.patient_id = p.id AND e.status <> 'discharged'
    LEFT JOIN beds b ON b.id = e.bed_id
    LEFT JOIN rooms r ON r.id = b.room_id
    LEFT JOIN wards w ON w.id = r.ward_id`;

function patientOut(p) {
    const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
    return {
        id: p.id,
        _id: p.id,
        patientId: p.id,
        mrn: p.mrn,
        firstName: p.first_name,
        middleName: p.middle_name ?? '',
        lastName: p.last_name,
        fullName,
        dOB: p.dob ?? '',
        sex: p.sex ?? '',
        email: p.email ?? '',
        mobilePhone: p.mobile_phone ?? '',
        homePhone: p.home_phone ?? '',
        address1: p.address1 ?? '',
        address2: p.address2 ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
        zipCode: p.zip_code ?? '',
        profilePicture: p.profile_picture ?? '',
        status: p.is_active,
        createdOn: p.created_at?.toISOString?.() ?? p.created_at,
        encounterId: p.encounter_id ?? null,
        wardId: p.ward_id ?? '',
        ward: p.ward_name ?? '',
        roomId: p.room_id ?? '',
        room: p.room_number ?? '',
        bedId: p.bed_id ?? '',
        bed: p.bed_label ?? '',
        ...p.extra,
    };
}

const SORTS = {
    createdOn: 'p.created_at',
    mrn: 'p.mrn',
    dOB: 'p.dob',
    sex: 'p.sex',
    mobilePhone: 'p.mobile_phone',
    ward: 'w.name',
    room: 'r.room_number',
    bed: 'b.label',
    status: 'p.is_active',
    fullName: 'lower(p.last_name), lower(p.first_name)',
};

const AGE_RANGES = { '0-18': [0, 18], '0-17': [0, 17], '19-35': [19, 35], '19-64': [19, 64], '18-64': [18, 64], '65+': [65, 200] };

patientsRouter.get('/Patient/getAllPatientListPaginated', h(async (req, res) => {
    const q = parse(
        z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(200).default(10),
            sortField: z.string().default('createdOn'),
            sortOrder: z.enum(['asc', 'desc']).default('asc'),
            status: z.enum(['true', 'false']).optional(),
            query: z.string().trim().max(100).optional(),
            gender: z.enum(['M', 'F']).optional(),
            ageRange: z.string().optional(),
            recentlyCreated: z.string().optional(),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }),
        req.query,
    );
    const params = [req.user.tenantId];
    const where = ['p.tenant_id = $1'];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (q.status) add('p.is_active = ?', q.status === 'true');
    if (q.gender) add('p.sex = ?', q.gender);
    if (q.query) {
        params.push(`%${q.query.replace(/[\\%_]/g, '\\$&')}%`);
        const n = params.length;
        where.push(`(p.first_name || ' ' || p.last_name ILIKE $${n} OR p.mrn ILIKE $${n} OR COALESCE(p.email,'') ILIKE $${n} OR COALESCE(p.mobile_phone,'') ILIKE $${n})`);
    }
    const age = AGE_RANGES[q.ageRange];
    if (age) {
        params.push(age[0], age[1]);
        where.push(`p.dob IS NOT NULL AND date_part('year', age(p.dob)) BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (q.startDate) add('p.created_at >= ?::date', q.startDate);
    if (q.endDate) add(`p.created_at < (?::date + 1)`, q.endDate);

    const orderBy = SORTS[q.sortField] ?? SORTS.createdOn;
    const dir = q.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const orderSql = orderBy.split(',').map((c) => `${c.trim()} ${dir}`).join(', ');
    const recent = q.recentlyCreated === 'last5recent';
    const limit = recent ? Math.min(5, q.limit) : q.limit;

    const total = (await query(`SELECT count(*)::int AS n FROM patients p
        LEFT JOIN encounters e ON e.patient_id = p.id AND e.status <> 'discharged'
        LEFT JOIN beds b ON b.id = e.bed_id LEFT JOIN rooms r ON r.id = b.room_id LEFT JOIN wards w ON w.id = r.ward_id
        WHERE ${where.join(' AND ')}`, params)).rows[0].n;
    params.push(limit, (q.page - 1) * q.limit);
    const r = await query(
        `${PATIENT_SELECT} WHERE ${where.join(' AND ')}
         ORDER BY ${recent ? 'p.created_at DESC' : orderSql}, p.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
    );
    ok(res, { items: r.rows.map(patientOut), total: recent ? Math.min(total, 5) : total, page: q.page, limit: q.limit });
}));

async function getOne(req, res) {
    const r = await query(`${PATIENT_SELECT} WHERE p.id = $1 AND p.tenant_id = $2`, [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
    ok(res, patientOut(r.rows[0]));
}
patientsRouter.get('/Patient/getPatientById/:id', h(getOne));
patientsRouter.get('/Patient/getPatientDemographics/:id', h(getOne));
patientsRouter.get('/patient/getPatientByID/:id', h(getOne));

const sexSchema = z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase().slice(0, 1) : v), z.enum(['M', 'F', 'O', 'U']));
const optStr = (n = 200) => z.string().trim().max(n).optional().nullable();
const patientBody = z.object({
    mrn: z.string().trim().min(1).max(40).optional(),
    firstName: z.string().trim().min(1).max(100),
    middleName: optStr(100),
    lastName: z.string().trim().min(1).max(100),
    dOB: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'dOB must be YYYY-MM-DD').optional().nullable(),
    sex: sexSchema.optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal('')),
    mobilePhone: optStr(30),
    homePhone: optStr(30),
    address1: optStr(), address2: optStr(), city: optStr(100), state: optStr(50), zipCode: optStr(20),
    status: z.boolean().optional(),
});

const clinicalWriters = requireRole('physician', 'nurse', 'staff');

patientsRouter.post('/Patient/createPatient', clinicalWriters, h(async (req, res) => {
    const b = parse(patientBody, req.body);
    // MRN: caller-supplied, otherwise sequential per tenant.
    let mrn = b.mrn;
    if (!mrn) {
        const n = (await query(`SELECT count(*)::int + 1 AS n FROM patients WHERE tenant_id = $1`, [req.user.tenantId])).rows[0].n;
        mrn = `MRN${String(n).padStart(6, '0')}`;
    }
    const r = await query(
        `INSERT INTO patients (tenant_id, mrn, first_name, middle_name, last_name, dob, sex, email, mobile_phone, home_phone,
                               address1, address2, city, state, zip_code, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16,true)) RETURNING id`,
        [req.user.tenantId, mrn, b.firstName, b.middleName || null, b.lastName, b.dOB || null, b.sex ?? null, b.email || null,
         b.mobilePhone || null, b.homePhone || null, b.address1 || null, b.address2 || null, b.city || null, b.state || null, b.zipCode || null, b.status ?? null],
    );
    const p = (await query(`${PATIENT_SELECT} WHERE p.id = $1`, [r.rows[0].id])).rows[0];
    created(res, patientOut(p));
}));

patientsRouter.put('/Patient/updatePatientById/:id', clinicalWriters, h(async (req, res) => {
    const b = parse(patientBody.partial(), req.body);
    const sets = [];
    const params = [];
    const map = { mrn: 'mrn', firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name', dOB: 'dob', sex: 'sex', email: 'email',
        mobilePhone: 'mobile_phone', homePhone: 'home_phone', address1: 'address1', address2: 'address2', city: 'city', state: 'state', zipCode: 'zip_code', status: 'is_active' };
    for (const [k, col] of Object.entries(map)) {
        if (b[k] !== undefined) { params.push(b[k] === '' ? null : b[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (!sets.length) throw badRequest('No fields to update');
    params.push(req.params.id, req.user.tenantId);
    const r = await query(`UPDATE patients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING id`, params);
    if (!r.rowCount) throw notFound('Patient not found');
    ok(res, patientOut((await query(`${PATIENT_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0]));
}));

// Soft delete only: clinical records must be retained.
patientsRouter.delete('/Patient/deletePatientById/:id', requireRole(), h(async (req, res) => {
    const active = await query(`SELECT 1 FROM encounters WHERE patient_id = $1 AND status <> 'discharged'`, [req.params.id]);
    if (active.rowCount) throw badRequest('Patient has an active admission; discharge before deactivating');
    const r = await query('UPDATE patients SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
    res.json({ status: 'success', message: 'Patient deactivated' });
}));
