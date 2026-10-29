import { Router } from 'express';
import { activeIsolationSql } from '../lib/bedManagement.js';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, forbidden, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

// Staff scheduling (/api/inpatient/staff-scheduling/*) and live nurse assignments (/api/Staffing/*).
export const staffingRouter = Router();
const scheduler = requireRole('staff'); // admin always passes
const charge = requireRole('nurse', 'staff');

const SCHEDULE_BASE = '/api/inpatient/staff-scheduling';

const SHIFT_TYPES = [
    { id: 'st-day', token: 'day', label: 'Day (7a–7p)', startTime: '07:00', endTime: '19:00', color: '#4361ee' },
    { id: 'st-evening', token: 'evening', label: 'Evening (3p–11p)', startTime: '15:00', endTime: '23:00', color: '#f59e0b' },
    { id: 'st-night', token: 'night', label: 'Night (7p–7a)', startTime: '19:00', endTime: '07:00', color: '#8b5cf6' },
];
const typeById = (id) => SHIFT_TYPES.find((t) => t.id === id);
const typeByToken = (tok) => SHIFT_TYPES.find((t) => t.token === tok);

const CLINICAL_ROLE = { physician: 'provider', nurse: 'clinical-staff', admin: 'admin' };
const staffRole = (userRole) => CLINICAL_ROLE[userRole] ?? 'non-clinical-staff';

const isoTs = z.string().datetime({ offset: true });
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

// ================================================================= staff scheduling
const shiftOut = (s) => ({
    id: s.id,
    staffId: s.staff_id,
    wardId: s.ward_id,
    shiftTypeId: s.shift_type_id,
    startAt: s.start_at.toISOString(),
    endAt: s.end_at.toISOString(),
    status: s.status,
    ...(s.notes ? { notes: s.notes } : {}),
});

const staffOut = (u) => {
    const name = `${u.first_name} ${u.last_name}`.trim() || u.email;
    return {
        id: u.id,
        displayName: u.credentials ? `${name}, ${u.credentials}` : name,
        role: staffRole(u.role),
        credentials: u.credentials ?? undefined,
        active: u.is_active,
        homeWardId: u.home_ward_id ?? undefined,
        badges: u.badges?.length ? u.badges : undefined,
    };
};
const STAFF_SELECT = `SELECT u.*, sp.credentials, sp.home_ward_id, sp.badges FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id`;

staffingRouter.get(`${SCHEDULE_BASE}/shift-types`, h(async (_req, res) => {
    ok(res, SHIFT_TYPES.map(({ token: _t, ...t }) => t));
}));

staffingRouter.get(`${SCHEDULE_BASE}/staff`, h(async (req, res) => {
    const r = await query(`${STAFF_SELECT} WHERE u.tenant_id = $1 AND u.is_active ORDER BY u.first_name, u.last_name`, [req.user.tenantId]);
    const role = typeof req.query.role === 'string' ? req.query.role : null;
    ok(res, r.rows.map(staffOut).filter((s) => !role || s.role === role));
}));

staffingRouter.put(`${SCHEDULE_BASE}/staff/:id/profile`, requireRole(), h(async (req, res) => {
    const b = parse(
        z.object({
            clinicalRole: z.enum(['RN', 'LVN', 'CNA']).default('RN'),
            credentials: z.string().trim().max(30).optional().nullable(),
            certifications: z.array(z.enum(['ACLS', 'BLS', 'TNCC', 'CCRN'])).default([]),
            badges: z.array(z.string().trim().max(40)).max(10).default([]),
            homeWardId: z.string().optional().nullable(),
            isFloatPool: z.boolean().default(false),
        }),
        req.body,
    );
    if (!(await query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId])).rowCount) throw notFound('Staff member not found');
    if (b.homeWardId && !(await query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.homeWardId, req.user.tenantId])).rowCount) throw notFound('Ward not found');
    await query(
        `INSERT INTO staff_profiles (user_id, tenant_id, clinical_role, credentials, certifications, badges, home_ward_id, is_float_pool)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO UPDATE SET clinical_role = EXCLUDED.clinical_role, credentials = EXCLUDED.credentials, certifications = EXCLUDED.certifications,
             badges = EXCLUDED.badges, home_ward_id = EXCLUDED.home_ward_id, is_float_pool = EXCLUDED.is_float_pool`,
        [req.params.id, req.user.tenantId, b.clinicalRole, b.credentials || null, JSON.stringify(b.certifications), JSON.stringify(b.badges), b.homeWardId || null, b.isFloatPool],
    );
    ok(res, staffOut((await query(`${STAFF_SELECT} WHERE u.id = $1`, [req.params.id])).rows[0]));
}));

