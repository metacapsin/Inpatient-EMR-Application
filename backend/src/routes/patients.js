import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { h, notFound, ok, created, parse, badRequest, conflict } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { boss, QUEUES } from '../db/queue.js';
import { runForPatient, runInline } from '../lib/eligibility.js';
import { isEnabled as stediEnabled } from '../lib/stedi.js';

export const patientsRouter = Router();

/**
 * Runs real-time eligibility (Stedi 270/271) for a newly-registered patient's insurance slots and
 * files the results as eligibility_checks history. Never fails patient creation: with Stedi
 * unconfigured every slot reports 'skipped'; with no insurance on file there is nothing to check.
 * `eligible` is true when every checked slot is active, false when any slot is inactive, null otherwise.
 */
async function checkEligibility(patient, { tenantId, userId }) {
    try {
        const slots = await runForPatient({ patient, tenantId, userId });
        const statuses = Object.values(slots).map((s) => s.status);
        const eligible = !statuses.length ? null : statuses.every((s) => s === 'active') ? true : statuses.includes('inactive') ? false : null;
        return { eligible, stediEnabled: stediEnabled(), ...slots };
    } catch (e) {
        console.error('[eligibility] post-create check failed:', e.message);
        return { eligible: null, stediEnabled: stediEnabled(), error: e.message };
    }
}

/** Best-effort: queues a demographics sync to Rcopia. Never fails patient creation if the queue is down. */
async function enqueueRcopiaSync(patient) {
    try {
        await boss.send(QUEUES.RCOPIA_PATIENT_SYNC, {
            patientId: patient.id,
            tenantId: patient.tenant_id,
            mrn: patient.mrn,
            firstName: patient.first_name,
            lastName: patient.last_name,
            dob: patient.dob,
            sex: patient.sex,
            email: patient.email,
            mobilePhone: patient.mobile_phone,
            homePhone: patient.home_phone,
            workPhone: patient.work_phone,
            prefix: patient.prefix,
            middleName: patient.middle_name,
            suffix: patient.suffix,
            address1: patient.address1,
            address2: patient.address2,
            city: patient.city,
            state: patient.state,
            zipCode: patient.zip_code,
            preferredLanguage: patient.preferred_language,
            maritalStatus: patient.marital_status,
        });
    } catch (e) {
        console.error('[rcopia-sync] failed to enqueue:', e.message);
    }
}

// Patient with its current bed placement (active encounter), as the frontend list/facesheet expects.
// Insurance (both ranks) and emergency contacts (both ranks) ride along as JSON aggregates so every
// read endpoint — single, demographics alias, paginated list — returns the same enriched shape.
const PATIENT_SELECT = `
    SELECT p.*, e.id AS encounter_id, e.bed_id,
           b.label AS bed_label, r.id AS room_id, r.room_number, w.id AS ward_id, w.name AS ward_name,
           (SELECT json_agg(i ORDER BY i.rank) FROM patient_insurance i WHERE i.patient_id = p.id) AS insurance_rows,
           (SELECT json_agg(c ORDER BY c.rank) FROM patient_emergency_contacts c WHERE c.patient_id = p.id) AS emergency_rows
    FROM patients p
    LEFT JOIN encounters e ON e.patient_id = p.id AND e.status <> 'discharged'
    LEFT JOIN beds b ON b.id = e.bed_id
    LEFT JOIN rooms r ON r.id = b.room_id
    LEFT JOIN wards w ON w.id = r.ward_id`;

const titleCase = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

