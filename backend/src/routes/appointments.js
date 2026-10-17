import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const appointmentsRouter = Router();
const writer = requireRole('physician', 'nurse', 'staff');
const adminOnly = requireRole(); // admin always passes

const STATUSES = ['Scheduled', 'Confirmed', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_HOURS = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, { start: '09:00', end: '17:00' }]));
const DEFAULT_GENERAL = { startHour: 7, endHour: 19, slotMinutes: 30, weekStartsOn: 0, defaultView: 'timeGridWeek' };

// ------------------------------------------------------------ date/time helpers
/** Accepts MM/dd/yyyy or yyyy-MM-dd (optionally with a time part) and returns yyyy-MM-dd. */
export function toIsoDate(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    let y, mo, d;
    if (m) [, y, mo, d] = m;
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [, mo, d, y] = m;
    else return null;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d));
    if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Accepts "09:00 AM", "9:00am", "14:30" and returns minutes since midnight. */
export function toMinutes(v) {
    if (typeof v !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(v.trim());
    if (!m) return null;
    let hh = +m[1];
    const mm = +m[2];
    const ap = (m[3] || '').toUpperCase();
    if (mm > 59 || hh > 23 || (ap && (hh < 1 || hh > 12))) return null;
    if (ap === 'PM' && hh < 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
}

const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const label12 = (mins) => {
    const hh = Math.floor(mins / 60);
    return `${String(hh % 12 || 12).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};
const weekdayOf = (iso) => DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// ------------------------------------------------------------ output mappers
const APPT_SELECT = `
    SELECT a.*, to_char(a.start_date,'MM/DD/YYYY') AS start_date_us, to_char(a.start_time,'HH12:MI AM') AS start_time_12,
           to_char(a.start_date + a.start_time + make_interval(mins => a.duration),'MM/DD/YYYY') AS end_date_us,
           to_char(a.start_date + a.start_time + make_interval(mins => a.duration),'HH12:MI AM') AS end_time_12,
           trim(p.first_name || ' ' || p.last_name) AS patient_name, p.email AS patient_email, p.mobile_phone AS patient_phone,
           to_char(p.dob,'MM/DD/YYYY') AS patient_dob, p.sex AS patient_sex,
           trim(u.first_name || ' ' || u.last_name) AS provider_name, sl.name AS service_location_name, vt.visit_reason_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN users u ON u.id = a.provider_id
    LEFT JOIN service_locations sl ON sl.id = a.service_location_id
    LEFT JOIN visit_types vt ON vt.id = a.visit_type_id`;

const apptOut = (a) => ({
    id: a.id,
    _id: a.id,
    appointmentId: a.id,
    patientId: a.patient_id,
    patientName: a.patient_name,
    patientEmail: a.patient_email ?? '',
    emailTo: a.patient_email ?? '',
    phoneNo: a.patient_phone ?? '',
    dob: a.patient_dob ?? '',
    sex: a.patient_sex ?? '',
    providerId: a.provider_id,
    providerName: a.provider_name,
    serviceLocationId: a.service_location_id ?? '',
    serviceLocationName: a.service_location_name ?? '',
    visitReasonId: a.visit_type_id ?? '',
    visitReasonName: a.visit_reason_name ?? a.visit_reason_msg ?? '',
    visitReasonmsg: a.visit_reason_msg ?? a.visit_reason_name ?? '',
    startDate: a.start_date_us,
    startTime: a.start_time_12,
    endDate: a.end_date_us,
    endTime: a.end_time_12,
    duration: a.duration,
    visitMode: a.visit_mode,
    roomNumber: a.room_number ?? '',
    note: a.note ?? '',
    appointmentStatus: a.status,
    createOn: a.created_at.toISOString(),
});

async function loadAppt(req, id) {
    const r = await query(`${APPT_SELECT} WHERE a.id = $1 AND a.tenant_id = $2`, [id, req.user.tenantId]);
    return r.rows[0] ? apptOut(r.rows[0]) : null;
}

// ------------------------------------------------------------ availability / conflicts
async function findConflicts(tenantId, providerId, isoDate, startMin, duration, excludeId) {
    const r = await query(
        `SELECT id, to_char(start_time,'HH12:MI AM') AS t, duration,
                (extract(hour from start_time)*60 + extract(minute from start_time))::int AS s
         FROM appointments
         WHERE tenant_id = $1 AND provider_id = $2 AND start_date = $3 AND status NOT IN ('Cancelled','No Show')
           AND ($4::text IS NULL OR id <> $4)`,
        [tenantId, providerId, isoDate, excludeId ?? null],
    );
    return r.rows.filter((x) => startMin < x.s + x.duration && x.s < startMin + duration).map((x) => ({ id: x.id, startTime: x.t, duration: x.duration }));
}

async function providerHours(tenantId, providerId, locationId) {
    const r = await query(
        'SELECT weekly_hours, slot_minutes FROM provider_calendar_settings WHERE tenant_id = $1 AND provider_id = $2 AND service_location_id = $3',
        [tenantId, providerId, locationId],
    );
    return r.rows[0] ? { hours: r.rows[0].weekly_hours, slot: r.rows[0].slot_minutes } : { hours: DEFAULT_HOURS, slot: 30 };
}

const slotBody = z.object({
    providerId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    serviceLocationId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
    date: z.string().min(1),
    day: z.string().optional(),
    duration: z.coerce.number().int().min(5).max(480).optional(),
    appointmentId: z.string().optional(),
});

appointmentsRouter.post('/Appointment/getProviderAvailableSlots', h(async (req, res) => {
    const b = parse(slotBody, req.body);
    const providerId = b.providerId ?? b.userId;
    const locationId = b.serviceLocationId ?? b.locationId;
    if (!providerId || !locationId) throw badRequest('providerId and serviceLocationId are required');
    const iso = toIsoDate(b.date);
    if (!iso) throw badRequest('date: invalid date');
    const prov = await query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [providerId, req.user.tenantId]);
    if (!prov.rowCount) throw notFound('Provider not found');
    const { hours, slot } = await providerHours(req.user.tenantId, providerId, locationId);
    const win = hours[weekdayOf(iso)];
    const start = win && toMinutes(win.start);
    const end = win && toMinutes(win.end);
    if (start == null || end == null || end <= start) return ok(res, []);
    const step = b.duration ?? slot;
    const booked = await query(
        `SELECT (extract(hour from start_time)*60 + extract(minute from start_time))::int AS s, duration FROM appointments
         WHERE tenant_id = $1 AND provider_id = $2 AND start_date = $3 AND status NOT IN ('Cancelled','No Show') AND ($4::text IS NULL OR id <> $4)`,
        [req.user.tenantId, providerId, iso, b.appointmentId ?? null],
    );
    const out = [];
    for (let t = start; t + step <= end; t += slot) {
        if (!booked.rows.some((x) => t < x.s + x.duration && x.s < t + step)) out.push(label12(t));
    }
    ok(res, out);
}));

appointmentsRouter.post('/Appointment/conflict', h(async (req, res) => {
    const b = parse(
        z.object({ providerId: z.string().min(1), startDate: z.string().min(1), startTime: z.string().min(1), duration: z.coerce.number().int().min(5).max(480).default(30), appointmentId: z.string().optional(), _id: z.string().optional() }),
        req.body,
    );
    const iso = toIsoDate(b.startDate);
    const mins = toMinutes(b.startTime);
    if (!iso || mins == null) throw badRequest('Invalid startDate/startTime');
    const conflicts = await findConflicts(req.user.tenantId, b.providerId, iso, mins, b.duration, b.appointmentId ?? b._id);
    ok(res, { hasConflict: conflicts.length > 0, conflicts });
}));

// ------------------------------------------------------------ appointments CRUD
const apptBody = z.object({
    patientId: z.string().min(1),
    providerId: z.string().min(1),
    serviceLocationId: z.string().optional().nullable(),
    visitReasonId: z.string().optional().nullable(),
    visitReasonmsg: z.string().trim().max(500).optional().nullable(),
    visitReasonName: z.string().trim().max(500).optional().nullable(),
    startDate: z.string().min(1),
    startTime: z.string().min(1),
    duration: z.coerce.number().int().min(5).max(480).default(30),
    visitMode: z.string().trim().max(50).default('Office Visit'),
    note: z.string().trim().max(2000).optional().nullable(),
    roomNumber: z.string().trim().max(50).optional().nullable(),
    appointmentStatus: z.enum(STATUSES).optional(),
});

async function resolveRefs(req, b) {
    const t = req.user.tenantId;
    const iso = toIsoDate(b.startDate);
    const mins = toMinutes(b.startTime);
    if (!iso) throw badRequest('startDate: invalid date');
    if (mins == null) throw badRequest('startTime: invalid time');
    if (!(await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [b.patientId, t])).rowCount) throw notFound('Patient not found');
    if (!(await query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [b.providerId, t])).rowCount) throw notFound('Provider not found');
    let loc = null;
    if (b.serviceLocationId) {
        loc = (await query('SELECT id FROM service_locations WHERE id = $1 AND tenant_id = $2', [b.serviceLocationId, t])).rows[0]?.id;
        if (!loc) throw notFound('Service location not found');
    }
    // The UI falls back to placeholder ids when no visit types exist; those are kept only as free text.
    const vt = b.visitReasonId ? (await query('SELECT id FROM visit_types WHERE id = $1 AND tenant_id = $2', [b.visitReasonId, t])).rows[0]?.id ?? null : null;
    return { iso, mins, loc, vt };
}

appointmentsRouter.post('/Appointment/createAppointment', writer, h(async (req, res) => {
    const b = parse(apptBody, req.body);
    const { iso, mins, loc, vt } = await resolveRefs(req, b);
    if ((await findConflicts(req.user.tenantId, b.providerId, iso, mins, b.duration)).length) throw conflict('The provider already has an appointment in this time slot');
    const r = await query(
        `INSERT INTO appointments (tenant_id, patient_id, provider_id, service_location_id, visit_type_id, start_date, start_time, duration,
                                   status, visit_mode, visit_reason_msg, room_number, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [req.user.tenantId, b.patientId, b.providerId, loc, vt, iso, hhmm(mins), b.duration, b.appointmentStatus ?? 'Scheduled', b.visitMode,
         b.visitReasonmsg || b.visitReasonName || null, b.roomNumber || null, b.note || null, req.user.id],
    );
    created(res, await loadAppt(req, r.rows[0].id), { message: 'Appointment created' });
}));

