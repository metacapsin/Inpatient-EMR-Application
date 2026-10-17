import { Router } from 'express';
import { query } from '../db/pool.js';
import { h, notFound, ok } from '../lib/http.js';

export const dashboardRouter = Router();

const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

// Inpatient dashboard: KPIs, bed board and alerts derived from live beds/encounters.
dashboardRouter.get('/dashboard/ipd', h(async (req, res) => {
    const t = req.user.tenantId;
    const board = await query(
        `SELECT b.id AS bed_id, b.label, b.status AS bed_status, r.room_number, w.name AS ward_name,
                e.id AS encounter_id, e.patient_id, e.admitted_at, e.attending_physician_id,
                p.first_name || ' ' || p.last_name AS patient_name,
                u.first_name || ' ' || u.last_name AS doctor_name
         FROM beds b
         JOIN rooms r ON r.id = b.room_id
         JOIN wards w ON w.id = r.ward_id
         LEFT JOIN encounters e ON e.bed_id = b.id AND e.status <> 'discharged'
         LEFT JOIN patients p ON p.id = e.patient_id
         LEFT JOIN users u ON u.id = e.attending_physician_id AND u.tenant_id = b.tenant_id
         WHERE b.tenant_id = $1
         ORDER BY w.name, r.room_number, b.label`,
        [t],
    );
    const discharged = await query(
        `SELECT count(*)::int AS n FROM encounters WHERE tenant_id = $1 AND status = 'discharged' AND discharged_at >= date_trunc('day', now())`,
        [t],
    );
    const admitted = await query(`SELECT count(*)::int AS n FROM encounters WHERE tenant_id = $1 AND status <> 'discharged'`, [t]);

    const rows = board.rows.map((x) => ({
        rowId: x.bed_id,
        ward: x.ward_name,
        room: x.room_number,
        bed: x.label,
        patientName: x.encounter_id ? x.patient_name : null,
        status: x.encounter_id ? 'Occupied' : x.bed_status === 'dirty' ? 'Cleaning' : x.bed_status === 'available' ? 'Available' : x.bed_status,
        doctor: x.doctor_name ?? '',
        admitDate: iso(x.admitted_at),
        encounterId: x.encounter_id,
        patientId: x.patient_id,
    }));
    ok(res, {
        kpis: {
            totalAdmittedPatients: admitted.rows[0].n,
            occupiedBeds: rows.filter((r) => r.status === 'Occupied').length,
            availableBeds: rows.filter((r) => r.status === 'Available').length,
            dischargedToday: discharged.rows[0].n,
        },
        bedBoard: rows,
        alerts: {
            criticalPatients: [], // no acuity scoring is stored yet
            bedsPendingCleaning: rows.filter((r) => r.status === 'Cleaning').map((r) => `${r.ward} · ${r.room} · ${r.bed}`),
            transferRequests: [],
        },
    });
}));

// ------------------------------------------------------------ notifications (per user)
const notifOut = (n) => ({
    _id: n.id,
    id: n.id,
    userId: n.user_id,
    tenantId: n.tenant_id,
    type: n.type,
    action: n.action,
    message: n.message,
    metadata: n.metadata,
    isRead: n.is_read,
    status: n.is_active,
    createdBy: n.created_by ?? '',
    createdAt: iso(n.created_at),
    modifiedAt: iso(n.modified_at),
});

dashboardRouter.get('/notifications', h(async (req, res) => {
    const r = await query(
        `SELECT * FROM notifications WHERE user_id = $1 AND tenant_id = $2 AND is_active ORDER BY created_at DESC LIMIT 100`,
        [req.user.id, req.user.tenantId],
    );
    ok(res, r.rows.map(notifOut));
}));

dashboardRouter.put('/notifications/:id/read', h(async (req, res) => {
    const r = await query(
        `UPDATE notifications SET is_read = true, modified_at = now() WHERE id = $1 AND user_id = $2 AND tenant_id = $3 RETURNING *`,
        [req.params.id, req.user.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Notification not found');
    ok(res, notifOut(r.rows[0]));
}));

dashboardRouter.delete('/notifications/:id', h(async (req, res) => {
    const r = await query(
        `UPDATE notifications SET is_active = false, modified_at = now() WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
        [req.params.id, req.user.id, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('Notification not found');
    res.json({ status: 'success' });
}));
