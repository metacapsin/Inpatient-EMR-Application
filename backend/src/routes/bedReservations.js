import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, created, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import {
    activeIsolationSql,
    expireStaleReservationsForBed,
    iso,
    lockBed,
    releaseHold,
    sweepExpiredReservations,
} from '../lib/bedManagement.js';

export const bedReservationsRouter = Router();
const clinical = requireRole('physician', 'nurse', 'staff');

const DEFAULT_HOLD_MINUTES = 120;
const MAX_HOLD_MINUTES = 24 * 60;

const RESERVATION_SELECT = `
    SELECT br.*, b.label AS bed_label, b.status AS bed_status, r.id AS room_id, r.room_number, w.id AS ward_id, w.name AS ward_name,
           p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
           u.first_name || ' ' || u.last_name AS reserved_by_name
    FROM bed_reservations br
    JOIN beds b ON b.id = br.bed_id
    JOIN rooms r ON r.id = b.room_id
    JOIN wards w ON w.id = r.ward_id
    LEFT JOIN patients p ON p.id = br.patient_id
    LEFT JOIN users u ON u.id = br.reserved_by`;

const reservationOut = (x) => ({
    id: x.id,
    _id: x.id,
    bedId: x.bed_id,
    bedLabel: x.bed_label,
    bedStatus: x.bed_status,
    roomId: x.room_id,
    roomNumber: x.room_number,
    wardId: x.ward_id,
    wardName: x.ward_name,
    displayLabel: [x.ward_name, x.room_number, x.bed_label].filter(Boolean).join(' · '),
    patientId: x.patient_id,
    patientName: x.patient_name?.trim() || null,
    mrn: x.mrn ?? null,
    encounterId: x.encounter_id,
    reservedBy: x.reserved_by,
    reservedByName: x.reserved_by_name?.trim() || null,
    reservedAt: iso(x.reserved_at),
    expiresAt: iso(x.expires_at),
    status: x.status,
    resolvedAt: iso(x.resolved_at),
    notes: x.notes,
});

async function loadReservation(db, id, tenantId) {
    const r = await db.query(`${RESERVATION_SELECT} WHERE br.id = $1 AND br.tenant_id = $2`, [id, tenantId]);
    if (!r.rowCount) throw notFound('Reservation not found');
    return r.rows[0];
}