appointmentsRouter.put('/Appointment/updateAppointment', writer, h(async (req, res) => {
    const b = parse(apptBody.extend({ id: z.string().optional(), _id: z.string().optional(), appointmentId: z.string().optional() }), req.body);
    const id = b._id || b.id || b.appointmentId;
    if (!id) throw badRequest('Appointment id is required');
    const cur = await query('SELECT status FROM appointments WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);
    if (!cur.rowCount) throw notFound('Appointment not found');
    const { iso, mins, loc, vt } = await resolveRefs(req, b);
    if ((await findConflicts(req.user.tenantId, b.providerId, iso, mins, b.duration, id)).length) throw conflict('The provider already has an appointment in this time slot');
    await query(
        `UPDATE appointments SET patient_id=$1, provider_id=$2, service_location_id=$3, visit_type_id=$4, start_date=$5, start_time=$6::time,
                duration=$7, status=$8, visit_mode=$9, visit_reason_msg=$10, room_number=$11, note=$12, updated_at=now()
         WHERE id=$13 AND tenant_id=$14`,
        [b.patientId, b.providerId, loc, vt, iso, hhmm(mins), b.duration, b.appointmentStatus ?? cur.rows[0].status, b.visitMode,
         b.visitReasonmsg || b.visitReasonName || null, b.roomNumber || null, b.note || null, id, req.user.tenantId],
    );
    ok(res, await loadAppt(req, id), { message: 'Appointment updated' });
}));

const SORT = {
    startDate: 'a.start_date, a.start_time',
    createOn: 'a.created_at',
    patientName: 'patient_name',
    providerName: 'provider_name',
    appointmentStatus: 'a.status',
};

appointmentsRouter.post('/Appointment/getAppointmentListPaginated', h(async (req, res) => {
    const b = parse(
        z.object({
            fromDate: z.string().optional(),
            toDate: z.string().optional(),
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(1000).default(10),
            sortField: z.string().default('createOn'),
            sortOrder: z.enum(['asc', 'desc']).default('desc'),
            providerIds: z.array(z.string()).optional(),
            serviceIds: z.array(z.string()).optional(),
            patientId: z.string().optional(),
            status: z.string().optional(),
            appointmentStatus: z.string().optional(),
            query: z.string().trim().max(100).optional(),
        }),
        req.body ?? {},
    );
    const params = [req.user.tenantId];
    const where = ['a.tenant_id = $1'];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    const from = b.fromDate && toIsoDate(b.fromDate);
    const to = b.toDate && toIsoDate(b.toDate);
    if (b.fromDate && !from) throw badRequest('fromDate: invalid date');
    if (b.toDate && !to) throw badRequest('toDate: invalid date');
    if (from) add('a.start_date >= ?', from);
    if (to) add('a.start_date <= ?', to);
    if (b.providerIds?.length) add('a.provider_id = ANY(?::text[])', b.providerIds);
    if (b.serviceIds?.length) add('a.service_location_id = ANY(?::text[])', b.serviceIds);
    if (b.patientId) add('a.patient_id = ?', b.patientId);
    const st = b.status || b.appointmentStatus;
    if (st) add('lower(a.status) = lower(?)', st);
    if (b.query) add(`(p.first_name || ' ' || p.last_name || ' ' || u.first_name || ' ' || u.last_name || ' ' || coalesce(a.visit_reason_msg,'')) ILIKE ?`, `%${b.query.replace(/[%_\\]/g, '\\$&')}%`);
    const order = `${SORT[b.sortField] ?? SORT.createOn} ${b.sortOrder === 'asc' ? 'ASC' : 'DESC'}, a.id`;
    const base = `FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.provider_id WHERE ${where.join(' AND ')}`;
    const total = (await query(`SELECT count(*)::int AS n ${base}`, params)).rows[0].n;
    const items = await query(
        `${APPT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${b.limit} OFFSET ${(b.page - 1) * b.limit}`,
        params,
    );
    ok(res, { items: items.rows.map(apptOut), pagination: { total, page: b.page, limit: b.limit, totalPages: Math.max(1, Math.ceil(total / b.limit)) } });
}));

appointmentsRouter.get('/Appointment/getAppointmentListByPatientId/:patientId', h(async (req, res) => {
    const r = await query(`${APPT_SELECT} WHERE a.tenant_id = $1 AND a.patient_id = $2 ORDER BY a.start_date DESC, a.start_time DESC`, [req.user.tenantId, req.params.patientId]);
    ok(res, r.rows.map(apptOut));
}));

appointmentsRouter.get('/Appointment/getAppointmentById/:id', h(async (req, res) => {
    const a = await loadAppt(req, req.params.id);
    if (!a) throw notFound('Appointment not found');
    ok(res, a);
}));

const deleteAppt = h(async (req, res) => {
    const r = await query('DELETE FROM appointments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Appointment not found');
    res.json({ status: 'success', message: 'Appointment deleted' });
});
appointmentsRouter.delete('/appointments/:id', writer, deleteAppt);
appointmentsRouter.delete('/Appointment/deleteAppointment/:id', writer, deleteAppt);

appointmentsRouter.put('/appointments/:id/status', writer, h(async (req, res) => {
    const { status } = parse(z.object({ status: z.string().min(1) }), req.body);
    const canon = STATUSES.find((s) => s.toLowerCase() === status.trim().toLowerCase());
    if (!canon) throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
    const r = await query('UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3', [canon, req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Appointment not found');
    ok(res, await loadAppt(req, req.params.id));
}));

appointmentsRouter.get('/appointments/dashboard-stats', h(async (req, res) => {
    const r = await query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE start_date = CURRENT_DATE)::int AS today,
                count(*) FILTER (WHERE start_date > CURRENT_DATE AND status NOT IN ('Cancelled','No Show','Completed'))::int AS upcoming,
                count(*) FILTER (WHERE status = 'Completed')::int AS completed,
                count(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled
         FROM appointments WHERE tenant_id = $1`,
        [req.user.tenantId],
    );
    ok(res, r.rows[0]);
}));

// ------------------------------------------------------------ providers
const providerOut = (u) => {
    const fullName = `${u.first_name} ${u.last_name}`.trim() || u.email;
    return { id: u.id, _id: u.id, firstName: u.first_name, lastName: u.last_name, fullName, name: fullName, prefix: '', suffix: '', email: u.email, role: ['provider'], status: u.is_active };
};

appointmentsRouter.get('/ProviderProfile/getProviderList', h(async (req, res) => {
    const r = await query(`SELECT * FROM users WHERE tenant_id = $1 AND is_active AND role = 'physician' ORDER BY first_name, last_name`, [req.user.tenantId]);
    ok(res, r.rows.map(providerOut));
}));

// ------------------------------------------------------------ service locations
const locOut = (l) => ({ id: l.id, _id: l.id, name: l.name, locationName: l.name, serviceLocationName: l.name, address: l.address ?? '', status: l.is_active });
const locBody = z.object({ name: z.string().trim().min(1).max(120).optional(), locationName: z.string().trim().min(1).max(120).optional(), address: z.string().trim().max(300).optional().nullable() });

appointmentsRouter.get('/ServiceLocation/getServiceLocationList', h(async (req, res) => {
    ok(res, (await query('SELECT * FROM service_locations WHERE tenant_id = $1 AND is_active ORDER BY name', [req.user.tenantId])).rows.map(locOut));
}));
appointmentsRouter.post('/ServiceLocation/createServiceLocation', adminOnly, h(async (req, res) => {
    const b = parse(locBody, req.body);
    const name = b.name ?? b.locationName;
    if (!name) throw badRequest('name is required');
    const r = await query('INSERT INTO service_locations (tenant_id, name, address) VALUES ($1,$2,$3) RETURNING *', [req.user.tenantId, name, b.address || null]);
    created(res, locOut(r.rows[0]));
}));
appointmentsRouter.put('/ServiceLocation/updateServiceLocation/:id', adminOnly, h(async (req, res) => {
    const b = parse(locBody, req.body);
    const r = await query('UPDATE service_locations SET name = COALESCE($1,name), address = COALESCE($2,address) WHERE id = $3 AND tenant_id = $4 RETURNING *', [b.name ?? b.locationName ?? null, b.address ?? null, req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Service location not found');
    ok(res, locOut(r.rows[0]));
}));
appointmentsRouter.delete('/ServiceLocation/deleteServiceLocation/:id', adminOnly, h(async (req, res) => {
    const r = await query('UPDATE service_locations SET is_active = FALSE WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Service location not found');
    res.json({ status: 'success', message: 'Service location removed' });
}));

// ------------------------------------------------------------ visit types
const vtOut = (v) => ({ id: v.id, _id: v.id, visitReasonName: v.visit_reason_name, visitTypeName: v.visit_reason_name, VisitTypeName: v.visit_reason_name, duration: v.duration, slotDuration: v.duration, status: v.is_active });
const vtBody = z.object({ visitReasonName: z.string().trim().min(1).max(120), duration: z.coerce.number().int().min(5).max(480).default(30) });

appointmentsRouter.get('/VisitType/getVisitTypeList', h(async (req, res) => {
    ok(res, (await query('SELECT * FROM visit_types WHERE tenant_id = $1 AND is_active ORDER BY visit_reason_name', [req.user.tenantId])).rows.map(vtOut));
}));
appointmentsRouter.post('/VisitType/createVisitType', adminOnly, h(async (req, res) => {
    const b = parse(vtBody, req.body);
    const r = await query('INSERT INTO visit_types (tenant_id, visit_reason_name, duration) VALUES ($1,$2,$3) RETURNING *', [req.user.tenantId, b.visitReasonName, b.duration]);
    created(res, vtOut(r.rows[0]));
}));
appointmentsRouter.put('/VisitType/updateVisitType/:id', adminOnly, h(async (req, res) => {
    const b = parse(vtBody, req.body);
    const r = await query('UPDATE visit_types SET visit_reason_name = $1, duration = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *', [b.visitReasonName, b.duration, req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Visit type not found');
    ok(res, vtOut(r.rows[0]));
}));
appointmentsRouter.delete('/VisitType/deleteVisitType/:id', adminOnly, h(async (req, res) => {
    const r = await query('UPDATE visit_types SET is_active = FALSE WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Visit type not found');
    res.json({ status: 'success', message: 'Visit type removed' });
}));

// ------------------------------------------------------------ calendar settings
appointmentsRouter.get('/CalendarSetting/getGeneralCalendarSetting', h(async (req, res) => {
    const r = await query('SELECT settings FROM calendar_general_settings WHERE tenant_id = $1', [req.user.tenantId]);
    ok(res, { ...DEFAULT_GENERAL, ...(r.rows[0]?.settings ?? {}) });
}));

appointmentsRouter.put('/CalendarSetting/updateGeneralCalendarSetting', adminOnly, h(async (req, res) => {
    const b = parse(
        z.object({
            startHour: z.coerce.number().int().min(0).max(23).optional(),
            endHour: z.coerce.number().int().min(1).max(24).optional(),
            slotMinutes: z.coerce.number().int().min(5).max(240).optional(),
            weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
            defaultView: z.enum(['dayGridMonth', 'timeGridWeek', 'timeGridDay']).optional(),
        }).refine((v) => v.startHour == null || v.endHour == null || v.endHour > v.startHour, 'endHour must be after startHour'),
        req.body,
    );
    const r = await query(
        `INSERT INTO calendar_general_settings (tenant_id, settings) VALUES ($1,$2)
         ON CONFLICT (tenant_id) DO UPDATE SET settings = calendar_general_settings.settings || EXCLUDED.settings, updated_at = now() RETURNING settings`,
        [req.user.tenantId, JSON.stringify(b)],
    );
    ok(res, { ...DEFAULT_GENERAL, ...r.rows[0].settings });
}));

appointmentsRouter.get('/CalendarSetting/getProviderServiceLocations/:providerId', h(async (req, res) => {
    const r = await query(
        `SELECT sl.* FROM provider_calendar_settings s JOIN service_locations sl ON sl.id = s.service_location_id
         WHERE s.tenant_id = $1 AND s.provider_id = $2 AND sl.is_active ORDER BY sl.name`,
        [req.user.tenantId, req.params.providerId],
    );
    ok(res, r.rows.map(locOut));
}));

const timeStr = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
appointmentsRouter.put('/CalendarSetting/saveProviderCalendarSetting', adminOnly, h(async (req, res) => {
    const b = parse(
        z.object({
            providerId: z.string().min(1),
            serviceLocationId: z.string().min(1),
            slotMinutes: z.coerce.number().int().min(5).max(240).default(30),
            weeklyHours: z.partialRecord(z.enum(DAYS), z.object({ start: timeStr, end: timeStr }).refine((v) => toMinutes(v.end) > toMinutes(v.start), 'end must be after start')),
        }),
        req.body,
    );
    const t = req.user.tenantId;
    if (!(await query(`SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND role = 'physician'`, [b.providerId, t])).rowCount) throw notFound('Provider not found');
    if (!(await query('SELECT 1 FROM service_locations WHERE id = $1 AND tenant_id = $2', [b.serviceLocationId, t])).rowCount) throw notFound('Service location not found');
    const r = await query(
        `INSERT INTO provider_calendar_settings (tenant_id, provider_id, service_location_id, weekly_hours, slot_minutes) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (provider_id, service_location_id) DO UPDATE SET weekly_hours = EXCLUDED.weekly_hours, slot_minutes = EXCLUDED.slot_minutes RETURNING *`,
        [t, b.providerId, b.serviceLocationId, JSON.stringify(b.weeklyHours), b.slotMinutes],
    );
    ok(res, { providerId: b.providerId, serviceLocationId: b.serviceLocationId, weeklyHours: r.rows[0].weekly_hours, slotMinutes: r.rows[0].slot_minutes });
}));

// ------------------------------------------------------------ generic dropdowns used by the booking form
const DROPDOWN_SORT = { fullName: 'full_name', firstName: 'first_name', lastName: 'last_name', visitReasonName: 'visit_reason_name', name: 'name' };

appointmentsRouter.post('/setting/getDropdownListData', h(async (req, res) => {
    const b = parse(z.object({ listName: z.enum(['patient-details', 'users', 'visit-reason', 'service-location']), sortBy: z.string().optional() }), req.body);
    const t = req.user.tenantId;
    const col = DROPDOWN_SORT[b.sortBy] ?? null;
    const sorted = (cols, def) => (col && cols.includes(col) ? col : def);
    let data;
    if (b.listName === 'patient-details') {
        const r = await query(
            `SELECT *, trim(first_name || ' ' || last_name) AS full_name FROM patients WHERE tenant_id = $1 AND is_active ORDER BY ${sorted(['full_name', 'first_name', 'last_name'], 'full_name')}`,
            [t],
        );
        data = r.rows.map((p) => ({ id: p.id, _id: p.id, mrn: p.mrn, firstName: p.first_name, middleName: p.middle_name ?? '', lastName: p.last_name, fullName: p.full_name, emailAddress: p.email ?? '', mobilePhone: p.mobile_phone ?? '', homePhone: p.home_phone ?? '', dob: p.dob, sex: p.sex }));
    } else if (b.listName === 'users') {
        const r = await query(`SELECT * FROM users WHERE tenant_id = $1 AND is_active ORDER BY ${sorted(['first_name', 'last_name'], 'first_name')}`, [t]);
        data = r.rows.map((u) => ({ ...providerOut(u), role: u.role === 'physician' ? ['provider'] : [u.role], userRole: u.role }));
    } else if (b.listName === 'visit-reason') {
        const r = await query(`SELECT * FROM visit_types WHERE tenant_id = $1 AND is_active ORDER BY ${sorted(['visit_reason_name'], 'visit_reason_name')}`, [t]);
        data = r.rows.map(vtOut);
    } else {
        const r = await query(`SELECT * FROM service_locations WHERE tenant_id = $1 AND is_active ORDER BY name`, [t]);
        data = r.rows.map(locOut);
    }
    ok(res, data);
}));