/** patient_insurance row -> the legacy-shaped insurance object the Demographics tab already reads. */
function insuranceOut(i) {
    if (!i) return null;
    return {
        id: i.id,
        rank: i.rank,
        insuranceType: i.insurance_type ?? '',
        insuranceCompany: i.company_name ?? '',
        tradingPartnerServiceId: i.trading_partner_service_id ?? '',
        subscriberId: i.member_id ?? '',
        insurancePlan: i.plan_type ?? '',
        groupNumber: i.group_number ?? '',
        phoneNumber: i.company_phone ?? '',
        coverageStartDate: i.effective_date ?? '',
        terminationDate: i.termination_date ?? '',
        insuranceStatus: titleCase(i.status) ?? '',
        coPayAmount: i.copay_amount === null || i.copay_amount === undefined ? null : Number(i.copay_amount),
        medicalGroup: i.medical_group ?? '',
        pcp: i.pcp_name ?? '',
        guarantor: i.guarantor_relationship ?? '',
        guarantorName: i.guarantor_name ?? '',
        guarantorAddress: i.guarantor_address ?? '',
        guarantorDOB: i.guarantor_dob ?? '',
        guarantorSubscriberId: i.guarantor_member_id ?? '',
    };
}

/** patient_emergency_contacts row -> the legacy-shaped contact object the Demographics tab already reads. */
function contactOut(c) {
    if (!c) return null;
    return {
        id: c.id,
        rank: c.rank,
        relationshipToPatient: c.relationship ?? '',
        contactName: c.name ?? '',
        contactPhone: c.phone ?? '',
        street: c.address1 ?? '',
        emergencyCity: c.city ?? '',
        emergencyState: c.state ?? '',
        emergencyZipCode: c.zip_code ?? '',
    };
}

