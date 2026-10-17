import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const facilityRouter = Router();
const admin = requireRole(); // admin only

const idOf = (b) => b?.id ?? b?._id;
const text = (max = 200) => z.string().trim().min(1).max(max);

const wardOut = (w) => ({ id: w.id, _id: w.id, wardName: w.name, name: w.name, code: w.code ?? '', unitCode: w.code ?? '' });
const roomOut = (r) => ({ id: r.id, _id: r.id, wardId: r.ward_id, roomNumber: r.room_number, roomName: r.room_number, name: r.room_number, roomType: r.room_type });
const bedOut = (b) => {
    const occupied = Boolean(b.patient_id) || b.status === 'occupied';
    return {
        id: b.id,
        _id: b.id,
        roomId: b.room_id,
        bedLabel: b.label,
        bedName: b.label,
        name: b.label,
        bedStatus: occupied ? 'occupied' : b.status,
        status: occupied ? 'occupied' : b.status,
        isOccupied: occupied,
        patientId: b.patient_id ?? null,
    };
};

// ---------------------------------------------------------------- wards
facilityRouter.get('/Wards/getWardList', h(async (req, res) => {
    const r = await query('SELECT * FROM wards WHERE tenant_id = $1 ORDER BY name', [req.user.tenantId]);
    ok(res, r.rows.map(wardOut));
}));

facilityRouter.post('/Wards/CreateWard', admin, h(async (req, res) => {
    const b = parse(z.object({ name: text().optional(), wardName: text().optional(), code: z.string().trim().max(20).optional(), unitCode: z.string().trim().max(20).optional() }), req.body);
    const name = b.wardName ?? b.name;
    if (!name) throw parse(z.object({ name: text() }), {}) ;
    const r = await query('INSERT INTO wards (tenant_id, name, code) VALUES ($1,$2,$3) RETURNING *', [req.user.tenantId, name, (b.code ?? b.unitCode) || null]);
    created(res, wardOut(r.rows[0]), { message: 'Ward created' });
}));