const shiftFilters = z.object({
    wardId: z.string().optional(),
    staffId: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(['scheduled', 'open', 'cancelled']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});

/** `from`/`to` are calendar days (yyyy-MM-dd) or ISO timestamps; `to` is inclusive of its whole day. */
function rangeBounds(from, to) {
    const lo = from ? new Date(from.length === 10 ? `${from}T00:00:00Z` : from) : null;
    let hi = null;
    if (to) {
        hi = new Date(to.length === 10 ? `${to}T00:00:00Z` : to);
        if (to.length === 10) hi = new Date(hi.getTime() + 86_400_000);
    }
    if ((lo && Number.isNaN(lo.getTime())) || (hi && Number.isNaN(hi.getTime()))) throw badRequest('from/to: invalid date');
    return { lo, hi };
}

staffingRouter.get(`${SCHEDULE_BASE}/shifts`, h(async (req, res) => {
    const f = parse(shiftFilters, req.query);
    const { lo, hi } = rangeBounds(f.from, f.to);
    const params = [req.user.tenantId];
    const where = ['s.tenant_id = $1'];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (f.wardId) add('s.ward_id = ?', f.wardId);
    if (f.staffId) add('s.staff_id = ?', f.staffId);
    if (f.status) add('s.status = ?', f.status);
    if (lo) add('s.start_at >= ?', lo);
    if (hi) add('s.start_at < ?', hi);
    const r = await query(`SELECT s.*, u.role AS staff_user_role FROM staff_shifts s LEFT JOIN users u ON u.id = s.staff_id WHERE ${where.join(' AND ')} ORDER BY s.start_at, s.id LIMIT 5000`, params);
    let rows = r.rows;
    if (f.role) {
        rows = rows.filter((s) => (s.status === 'open' || !s.staff_id ? f.role === 'clinical-staff' : staffRole(s.staff_user_role) === f.role));
    }
    ok(res, rows.map(shiftOut));
}));

staffingRouter.get(`${SCHEDULE_BASE}/shifts/:id`, h(async (req, res) => {
    const r = await query('SELECT * FROM staff_shifts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Shift not found');
    ok(res, shiftOut(r.rows[0]));
}));

const shiftBody = z
    .object({
        staffId: z.string().min(1).nullable(),
        wardId: z.string().min(1),
        shiftTypeId: z.enum(['st-day', 'st-evening', 'st-night']),
        startAt: isoTs,
        endAt: isoTs,
        status: z.enum(['scheduled', 'open', 'cancelled']).default('scheduled'),
        notes: z.string().trim().max(500).optional().nullable(),
    })
    .refine((v) => new Date(v.endAt) > new Date(v.startAt), { message: 'endAt must be after startAt', path: ['endAt'] })
    .refine((v) => v.status !== 'scheduled' || !!v.staffId, { message: 'A scheduled shift needs a staff member', path: ['staffId'] });

async function validateShift(db, req, b, excludeId) {
    const t = req.user.tenantId;
    if (!(await db.query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.wardId, t])).rowCount) throw notFound('Ward not found');
    if (b.staffId) {
        if (!(await db.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [b.staffId, t])).rowCount) throw notFound('Staff member not found');
        if (b.status !== 'cancelled') {
            const clash = await db.query(
                `SELECT 1 FROM staff_shifts WHERE tenant_id = $1 AND staff_id = $2 AND status <> 'cancelled' AND tstzrange(start_at, end_at) && tstzrange($3::timestamptz, $4::timestamptz)
                   AND ($5::text IS NULL OR id <> $5)`,
                [t, b.staffId, b.startAt, b.endAt, excludeId ?? null],
            );
            if (clash.rowCount) throw conflict('This staff member already has an overlapping shift');
        }
    }
}