function patientOut(p) {
    const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
    const insuranceRows = Array.isArray(p.insurance_rows) ? p.insurance_rows : [];
    const contactRows = Array.isArray(p.emergency_rows) ? p.emergency_rows : [];
    const emergencyContacts = contactRows.map(contactOut);
    return {
        id: p.id,
        _id: p.id,
        patientId: p.id,
        mrn: p.mrn,
        prefix: p.prefix ?? '',
        firstName: p.first_name,
        middleName: p.middle_name ?? '',
        lastName: p.last_name,
        suffix: p.suffix ?? '',
        fullName,
        dOB: p.dob ?? '',
        sex: p.sex ?? '',
        maritalStatus: p.marital_status ?? '',
        email: p.email ?? '',
        workEmail: p.work_email ?? '',
        mobilePhone: p.mobile_phone ?? '',
        homePhone: p.home_phone ?? '',
        workPhone: p.work_phone ?? '',
        otherPhone: p.other_phone ?? '',
        pregnant: p.pregnant ?? null,
        breastfeeding: p.breastfeeding ?? null,
        address1: p.address1 ?? '',
        address2: p.address2 ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
        zipCode: p.zip_code ?? '',
        mailingAddress: {
            address1: p.mailing_address1 ?? '',
            address2: p.mailing_address2 ?? '',
            city: p.mailing_city ?? '',
            state: p.mailing_state ?? '',
            zipCode: p.mailing_zip_code ?? '',
        },
        preferredLanguage: p.preferred_language ?? '',
        ethnicity: p.ethnicity ?? '',
        race: p.race ?? '',
        countryOfBirth: p.country_of_birth ?? '',
        advancedHealthCareDirective: p.advance_directive_status ?? '',
        noticeOfPrivacyPracticesDate: p.notice_of_privacy_practices_date ?? '',
        insurance: insuranceOut(insuranceRows.find((i) => i.rank === 'primary')),
        secondaryInsurance: insuranceOut(insuranceRows.find((i) => i.rank === 'secondary')),
        emergencyContacts,
        emergencyContact: emergencyContacts[0] ?? null,
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
        where.push(`(p.first_name || ' ' || p.last_name ILIKE $${n} OR p.mrn ILIKE $${n} OR COALESCE(p.email,'') ILIKE $${n} OR COALESCE(p.mobile_phone,'') ILIKE $${n} OR COALESCE(p.home_phone,'') ILIKE $${n} OR COALESCE(p.work_phone,'') ILIKE $${n})`);
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

/**
 * Soft duplicate check used by the registration form before it saves. Matches same last name + DOB,
 * or same first + last name, within the tenant. Advisory only — the caller may still register.
 */
patientsRouter.get('/Patient/findDuplicates', h(async (req, res) => {
    const q = parse(
        z.object({
            firstName: z.string().trim().max(100).optional(),
            lastName: z.string().trim().min(1).max(100),
            dOB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            excludeId: z.string().optional(),
        }),
        req.query,
    );
    const params = [req.user.tenantId, q.lastName.toLowerCase()];
    const ors = [];
    if (q.dOB) { params.push(q.dOB); ors.push(`p.dob = $${params.length}::date`); }
    if (q.firstName) { params.push(q.firstName.toLowerCase()); ors.push(`lower(p.first_name) = $${params.length}`); }
    if (!ors.length) return ok(res, []);
    let sql = `${PATIENT_SELECT} WHERE p.tenant_id = $1 AND lower(p.last_name) = $2 AND (${ors.join(' OR ')})`;
    if (q.excludeId) { params.push(q.excludeId); sql += ` AND p.id <> $${params.length}`; }
    const r = await query(`${sql} ORDER BY p.created_at DESC LIMIT 5`, params);
    ok(res, r.rows.map(patientOut));
}));

// Up to ~1 MB of base64 (express.json is capped at 2 MB). The frontend downsizes before sending.
const DATA_URL_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Profile photo. Stored inline in patients.profile_picture as a data URL — the repo has no object
 * storage yet; when it does, this handler swaps to "upload, store URL" without changing the contract.
 */
patientsRouter.put('/Patient/updateProfilePicture/:id', requireRole('physician', 'nurse', 'staff'), h(async (req, res) => {
    const b = parse(z.object({ profilePicture: z.string().max(1_400_000).regex(DATA_URL_IMAGE, 'profilePicture must be a base64 image data URL').nullable() }), req.body);
    const r = await query('UPDATE patients SET profile_picture = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING id', [b.profilePicture, req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
    ok(res, patientOut((await query(`${PATIENT_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0]));
}));

const sexSchema = z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase().slice(0, 1) : v), z.enum(['M', 'F', 'O', 'U']));
const optStr = (n = 200) => z.string().trim().max(n).optional().nullable();
const optDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'must be YYYY-MM-DD').optional().nullable().or(z.literal(''));
const optEmail = () => z.string().trim().email().optional().nullable().or(z.literal(''));
const optBool = () => z.boolean().optional().nullable();

/** One insurance block (primary or secondary). Field names follow the legacy contract the Demographics tab reads. */
const insuranceBody = z.object({
    insuranceType: optStr(100),
    insuranceCompany: optStr(200),
    tradingPartnerServiceId: optStr(80),
    subscriberId: optStr(80),
    insurancePlan: optStr(100),
    groupNumber: optStr(80),
    phoneNumber: optStr(30),
    coverageStartDate: optDate(),
    terminationDate: optDate(),
    insuranceStatus: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(['active', 'inactive']).optional().nullable().or(z.literal(''))),
    coPayAmount: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(999999).nullable().optional()),
    medicalGroup: optStr(100),
    pcp: optStr(100),
    guarantor: optStr(40),
    guarantorName: optStr(100),
    guarantorAddress: optStr(250),
    guarantorDOB: optDate(),
    guarantorSubscriberId: optStr(80),
}).strip();

const emergencyContactBody = z.object({
    relationshipToPatient: optStr(40),
    contactName: optStr(100),
    contactPhone: optStr(30),
    street: optStr(250),
    emergencyCity: optStr(100),
    emergencyState: optStr(50),
    emergencyZipCode: optStr(20),
}).strip();

const patientBody = z.object({
    mrn: z.string().trim().min(1).max(40).optional(),
    prefix: optStr(10),
    firstName: z.string().trim().min(1).max(100),
    middleName: optStr(100),
    lastName: z.string().trim().min(1).max(100),
    suffix: optStr(10),
    dOB: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'dOB must be YYYY-MM-DD').optional().nullable(),
    sex: sexSchema.optional().nullable(),
    maritalStatus: optStr(40),
    email: optEmail(),
    workEmail: optEmail(),
    mobilePhone: optStr(30),
    homePhone: optStr(30),
    workPhone: optStr(30),
    otherPhone: optStr(30),
    pregnant: optBool(),
    breastfeeding: optBool(),
    address1: optStr(), address2: optStr(), city: optStr(100), state: optStr(50), zipCode: optStr(20),
    mailingAddress1: optStr(), mailingAddress2: optStr(), mailingCity: optStr(100), mailingState: optStr(50), mailingZipCode: optStr(20),
    preferredLanguage: optStr(60),
    ethnicity: optStr(100),
    race: optStr(100),
    countryOfBirth: optStr(100),
    advancedHealthCareDirective: optStr(60),
    noticeOfPrivacyPracticesDate: optDate(),
    status: z.boolean().optional(),
    insurance: insuranceBody.optional().nullable(),
    secondaryInsurance: insuranceBody.optional().nullable(),
    emergencyContacts: z.array(emergencyContactBody).max(2).optional().nullable(),
});

// Column map for the flat patients columns (shared by create and update).
const PATIENT_COLS = {
    mrn: 'mrn', prefix: 'prefix', firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name', suffix: 'suffix',
    dOB: 'dob', sex: 'sex', maritalStatus: 'marital_status', email: 'email', workEmail: 'work_email',
    mobilePhone: 'mobile_phone', homePhone: 'home_phone', workPhone: 'work_phone', otherPhone: 'other_phone',
    pregnant: 'pregnant', breastfeeding: 'breastfeeding',
    address1: 'address1', address2: 'address2', city: 'city', state: 'state', zipCode: 'zip_code',
    mailingAddress1: 'mailing_address1', mailingAddress2: 'mailing_address2', mailingCity: 'mailing_city',
    mailingState: 'mailing_state', mailingZipCode: 'mailing_zip_code',
    preferredLanguage: 'preferred_language', ethnicity: 'ethnicity', race: 'race', countryOfBirth: 'country_of_birth',
    advancedHealthCareDirective: 'advance_directive_status', noticeOfPrivacyPracticesDate: 'notice_of_privacy_practices_date',
    status: 'is_active',
};

const nz = (v) => (v === '' || v === undefined ? null : v);

/** True when an insurance/contact block carries any real value (so an all-blank block isn't persisted). */
const hasAnyValue = (obj) => !!obj && Object.values(obj).some((v) => v !== '' && v !== null && v !== undefined);

async function upsertInsurance(client, tenantId, patientId, rank, ins) {
    if (!hasAnyValue(ins)) {
        await client.query('DELETE FROM patient_insurance WHERE patient_id = $1 AND rank = $2', [patientId, rank]);
        return;
    }
    await client.query(
        `INSERT INTO patient_insurance (tenant_id, patient_id, rank, insurance_type, company_name, member_id, plan_type, group_number,
            company_phone, effective_date, termination_date, status, copay_amount, medical_group, pcp_name,
            guarantor_relationship, guarantor_name, guarantor_address, guarantor_dob, guarantor_member_id, trading_partner_service_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (patient_id, rank) DO UPDATE SET
            insurance_type = EXCLUDED.insurance_type, company_name = EXCLUDED.company_name, member_id = EXCLUDED.member_id,
            trading_partner_service_id = EXCLUDED.trading_partner_service_id,
            plan_type = EXCLUDED.plan_type, group_number = EXCLUDED.group_number, company_phone = EXCLUDED.company_phone,
            effective_date = EXCLUDED.effective_date, termination_date = EXCLUDED.termination_date, status = EXCLUDED.status,
            copay_amount = EXCLUDED.copay_amount, medical_group = EXCLUDED.medical_group, pcp_name = EXCLUDED.pcp_name,
            guarantor_relationship = EXCLUDED.guarantor_relationship, guarantor_name = EXCLUDED.guarantor_name,
            guarantor_address = EXCLUDED.guarantor_address, guarantor_dob = EXCLUDED.guarantor_dob,
            guarantor_member_id = EXCLUDED.guarantor_member_id, updated_at = now()`,
        [tenantId, patientId, rank, nz(ins.insuranceType), nz(ins.insuranceCompany), nz(ins.subscriberId), nz(ins.insurancePlan),
         nz(ins.groupNumber), nz(ins.phoneNumber), nz(ins.coverageStartDate), nz(ins.terminationDate), nz(ins.insuranceStatus),
         nz(ins.coPayAmount), nz(ins.medicalGroup), nz(ins.pcp), nz(ins.guarantor), nz(ins.guarantorName), nz(ins.guarantorAddress),
         nz(ins.guarantorDOB), nz(ins.guarantorSubscriberId), nz(ins.tradingPartnerServiceId)],
    );
}

async function upsertEmergencyContact(client, tenantId, patientId, rank, c) {
    if (!hasAnyValue(c)) {
        await client.query('DELETE FROM patient_emergency_contacts WHERE patient_id = $1 AND rank = $2', [patientId, rank]);
        return;
    }
    await client.query(
        `INSERT INTO patient_emergency_contacts (tenant_id, patient_id, rank, relationship, name, phone, address1, city, state, zip_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (patient_id, rank) DO UPDATE SET
            relationship = EXCLUDED.relationship, name = EXCLUDED.name, phone = EXCLUDED.phone, address1 = EXCLUDED.address1,
            city = EXCLUDED.city, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code`,
        [tenantId, patientId, rank, nz(c.relationshipToPatient), nz(c.contactName), nz(c.contactPhone), nz(c.street),
         nz(c.emergencyCity), nz(c.emergencyState), nz(c.emergencyZipCode)],
    );
}

/** Writes the nested insurance / emergency-contact blocks that were present in the body (absent = leave untouched). */
async function writeNested(client, tenantId, patientId, b) {
    if (b.insurance !== undefined) await upsertInsurance(client, tenantId, patientId, 'primary', b.insurance);
    if (b.secondaryInsurance !== undefined) await upsertInsurance(client, tenantId, patientId, 'secondary', b.secondaryInsurance);
    if (b.emergencyContacts !== undefined) {
        const list = b.emergencyContacts ?? [];
        await upsertEmergencyContact(client, tenantId, patientId, 'primary', list[0]);
        await upsertEmergencyContact(client, tenantId, patientId, 'secondary', list[1]);
    }
}

const clinicalWriters = requireRole('physician', 'nurse', 'staff');

/** Next sequential MRN for a tenant; the upsert takes a row lock so concurrent callers serialize. */
async function nextMrn(client, tenantId) {
    const r = await client.query(
        `INSERT INTO mrn_counters (tenant_id, last_value) VALUES ($1, 1)
         ON CONFLICT (tenant_id) DO UPDATE SET last_value = mrn_counters.last_value + 1
         RETURNING last_value`,
        [tenantId],
    );
    return `MRN${String(r.rows[0].last_value).padStart(6, '0')}`;
}

patientsRouter.post('/Patient/createPatient', clinicalWriters, h(async (req, res) => {
    const b = parse(patientBody, req.body);
    const tenantId = req.user.tenantId;
    // Patient + insurance + emergency contacts are written atomically: a patient never ends up with a
    // half-written insurance record.
    const id = await withTx(async (client) => {
        const cols = ['tenant_id'];
        const vals = [tenantId];
        for (const [k, col] of Object.entries(PATIENT_COLS)) {
            if (k === 'mrn' || k === 'status') continue;
            if (b[k] === undefined) continue;
            cols.push(col);
            vals.push(nz(b[k]));
        }
        cols.push('mrn', 'is_active');
        vals.push(null, b.status ?? true);
        const mrnIdx = vals.length - 2;
        const insertSql = `INSERT INTO patients (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`;
        // MRN: caller-supplied, otherwise from the per-tenant counter. The counter is race-safe (row lock
        // inside this tx); the retry only covers a counter value colliding with a caller-supplied MRN.
        let newId = null;
        for (let attempt = 0; attempt < 5 && !newId; attempt++) {
            vals[mrnIdx] = b.mrn ?? (await nextMrn(client, tenantId));
            await client.query('SAVEPOINT patient_insert');
            try {
                newId = (await client.query(insertSql, vals)).rows[0].id;
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT patient_insert');
                if (e.code !== '23505' || !/mrn/.test(e.constraint ?? '')) throw e;
                if (b.mrn) throw conflict(`MRN ${b.mrn} is already in use`);
            }
        }
        if (!newId) throw conflict('Could not allocate a unique MRN');
        await writeNested(client, tenantId, newId, b);
        return newId;
    });
    const p = (await query(`${PATIENT_SELECT} WHERE p.id = $1`, [id])).rows[0];
    const out = patientOut(p);
    const eligibility = await checkEligibility(out, { tenantId, userId: req.user.id });
    await enqueueRcopiaSync(p);
    created(res, out, { eligibility });
}));

async function updatePatient(req, res) {
    const b = parse(patientBody.partial(), req.body);
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(PATIENT_COLS)) {
        if (b[k] !== undefined) { params.push(nz(b[k])); sets.push(`${col} = $${params.length}`); }
    }
    const hasNested = b.insurance !== undefined || b.secondaryInsurance !== undefined || b.emergencyContacts !== undefined;
    if (!sets.length && !hasNested) throw badRequest('No fields to update');
    await withTx(async (client) => {
        const ownerSql = sets.length
            ? `UPDATE patients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length + 1} AND tenant_id = $${params.length + 2} RETURNING id`
            : `SELECT id FROM patients WHERE id = $1 AND tenant_id = $2`;
        const r = await client.query(ownerSql, sets.length ? [...params, req.params.id, req.user.tenantId] : [req.params.id, req.user.tenantId]);
        if (!r.rowCount) throw notFound('Patient not found');
        await writeNested(client, req.user.tenantId, req.params.id, b);
    });
    ok(res, patientOut((await query(`${PATIENT_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0]));
}
patientsRouter.put('/Patient/updatePatientById/:id', clinicalWriters, h(updatePatient));
// Same alias style as the three read URLs: the full-registration flow calls this name.
patientsRouter.put('/Patient/updatePatientDetails/:id', clinicalWriters, h(updatePatient));

/**
 * Legacy alias kept for the first registration build: forwards to the real inline eligibility runner.
 * New callers should POST /Eligibility/checkInline (routes/eligibility.js).
 */
patientsRouter.post('/Patient/verifyEligibility', clinicalWriters, h(async (req, res) => {
    const b = parse(z.object({
        patientId: z.string().optional().nullable(),
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        dOB: z.string().min(8).max(30),
        sex: z.string().optional().nullable(),
        serviceTypeCodes: z.array(z.string()).max(5).optional(),
        insurance: insuranceBody.optional().nullable(),
        secondaryInsurance: insuranceBody.optional().nullable(),
    }), req.body);
    const result = await runInline({ tenantId: req.user.tenantId, userId: req.user.id, serviceTypeCodes: b.serviceTypeCodes, patientInfo: { ...b, patientId: b.patientId ?? null } });
    ok(res, result, { stediEnabled: stediEnabled() });
}));

// Soft delete only: clinical records must be retained.
patientsRouter.delete('/Patient/deletePatientById/:id', requireRole(), h(async (req, res) => {
    const active = await query(`SELECT 1 FROM encounters WHERE patient_id = $1 AND status <> 'discharged'`, [req.params.id]);
    if (active.rowCount) throw badRequest('Patient has an active admission; discharge before deactivating');
    const r = await query('UPDATE patients SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Patient not found');
    res.json({ status: 'success', message: 'Patient deactivated' });
}));