facilityRouter.put('/Wards/updateWardById', admin, h(async (req, res) => {
    const b = parse(z.object({ id: z.string().optional(), _id: z.string().optional(), name: text().optional(), wardName: text().optional(), code: z.string().trim().max(20).optional(), unitCode: z.string().trim().max(20).optional() }), req.body);
    const id = idOf(b);
    if (!id) throw parse(z.object({ id: text() }), {});
    const r = await query(
        `UPDATE wards SET name = COALESCE($1, name), code = COALESCE($2, code) WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        [b.wardName ?? b.name ?? null, b.code ?? b.unitCode ?? null, id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Ward not found');
    ok(res, wardOut(r.rows[0]));
}));

async function assertNoActiveEncounters(where, params) {
    const r = await query(
        `SELECT 1 FROM encounters e JOIN beds b ON b.id = e.bed_id JOIN rooms r ON r.id = b.room_id
         WHERE e.status <> 'discharged' AND ${where} LIMIT 1`,
        params,
    );
    if (r.rowCount) throw conflict('Cannot delete: there are patients currently admitted here');
}

facilityRouter.delete('/Wards/deleteWardById/:id', admin, h(async (req, res) => {
    await assertNoActiveEncounters('r.ward_id = $1', [req.params.id]);
    const r = await query('DELETE FROM wards WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Ward not found');
    res.json({ status: 'success', message: 'Ward deleted' });
}));

// ---------------------------------------------------------------- rooms
facilityRouter.get('/Rooms/getRoomList', h(async (req, res) => {
    const r = await query('SELECT * FROM rooms WHERE tenant_id = $1 ORDER BY room_number', [req.user.tenantId]);
    ok(res, r.rows.map(roomOut));
}));

facilityRouter.post('/Rooms/CreateRoom', admin, h(async (req, res) => {
    const b = parse(z.object({ wardId: text(), roomNumber: text(50), roomType: z.string().trim().max(50).default('General') }), req.body);
    const ward = await query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.wardId, req.user.tenantId]);
    if (!ward.rowCount) throw notFound('Ward not found');
    const r = await query('INSERT INTO rooms (tenant_id, ward_id, room_number, room_type) VALUES ($1,$2,$3,$4) RETURNING *', [req.user.tenantId, b.wardId, b.roomNumber, b.roomType || 'General']);
    created(res, roomOut(r.rows[0]));
}));

facilityRouter.put('/Rooms/updateRoomById', admin, h(async (req, res) => {
    const b = parse(z.object({ id: z.string().optional(), _id: z.string().optional(), wardId: z.string().optional(), roomNumber: text(50).optional(), roomType: z.string().trim().max(50).optional() }), req.body);
    const id = idOf(b);
    if (!id) throw parse(z.object({ id: text() }), {});
    if (b.wardId) {
        const ward = await query('SELECT 1 FROM wards WHERE id = $1 AND tenant_id = $2', [b.wardId, req.user.tenantId]);
        if (!ward.rowCount) throw notFound('Ward not found');
    }
    const r = await query(
        `UPDATE rooms SET ward_id = COALESCE($1, ward_id), room_number = COALESCE($2, room_number), room_type = COALESCE($3, room_type)
         WHERE id = $4 AND tenant_id = $5 RETURNING *`,
        [b.wardId ?? null, b.roomNumber ?? null, b.roomType ?? null, id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Room not found');
    ok(res, roomOut(r.rows[0]));
}));

facilityRouter.delete('/Rooms/deleteRoomById/:id', admin, h(async (req, res) => {
    await assertNoActiveEncounters('r.id = $1', [req.params.id]);
    const r = await query('DELETE FROM rooms WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Room not found');
    res.json({ status: 'success', message: 'Room deleted' });
}));

// ---------------------------------------------------------------- beds
const BED_SELECT = `
    SELECT b.*, e.patient_id
    FROM beds b
    LEFT JOIN encounters e ON e.bed_id = b.id AND e.status <> 'discharged'`;

facilityRouter.get('/Beds/getBedList', h(async (req, res) => {
    const r = await query(`${BED_SELECT} WHERE b.tenant_id = $1 ORDER BY b.label`, [req.user.tenantId]);
    ok(res, r.rows.map(bedOut));
}));

facilityRouter.post('/Beds/CreateBed', admin, h(async (req, res) => {
    const b = parse(z.object({ roomId: text(), bedLabel: text(50).optional(), bedName: text(50).optional() }), req.body);
    const label = b.bedLabel ?? b.bedName;
    if (!label) throw parse(z.object({ bedLabel: text() }), {});
    const room = await query('SELECT 1 FROM rooms WHERE id = $1 AND tenant_id = $2', [b.roomId, req.user.tenantId]);
    if (!room.rowCount) throw notFound('Room not found');
    const r = await query('INSERT INTO beds (tenant_id, room_id, label) VALUES ($1,$2,$3) RETURNING *', [req.user.tenantId, b.roomId, label]);
    created(res, bedOut(r.rows[0]));
}));

facilityRouter.put('/Beds/updateBedById', admin, h(async (req, res) => {
    const b = parse(
        z.object({
            id: z.string().optional(), _id: z.string().optional(), roomId: z.string().optional(),
            bedLabel: text(50).optional(), bedName: text(50).optional(),
            status: z.enum(['available', 'hold', 'maintenance', 'blocked', 'dirty']).optional(),
        }),
        req.body,
    );
    const id = idOf(b);
    if (!id) throw parse(z.object({ id: text() }), {});
    if (b.roomId) {
        const room = await query('SELECT 1 FROM rooms WHERE id = $1 AND tenant_id = $2', [b.roomId, req.user.tenantId]);
        if (!room.rowCount) throw notFound('Room not found');
    }
    const r = await query(
        `UPDATE beds SET room_id = COALESCE($1, room_id), label = COALESCE($2, label), status = COALESCE($3, status)
         WHERE id = $4 AND tenant_id = $5 AND (status <> 'occupied' OR $3::text IS NULL) RETURNING *`,
        [b.roomId ?? null, b.bedLabel ?? b.bedName ?? null, b.status ?? null, id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Bed not found (or its status cannot be changed while occupied)');
    ok(res, bedOut(r.rows[0]));
}));

facilityRouter.delete('/Beds/deleteBedById/:id', admin, h(async (req, res) => {
    const active = await query(`SELECT 1 FROM encounters WHERE bed_id = $1 AND status <> 'discharged'`, [req.params.id]);
    if (active.rowCount) throw conflict('Cannot delete a bed with an admitted patient');
    const r = await query('DELETE FROM beds WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
    if (!r.rowCount) throw notFound('Bed not found');
    res.json({ status: 'success', message: 'Bed deleted' });
}));

// ------------------------------------------------------------ bed board
facilityRouter.get('/Beds/getLiveBedBoard', h(async (req, res) => {
    const { wardId, roomId, bedStatus } = req.query;
    const params = [req.user.tenantId];
    const where = ['b.tenant_id = $1'];
    if (typeof wardId === 'string' && wardId) { params.push(wardId); where.push(`w.id = $${params.length}`); }
    if (typeof roomId === 'string' && roomId) { params.push(roomId); where.push(`r.id = $${params.length}`); }
    const r = await query(
        `SELECT b.id AS bed_id, b.label, b.status AS stored_status,
                r.id AS room_id, r.room_number, w.id AS ward_id, w.name AS ward_name,
                e.id AS enc_id, e.admitted_at, e.status AS enc_status, e.patient_id,
                p.first_name, p.last_name, p.mrn, p.dob
         FROM beds b
         JOIN rooms r ON r.id = b.room_id
         JOIN wards w ON w.id = r.ward_id
         LEFT JOIN encounters e ON e.bed_id = b.id AND e.status <> 'discharged'
         LEFT JOIN patients p ON p.id = e.patient_id
         WHERE ${where.join(' AND ')}
         ORDER BY w.name, r.room_number, b.label`,
        params,
    );
    const all = r.rows.map((x) => {
        const status = x.enc_id ? 'occupied' : x.stored_status === 'occupied' ? 'available' : x.stored_status;
        return {
            bed: { id: x.bed_id, _id: x.bed_id, bedLabel: x.label, bedStatus: status },
            room: { id: x.room_id, roomNumber: x.room_number, wardId: x.ward_id },
            ward: { id: x.ward_id, wardName: x.ward_name },
            encounter: x.enc_id
                ? { id: x.enc_id, admissionTimestamp: x.admitted_at?.toISOString(), status: x.enc_status, patientId: x.patient_id, bedId: x.bed_id }
                : null,
            patient: x.patient_id
                ? { id: x.patient_id, displayName: `${x.first_name} ${x.last_name}`.trim(), mrn: x.mrn, dateOfBirth: x.dob ?? undefined }
                : null,
        };
    });
    const rowsOut = typeof bedStatus === 'string' && bedStatus ? all.filter((x) => x.bed.bedStatus === bedStatus.toLowerCase()) : all;
    const byStatus = {};
    for (const x of rowsOut) byStatus[x.bed.bedStatus] = (byStatus[x.bed.bedStatus] ?? 0) + 1;
    ok(res, {
        rows: rowsOut,
        summary: {
            totalBeds: rowsOut.length,
            byStatus,
            withActiveEncounter: rowsOut.filter((x) => x.encounter).length,
            occupiedWithoutEncounter: rowsOut.filter((x) => x.bed.bedStatus === 'occupied' && !x.encounter).length,
        },
    });
}));