staffingRouter.post(`${SCHEDULE_BASE}/shifts`, scheduler, h(async (req, res) => {
    const b = parse(shiftBody, req.body);
    await validateShift({ query }, req, b);
    const r = await query(
        `INSERT INTO staff_shifts (tenant_id, staff_id, ward_id, shift_type_id, start_at, end_at, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.user.tenantId, b.status === 'open' ? null : b.staffId, b.wardId, b.shiftTypeId, b.startAt, b.endAt, b.status, b.notes || null],
    );
    created(res, shiftOut(r.rows[0]));
}));

staffingRouter.put(`${SCHEDULE_BASE}/shifts/:id`, scheduler, h(async (req, res) => {
    const cur = await query('SELECT * FROM staff_shifts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!cur.rowCount) throw notFound('Shift not found');
    const c = shiftOut(cur.rows[0]);
    const b = parse(shiftBody, { ...c, notes: c.notes ?? null, ...req.body });
    await validateShift({ query }, req, b, req.params.id);
    const r = await query(
        `UPDATE staff_shifts SET staff_id=$1, ward_id=$2, shift_type_id=$3, start_at=$4, end_at=$5, status=$6, notes=$7 WHERE id=$8 AND tenant_id=$9 RETURNING *`,
        [b.status === 'open' ? null : b.staffId, b.wardId, b.shiftTypeId, b.startAt, b.endAt, b.status, b.notes || null, req.params.id, req.user.tenantId],
    );
    ok(res, shiftOut(r.rows[0]));
}));

staffingRouter.delete(`${SCHEDULE_BASE}/shifts/:id`, scheduler, h(async (req, res) => {
    const r = await query('DELETE FROM staff_shifts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Shift not found');
    res.json({ status: 'success', message: 'Shift deleted' });
}));

// ---- coverage rules (minimum clinical staff per ward and shift type)
staffingRouter.get(`${SCHEDULE_BASE}/coverage-rules`, h(async (req, res) => {
    const r = await query('SELECT * FROM staff_coverage_rules WHERE tenant_id = $1 ORDER BY ward_id, shift_type_id', [req.user.tenantId]);
    ok(res, r.rows.map((x) => ({ wardId: x.ward_id, shiftTypeId: x.shift_type_id, minStaff: x.min_staff, role: x.role })));
}));

staffingRouter.put(`${SCHEDULE_BASE}/coverage-rules`, scheduler, h(async (req, res) => {
    const b = parse(z.object({ wardId: z.string().min(1), shiftTypeId: z.enum(['st-day', 'st-evening', 'st-night']), minStaff: z.coerce.number().int().min(0).max(100), role: z.string().default('clinical-staff') }), req.body);
    if (!(await query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.wardId, req.user.tenantId])).rowCount) throw notFound('Ward not found');
    await query(
        `INSERT INTO staff_coverage_rules (tenant_id, ward_id, shift_type_id, min_staff, role) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (ward_id, shift_type_id, role) DO UPDATE SET min_staff = EXCLUDED.min_staff`,
        [req.user.tenantId, b.wardId, b.shiftTypeId, b.minStaff, b.role],
    );
    ok(res, b);
}));

staffingRouter.get(`${SCHEDULE_BASE}/open-shifts`, h(async (req, res) => {
    const f = parse(z.object({ wardId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }), req.query);
    const { lo, hi } = rangeBounds(f.from, f.to);
    const t = req.user.tenantId;
    const params = [t];
    const where = [`s.tenant_id = $1`, `s.status <> 'cancelled'`, `(s.status = 'open' OR s.staff_id IS NULL)`];
    if (f.wardId) { params.push(f.wardId); where.push(`s.ward_id = $${params.length}`); }
    if (lo) { params.push(lo); where.push(`s.start_at >= $${params.length}`); }
    if (hi) { params.push(hi); where.push(`s.start_at < $${params.length}`); }
    const open = await query(`SELECT s.*, w.name AS ward_name FROM staff_shifts s JOIN wards w ON w.id = s.ward_id WHERE ${where.join(' AND ')} ORDER BY s.start_at LIMIT 2000`, params);
    const rows = open.rows.map((s) => ({
        shift: shiftOut(s),
        wardName: s.ward_name,
        shiftTypeLabel: typeById(s.shift_type_id)?.label ?? s.shift_type_id,
        reason: 'unassigned',
        requiredRole: 'clinical-staff',
    }));

    // Coverage gaps for the first requested day (default: today).
    const day = f.from ? (f.from.length === 10 ? f.from : f.from.slice(0, 10)) : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${day}T00:00:00Z`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const rules = await query(
        `SELECT cr.*, w.name AS ward_name,
                (SELECT count(*)::int FROM staff_shifts s JOIN users u ON u.id = s.staff_id
                  WHERE s.ward_id = cr.ward_id AND s.shift_type_id = cr.shift_type_id AND s.status = 'scheduled'
                    AND s.start_at >= $2 AND s.start_at < $3 AND u.is_active
                    AND (CASE u.role WHEN 'nurse' THEN 'clinical-staff' WHEN 'physician' THEN 'provider' WHEN 'admin' THEN 'admin' ELSE 'non-clinical-staff' END) = cr.role) AS scheduled
         FROM staff_coverage_rules cr JOIN wards w ON w.id = cr.ward_id
         WHERE cr.tenant_id = $1 ${f.wardId ? 'AND cr.ward_id = $4' : ''}`,
        f.wardId ? [t, dayStart, dayEnd, f.wardId] : [t, dayStart, dayEnd],
    );
    for (const rule of rules.rows) {
        if (rule.scheduled >= rule.min_staff) continue;
        const label = typeById(rule.shift_type_id)?.label ?? rule.shift_type_id;
        if (rows.some((r) => r.wardName === rule.ward_name && r.shiftTypeLabel === label)) continue;
        rows.push({
            shift: { id: `gap-${rule.ward_id}-${rule.shift_type_id}`, staffId: null, wardId: rule.ward_id, shiftTypeId: rule.shift_type_id, startAt: dayStart.toISOString(), endAt: dayEnd.toISOString(), status: 'open' },
            wardName: rule.ward_name,
            shiftTypeLabel: label,
            reason: 'understaffed',
            requiredRole: rule.role,
        });
    }
    ok(res, rows);
}));

// Shifts of the signed-in user on a ward for one calendar day (flowsheet shift switcher).
staffingRouter.get(`${SCHEDULE_BASE}/me/shifts`, h(async (req, res) => {
    const q = parse(z.object({ wardId: z.string().min(1), date: ymd }), req.query);
    const lo = new Date(`${q.date}T00:00:00Z`);
    // A night shift that started the previous evening still covers the early hours, so look back 12h.
    const r = await query(
        `SELECT * FROM staff_shifts WHERE tenant_id = $1 AND staff_id = $2 AND ward_id = $3 AND status = 'scheduled'
           AND start_at >= $4 AND start_at < $5 ORDER BY start_at`,
        [req.user.tenantId, req.user.id, q.wardId, new Date(lo.getTime() - 12 * 3_600_000), new Date(lo.getTime() + 86_400_000)],
    );
    ok(res, r.rows.map(shiftOut));
}));

// ================================================================= live nurse assignments
const THRESHOLDS = {
    ICU: { safeMax: 2, warningMax: 3 },
    'Step-Down': { safeMax: 3, warningMax: 4 },
    'Med-Surg': { safeMax: 5, warningMax: 6 },
    'L&D': { safeMax: 2, warningMax: 3 },
};
const ratioStatus = (n, model) => {
    if (n <= 0) return 'safe';
    const t = THRESHOLDS[model] ?? THRESHOLDS['Med-Surg'];
    return n <= t.safeMax ? 'safe' : n <= t.warningMax ? 'warning' : 'critical';
};
const ACUITY = { emergency: 'high', urgent: 'medium', elective: 'low' };
const initials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

async function loadWard(db, tenantId, unitId) {
    const w = (await db.query('SELECT * FROM wards WHERE id = $1 AND tenant_id = $2', [unitId, tenantId])).rows[0];
    if (!w) throw notFound('Unit not found');
    return w;
}

/** Occupied beds of a ward keyed by bed id, with the data needed for a bed chip. */
async function wardBedChips(db, tenantId, wardId) {
    const r = await db.query(
        `SELECT b.id AS bed_id, b.label, rm.room_number, p.id AS patient_id, p.first_name, p.last_name, e.admission_type,
                ${activeIsolationSql('e')} AS isolation
         FROM beds b JOIN rooms rm ON rm.id = b.room_id
         JOIN encounters e ON e.bed_id = b.id AND e.status <> 'discharged'
         JOIN patients p ON p.id = e.patient_id
         WHERE b.tenant_id = $1 AND rm.ward_id = $2 ORDER BY rm.room_number, b.label`,
        [tenantId, wardId],
    );
    return new Map(r.rows.map((x) => [x.bed_id, { bedId: x.bed_id, roomBedLabel: `${x.room_number}-${x.label}`, patientId: x.patient_id, patientInitials: initials(x.first_name, x.last_name), acuity: ACUITY[x.admission_type] ?? 'medium', isolation: Boolean(x.isolation) }]));
}

async function buildBoard(db, tenantId, a) {
    const ward = await loadWard(db, tenantId, a.ward_id);
    const model = ward.care_model;
    const chips = await wardBedChips(db, tenantId, ward.id);
    const nurses = (
        await db.query(
            `SELECT na.*, u.first_name, u.last_name, u.email, sp.clinical_role, sp.certifications, sp.is_float_pool
             FROM staffing_nurse_assignments na JOIN users u ON u.id = na.nurse_id LEFT JOIN staff_profiles sp ON sp.user_id = u.id
             WHERE na.assignment_id = $1 ORDER BY u.first_name, u.last_name`,
            [a.id],
        )
    ).rows;
    const assigned = new Set();
    const rows = nurses.map((n) => {
        const beds = n.assigned_bed_ids.filter((id) => chips.has(id)).map((id) => chips.get(id));
        beds.forEach((b) => assigned.add(b.bedId));
        const role = n.clinical_role ?? 'RN';
        return {
            id: n.id,
            nurseId: n.nurse_id,
            displayName: `${`${n.first_name} ${n.last_name}`.trim() || n.email}, ${role}`,
            role,
            assignedBeds: beds,
            patientCount: beds.length,
            ratioStatus: ratioStatus(beds.length, model),
            hoursWorkedToday: Number(n.hours_worked),
            isFloatPool: !!n.is_float_pool,
            certifications: n.certifications ?? [],
            isChargeNurse: n.nurse_id === a.charge_nurse_id,
        };
    });
    const tok = typeByToken(a.shift);
    return {
        assignmentId: a.id,
        unitId: ward.id,
        unitName: ward.name,
        unitCareModel: model,
        date: a.assignment_date,
        shift: a.shift,
        shiftLabel: tok.label,
        chargeNurseId: a.charge_nurse_id,
        nurses: rows,
        unfilledBedIds: [...chips.keys()].filter((id) => !assigned.has(id)),
        totalPatients: chips.size,
    };
}

const getAssignment = async (db, tenantId, id) => (await db.query('SELECT * FROM staffing_assignments WHERE id = $1 AND tenant_id = $2', [id, tenantId])).rows[0];

staffingRouter.get('/api/Staffing/assignment/:unitId/:date/:shift', h(async (req, res) => {
    const p = parse(z.object({ date: ymd, shift: z.enum(['day', 'evening', 'night']) }), req.params);
    const r = await query('SELECT * FROM staffing_assignments WHERE tenant_id = $1 AND ward_id = $2 AND assignment_date = $3 AND shift = $4', [req.user.tenantId, req.params.unitId, p.date, p.shift]);
    if (!r.rowCount) throw notFound('No assignment for this unit, date and shift');
    ok(res, await buildBoard({ query }, req.user.tenantId, r.rows[0]));
}));

staffingRouter.post('/api/Staffing/assignment', charge, h(async (req, res) => {
    const b = parse(z.object({ unitId: z.string().min(1), date: ymd, shift: z.enum(['day', 'evening', 'night']), chargeNurseId: z.string().min(1).nullable().optional() }), req.body);
    const t = req.user.tenantId;
    const board = await withTx(async (db) => {
        await loadWard(db, t, b.unitId);
        if (b.chargeNurseId && !(await db.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [b.chargeNurseId, t])).rowCount) throw notFound('Charge nurse not found');
        const ins = await db.query(
            `INSERT INTO staffing_assignments (tenant_id, ward_id, assignment_date, shift, charge_nurse_id) VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (ward_id, assignment_date, shift) DO NOTHING RETURNING *`,
            [t, b.unitId, b.date, b.shift, b.chargeNurseId ?? null],
        );
        let a = ins.rows[0];
        if (!a) {
            a = (await db.query('SELECT * FROM staffing_assignments WHERE ward_id = $1 AND assignment_date = $2 AND shift = $3', [b.unitId, b.date, b.shift])).rows[0];
        } else {
            // Seed the roster from nurses scheduled on this ward for that shift.
            const st = typeByToken(b.shift);
            const day = new Date(`${b.date}T00:00:00Z`);
            await db.query(
                `INSERT INTO staffing_nurse_assignments (assignment_id, nurse_id)
                 SELECT DISTINCT $1, s.staff_id FROM staff_shifts s JOIN users u ON u.id = s.staff_id
                 WHERE s.tenant_id = $2 AND s.ward_id = $3 AND s.shift_type_id = $4 AND s.status = 'scheduled' AND u.role = 'nurse' AND u.is_active
                   AND s.start_at >= $5 AND s.start_at < $6
                 ON CONFLICT DO NOTHING`,
                [a.id, t, b.unitId, st.id, day, new Date(day.getTime() + 86_400_000)],
            );
            if (b.chargeNurseId) {
                await db.query('INSERT INTO staffing_nurse_assignments (assignment_id, nurse_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.id, b.chargeNurseId]);
            }
        }
        return buildBoard(db, t, a);
    });
    created(res, board);
}));

staffingRouter.put('/api/Staffing/assignment/:assignmentId', charge, h(async (req, res) => {
    const b = parse(
        z.object({
            chargeNurseId: z.string().min(1).nullable().optional(),
            nurseAssignments: z.array(z.object({ nurseAssignmentId: z.string().min(1), assignedBedIds: z.array(z.string().min(1)).max(60) })).max(100),
        }),
        req.body,
    );
    const t = req.user.tenantId;
    const board = await withTx(async (db) => {
        const a = await getAssignment(db, t, req.params.assignmentId);
        if (!a) throw notFound('Assignment not found');
        const wardBeds = new Set((await db.query(`SELECT b.id FROM beds b JOIN rooms rm ON rm.id = b.room_id WHERE b.tenant_id = $1 AND rm.ward_id = $2`, [t, a.ward_id])).rows.map((x) => x.id));
        const seen = new Set();
        for (const n of b.nurseAssignments) {
            for (const id of n.assignedBedIds) {
                if (!wardBeds.has(id)) throw badRequest(`Bed ${id} does not belong to this unit`);
                if (seen.has(id)) throw badRequest(`Bed ${id} is assigned to more than one nurse`);
                seen.add(id);
            }
        }
        const own = new Set((await db.query('SELECT id FROM staffing_nurse_assignments WHERE assignment_id = $1', [a.id])).rows.map((x) => x.id));
        for (const n of b.nurseAssignments) {
            if (!own.has(n.nurseAssignmentId)) throw badRequest(`Nurse assignment ${n.nurseAssignmentId} is not part of this board`);
        }
        if (b.chargeNurseId && !(await db.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [b.chargeNurseId, t])).rowCount) throw notFound('Charge nurse not found');
        for (const n of b.nurseAssignments) {
            await db.query('UPDATE staffing_nurse_assignments SET assigned_bed_ids = $1 WHERE id = $2', [JSON.stringify(n.assignedBedIds), n.nurseAssignmentId]);
        }
        const upd = await db.query(
            `UPDATE staffing_assignments SET charge_nurse_id = CASE WHEN $2::boolean THEN $3 ELSE charge_nurse_id END, updated_at = now() WHERE id = $1 RETURNING *`,
            [a.id, b.chargeNurseId !== undefined, b.chargeNurseId ?? null],
        );
        return buildBoard(db, t, upd.rows[0]);
    });
    ok(res, board);
}));