// POST /api/beds/:bedId/reserve — timed hold for an expected admission/transfer. Flips the bed to 'hold'.
bedReservationsRouter.post('/api/beds/:bedId/reserve', clinical, h(async (req, res) => {
    const b = parse(
        z.object({
            patientId: z.string().trim().min(1).optional(),
            encounterId: z.string().trim().min(1).optional(),
            expiresInMinutes: z.coerce.number().int().min(5).max(MAX_HOLD_MINUTES).optional(),
            expiresAt: z.string().datetime({ offset: true }).optional(),
            notes: z.string().trim().max(1000).optional(),
        }),
        req.body,
    );
    if (!b.patientId && !b.encounterId) throw badRequest('patientId or encounterId is required so the hold knows who it is for');
    const tenantId = req.user.tenantId;
    const row = await withTx(async (db) => {
        let patientId = b.patientId ?? null;
        if (b.encounterId) {
            const enc = (await db.query(`SELECT id, patient_id, status FROM encounters WHERE id = $1 AND tenant_id = $2`, [b.encounterId, tenantId])).rows[0];
            if (!enc) throw notFound('Encounter not found');
            if (enc.status === 'discharged') throw conflict('Encounter is already discharged');
            if (patientId && patientId !== enc.patient_id) throw badRequest('encounterId does not belong to patientId');
            patientId = enc.patient_id;
        }
        const patient = (await db.query('SELECT id, is_active FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, tenantId])).rows[0];
        if (!patient) throw notFound('Patient not found');
        if (!patient.is_active) throw conflict('Patient record is inactive');

        const bed = await lockBed(db, req.params.bedId, tenantId);
        await expireStaleReservationsForBed(db, bed.id);
        await releaseHold(db, bed.id);
        const fresh = (await db.query('SELECT status FROM beds WHERE id = $1', [bed.id])).rows[0];
        if (fresh.status === 'hold') {
            const existing = (await db.query(`SELECT * FROM bed_reservations WHERE bed_id = $1 AND status = 'active'`, [bed.id])).rows[0];
            throw conflict(existing ? `Bed is already held for another patient until ${iso(existing.expires_at)}` : 'Bed is on manual hold');
        }
        if (!['available', 'dirty'].includes(fresh.status)) throw conflict(`Bed is ${fresh.status} and cannot be reserved`);
        const occ = await db.query(`SELECT 1 FROM encounters WHERE bed_id = $1 AND status <> 'discharged'`, [bed.id]);
        if (occ.rowCount) throw conflict('That bed is occupied');

        const expiresAt = b.expiresAt ? new Date(b.expiresAt) : new Date(Date.now() + (b.expiresInMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000);
        if (expiresAt.getTime() <= Date.now()) throw badRequest('expiresAt must be in the future');
        if (expiresAt.getTime() - Date.now() > MAX_HOLD_MINUTES * 60_000) throw badRequest(`A hold cannot exceed ${MAX_HOLD_MINUTES / 60} hours`);

        const ins = await db.query(
            `INSERT INTO bed_reservations (tenant_id, bed_id, patient_id, encounter_id, reserved_by, expires_at, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [tenantId, bed.id, patientId, b.encounterId ?? null, req.user.id, expiresAt.toISOString(), b.notes ?? null],
        );
        await db.query(`UPDATE beds SET status = 'hold' WHERE id = $1`, [bed.id]);
        return loadReservation(db, ins.rows[0].id, tenantId);
    });
    created(res, reservationOut(row), { message: 'Bed reserved' });
}));

// GET /api/bed-reservations?status=active&bedId=&patientId=
bedReservationsRouter.get('/api/bed-reservations', h(async (req, res) => {
    await sweepExpiredReservations({ query });
    const params = [req.user.tenantId];
    const where = ['br.tenant_id = $1'];
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'active';
    if (status && status !== 'all') { params.push(status); where.push(`br.status = $${params.length}`); }
    if (typeof req.query.bedId === 'string' && req.query.bedId) { params.push(req.query.bedId); where.push(`br.bed_id = $${params.length}`); }
    if (typeof req.query.patientId === 'string' && req.query.patientId) { params.push(req.query.patientId); where.push(`br.patient_id = $${params.length}`); }
    const r = await query(`${RESERVATION_SELECT} WHERE ${where.join(' AND ')} ORDER BY br.expires_at ASC LIMIT 500`, params);
    ok(res, r.rows.map(reservationOut));
}));

bedReservationsRouter.get('/api/bed-reservations/:id', h(async (req, res) => {
    ok(res, reservationOut(await loadReservation({ query }, req.params.id, req.user.tenantId)));
}));

// POST /api/bed-reservations/:id/cancel — bed reverts to available (or dirty if a clean is still open).
bedReservationsRouter.post('/api/bed-reservations/:id/cancel', clinical, h(async (req, res) => {
    const row = await withTx(async (db) => {
        const r = await db.query(
            `UPDATE bed_reservations SET status = 'cancelled', resolved_at = now()
             WHERE id = $1 AND tenant_id = $2 AND status = 'active' RETURNING bed_id`,
            [req.params.id, req.user.tenantId],
        );
        if (!r.rowCount) {
            await loadReservation(db, req.params.id, req.user.tenantId); // 404 if missing
            throw conflict('Reservation is no longer active');
        }
        await releaseHold(db, r.rows[0].bed_id);
        return loadReservation(db, req.params.id, req.user.tenantId);
    });
    ok(res, reservationOut(row), { message: 'Reservation cancelled' });
}));

// POST /api/bed-reservations/:id/extend { expiresInMinutes }
bedReservationsRouter.post('/api/bed-reservations/:id/extend', clinical, h(async (req, res) => {
    const b = parse(z.object({ expiresInMinutes: z.coerce.number().int().min(5).max(MAX_HOLD_MINUTES).default(60) }), req.body ?? {});
    const row = await withTx(async (db) => {
        const r = await db.query(
            `UPDATE bed_reservations SET expires_at = now() + ($3 || ' minutes')::interval
             WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND expires_at > now() RETURNING id`,
            [req.params.id, req.user.tenantId, String(b.expiresInMinutes)],
        );
        if (!r.rowCount) {
            await loadReservation(db, req.params.id, req.user.tenantId);
            throw conflict('Only an active, unexpired reservation can be extended');
        }
        return loadReservation(db, req.params.id, req.user.tenantId);
    });
    ok(res, reservationOut(row), { message: 'Reservation extended' });
}));

// ------------------------------------------------------------------ placement check (soft warnings)
// GET /api/beds/:bedId/placement-check?patientId=&encounterId=
// Advisory only: isolation and same-sex-room checks are hospital-policy UX, not a regulatory requirement,
// so the server never blocks on them — the ADT endpoints enforce only the hard rules (occupied/hold/dirty).
bedReservationsRouter.get('/api/beds/:bedId/placement-check', h(async (req, res) => {
    const tenantId = req.user.tenantId;
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId.trim() : '';
    const encounterId = typeof req.query.encounterId === 'string' ? req.query.encounterId.trim() : '';
    const bed = (
        await query(
            `SELECT b.id, b.label, b.status, r.id AS room_id, r.room_number, r.room_type, r.isolation_required, r.isolation_type, w.id AS ward_id, w.name AS ward_name
             FROM beds b JOIN rooms r ON r.id = b.room_id JOIN wards w ON w.id = r.ward_id WHERE b.id = $1 AND b.tenant_id = $2`,
            [req.params.bedId, tenantId],
        )
    ).rows[0];
    if (!bed) throw notFound('Bed not found');

    let patient = null;
    if (patientId || encounterId) {
        patient = (
            await query(
                `SELECT p.id, p.sex, p.first_name, p.last_name,
                        EXISTS (SELECT 1 FROM encounters e WHERE e.patient_id = p.id AND e.status <> 'discharged' AND ${activeIsolationSql('e')}) AS isolation_active,
                        (SELECT hs.data->>'isolationType' FROM hai_events hs JOIN encounters e2 ON e2.id = hs.encounter_id
                          WHERE e2.patient_id = p.id AND hs.event_type = 'isolation_started' ORDER BY hs.occurred_at DESC LIMIT 1) AS isolation_type
                 FROM patients p WHERE p.tenant_id = $1 AND (p.id = $2 OR p.id = (SELECT patient_id FROM encounters WHERE id = $3))`,
                [tenantId, patientId || null, encounterId || null],
            )
        ).rows[0] ?? null;
        if (!patient) throw notFound('Patient not found');
    }

    const roommates = (
        await query(
            `SELECT p.id, p.sex, p.first_name, p.last_name, b.label AS bed_label, ${activeIsolationSql('e')} AS isolation_active
             FROM encounters e JOIN beds b ON b.id = e.bed_id JOIN patients p ON p.id = e.patient_id
             WHERE b.room_id = $1 AND b.id <> $2 AND e.status <> 'discharged' AND e.tenant_id = $3 AND p.id <> COALESCE($4,'')`,
            [bed.room_id, bed.id, tenantId, patient?.id ?? null],
        )
    ).rows;

    const reservation = (await query(`SELECT * FROM bed_reservations WHERE bed_id = $1 AND status = 'active' AND expires_at > now()`, [bed.id])).rows[0];
    const warnings = [];
    const push = (code, severity, message) => warnings.push({ code, severity, message });

    if (['maintenance', 'blocked', 'dirty'].includes(bed.status)) push('bed_not_available', 'error', `Bed is ${bed.status} and cannot be assigned right now.`);
    if (bed.status === 'hold') {
        const mine = reservation && patient && (reservation.patient_id === patient.id || (encounterId && reservation.encounter_id === encounterId));
        if (reservation && !mine) push('held_for_other_patient', 'error', `Bed is held for another patient until ${iso(reservation.expires_at)}.`);
        else if (!reservation) push('manual_hold', 'error', 'Bed is on manual hold.');
    }
    const initials = (r) => `${(r.first_name || '').charAt(0)}${(r.last_name || '').charAt(0)}`.toUpperCase();
    if (patient?.isolation_active) {
        if (roommates.length) push('isolation_shared_room', 'warning', `Patient has an active isolation precaution${patient.isolation_type ? ` (${patient.isolation_type})` : ''}; this room already has ${roommates.length} other patient(s). Consider a private or isolation room.`);
        if (!bed.isolation_required) push('isolation_room_recommended', 'warning', 'Patient has an active isolation precaution but this room is not flagged as an isolation room.');
    } else if (patient && bed.isolation_required) {
        push('isolation_room_for_non_isolation_patient', 'info', `This is an isolation room${bed.isolation_type ? ` (${bed.isolation_type})` : ''}; the patient has no active isolation precaution. Consider keeping it free for isolation cases.`);
    }
    const isoRoommates = roommates.filter((r) => r.isolation_active);
    if (isoRoommates.length) push('roommate_isolation', 'warning', `Roommate ${isoRoommates.map((r) => `${initials(r)} (bed ${r.bed_label})`).join(', ')} has an active isolation precaution.`);
    // Same-sex accommodation is hospital policy / best practice (NHS England mandates it; US federal rules do not) — soft warning only.
    if (patient && ['M', 'F'].includes(patient.sex)) {
        const mixed = roommates.filter((r) => ['M', 'F'].includes(r.sex) && r.sex !== patient.sex);
        if (mixed.length) push('mixed_sex_room', 'warning', `Shared room: ${mixed.map((r) => `${initials(r)} (bed ${r.bed_label})`).join(', ')} is of a different sex. Check your facility's same-sex accommodation policy.`);
    }

    ok(res, {
        bed: { id: bed.id, label: bed.label, status: bed.status, wardId: bed.ward_id, wardName: bed.ward_name, roomId: bed.room_id, roomNumber: bed.room_number },
        room: { roomType: bed.room_type, isolationRequired: bed.isolation_required, isolationType: bed.isolation_type },
        patient: patient ? { id: patient.id, sex: patient.sex, isolationActive: patient.isolation_active, isolationType: patient.isolation_type ?? null } : null,
        roommates: roommates.map((r) => ({ initials: initials(r), bedLabel: r.bed_label, sex: r.sex, isolationActive: r.isolation_active })),
        reservation: reservation ? { id: reservation.id, patientId: reservation.patient_id, expiresAt: iso(reservation.expires_at) } : null,
        warnings,
        ok: !warnings.some((w) => w.severity === 'error'),
    });
}));