staffingRouter.get('/api/Staffing/floatPool/:tenantId', h(async (req, res) => {
    if (req.params.tenantId !== req.user.tenantId) throw forbidden('Not your tenant');
    const r = await query(
        `SELECT u.*, sp.clinical_role, sp.certifications, w.name AS home_unit_name,
                NOT EXISTS (SELECT 1 FROM staffing_nurse_assignments na JOIN staffing_assignments a ON a.id = na.assignment_id
                             WHERE na.nurse_id = u.id AND a.assignment_date = CURRENT_DATE AND jsonb_array_length(na.assigned_bed_ids) > 0) AS available
         FROM staff_profiles sp JOIN users u ON u.id = sp.user_id LEFT JOIN wards w ON w.id = sp.home_ward_id
         WHERE sp.tenant_id = $1 AND sp.is_float_pool AND u.is_active ORDER BY u.first_name, u.last_name`,
        [req.user.tenantId],
    );
    ok(res, r.rows.map((u) => ({
        id: u.id,
        displayName: `${u.first_name} ${u.last_name}`.trim() || u.email,
        role: u.clinical_role,
        certifications: u.certifications,
        ...(u.home_unit_name ? { homeUnitName: u.home_unit_name } : {}),
        available: u.available,
    })));
}));

staffingRouter.get('/api/Staffing/ratioCheck/:unitId', h(async (req, res) => {
    const q = parse(z.object({ date: ymd.optional(), shift: z.enum(['day', 'evening', 'night']).optional() }), req.query);
    const t = req.user.tenantId;
    const ward = await loadWard({ query }, t, req.params.unitId);
    const params = [t, ward.id, q.date ?? new Date().toISOString().slice(0, 10)];
    let sql = 'SELECT * FROM staffing_assignments WHERE tenant_id = $1 AND ward_id = $2 AND assignment_date = $3';
    if (q.shift) { params.push(q.shift); sql += ' AND shift = $4'; }
    const a = (await query(`${sql} ORDER BY updated_at DESC LIMIT 1`, params)).rows[0];
    const chips = await wardBedChips({ query }, t, ward.id);
    if (!a) {
        return ok(res, { unitId: ward.id, unitCareModel: ward.care_model, averageRatio: chips.size, status: chips.size ? 'critical' : 'safe', criticalNurses: [], understaffed: chips.size > 0 });
    }
    const board = await buildBoard({ query }, t, a);
    const n = board.nurses.length;
    const avg = n ? Math.round((board.totalPatients / n) * 10) / 10 : board.totalPatients;
    const worst = board.nurses.some((x) => x.ratioStatus === 'critical') ? 'critical' : board.nurses.some((x) => x.ratioStatus === 'warning') ? 'warning' : 'safe';
    ok(res, {
        unitId: ward.id,
        unitCareModel: ward.care_model,
        averageRatio: avg,
        status: n === 0 && board.totalPatients > 0 ? 'critical' : worst,
        criticalNurses: board.nurses.filter((x) => x.ratioStatus === 'critical').map((x) => ({ nurseId: x.nurseId, displayName: x.displayName, patientCount: x.patientCount })),
        // Understaffed: nobody on a unit with patients, any nurse above the safe ratio, or patients nobody is assigned to.
        understaffed: n === 0 ? board.totalPatients > 0 : worst !== 'safe' || board.unfilledBedIds.length > 0,
    });
}));

staffingRouter.put('/api/Staffing/unit/:unitId/careModel', requireRole(), h(async (req, res) => {
    const { careModel } = parse(z.object({ careModel: z.enum(['ICU', 'Step-Down', 'Med-Surg', 'L&D']) }), req.body);
    const r = await query('UPDATE wards SET care_model = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, name, care_model', [careModel, req.params.unitId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Unit not found');
    ok(res, { unitId: r.rows[0].id, unitName: r.rows[0].name, careModel: r.rows[0].care_model });
}));
