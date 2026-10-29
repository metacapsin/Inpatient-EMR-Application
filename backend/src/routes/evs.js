// EVS (Environmental Services / housekeeping) bed-turnaround queue.
// Paths match the ones the frontend already named in evsMockService.ts: GET /api/evs/queue,
// POST /api/evs/queue/:id/{assign,start,complete,inspect,approve}, GET /api/evs/metrics, GET /api/evs/beds?ids=
import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { conflict, created, h, notFound, ok, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import { enqueueEvs, iso, lockBed } from '../lib/bedManagement.js';

export const evsRouter = Router();
const evsStaff = requireRole('physician', 'nurse', 'staff');

const QUEUE_SELECT = `
    SELECT q.*, b.label AS bed_label, r.id AS room_id, r.room_number, w.id AS ward_id, w.name AS ward_name,
           p.first_name || ' ' || p.last_name AS discharged_patient_name, e.discharged_at,
           hk.first_name || ' ' || hk.last_name AS housekeeper_name,
           ins.first_name || ' ' || ins.last_name AS inspector_name
    FROM evs_queue q
    JOIN beds b ON b.id = q.bed_id
    JOIN rooms r ON r.id = b.room_id
    JOIN wards w ON w.id = r.ward_id
    LEFT JOIN encounters e ON e.id = q.encounter_id
    LEFT JOIN patients p ON p.id = e.patient_id
    LEFT JOIN users hk ON hk.id = q.assigned_to
    LEFT JOIN users ins ON ins.id = q.inspected_by`;

const minutesBetween = (a, b) => (a && b ? Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60_000)) : undefined);

/** Shape mirrors the frontend's EvsQueueItem type exactly. */
const queueOut = (x) => ({
    id: x.id,
    _id: x.id,
    bedId: x.bed_id,
    roomBedLabel: `${x.room_number}-${x.bed_label}`,
    wardId: x.ward_id,
    wardName: x.ward_name,
    dischargedPatientName: x.discharged_patient_name?.trim() || undefined,
    dischargeTime: iso(x.discharged_at) ?? iso(x.created_at),
    evsStatus: x.status,
    assignedHousekeeperId: x.assigned_to ?? undefined,
    assignedHousekeeperName: x.housekeeper_name?.trim() || undefined,
    cleaningType: x.cleaning_type,
    dirtyAt: iso(x.created_at),
    cleaningStartedAt: iso(x.started_at) ?? undefined,
    cleaningCompletedAt: iso(x.completed_at) ?? undefined,
    inspectedAt: iso(x.inspected_at) ?? undefined,
    inspectedBy: x.inspector_name?.trim() || undefined,
    cleanAt: iso(x.clean_at) ?? undefined,
    turnaroundMinutes: x.clean_at ? minutesBetween(x.created_at, x.clean_at) : undefined,
    encounterId: x.encounter_id ?? undefined,
});

async function loadItem(db, id, tenantId, forUpdate = false) {
    if (forUpdate) {
        const lock = await db.query('SELECT id FROM evs_queue WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [id, tenantId]);
        if (!lock.rowCount) throw notFound('Queue item not found');
    }
    const r = await db.query(`${QUEUE_SELECT} WHERE q.id = $1 AND q.tenant_id = $2`, [id, tenantId]);
    if (!r.rowCount) throw notFound('Queue item not found');
    return r.rows[0];
}

/** Open jobs plus jobs approved clean today (so turnaround metrics have something to average). */
const DEFAULT_QUEUE_WHERE = `(q.status <> 'clean' OR q.clean_at >= date_trunc('day', now()))`;

// GET /api/evs/queue?status=&wardId=&includeClean=all
evsRouter.get('/api/evs/queue', h(async (req, res) => {
    const params = [req.user.tenantId];
    const where = ['q.tenant_id = $1'];
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status) { params.push(status); where.push(`q.status = $${params.length}`); }
    else if (req.query.includeClean !== 'all') where.push(DEFAULT_QUEUE_WHERE);
    if (typeof req.query.wardId === 'string' && req.query.wardId) { params.push(req.query.wardId); where.push(`w.id = $${params.length}`); }
    const r = await query(`${QUEUE_SELECT} WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC LIMIT 500`, params);
    ok(res, r.rows.map(queueOut));
}));

// GET /api/evs/metrics — same KPIs the frontend computed client-side over the mock store.
evsRouter.get('/api/evs/metrics', h(async (req, res) => {
    const t = req.user.tenantId;
    const m = (
        await query(
            `SELECT
                (SELECT round(avg(extract(epoch FROM (clean_at - created_at)) / 60))::int FROM evs_queue
                  WHERE tenant_id = $1 AND status = 'clean' AND clean_at >= date_trunc('day', now())) AS avg_turnaround,
                (SELECT coalesce(max(floor(extract(epoch FROM (now() - created_at)) / 60)), 0)::int FROM evs_queue
                  WHERE tenant_id = $1 AND status <> 'clean') AS longest_wait,
                (SELECT count(*)::int FROM evs_queue WHERE tenant_id = $1 AND status = 'dirty') AS dirty,
                (SELECT count(*)::int FROM evs_queue WHERE tenant_id = $1 AND status = 'in_cleaning') AS in_cleaning,
                (SELECT count(*)::int FROM evs_queue WHERE tenant_id = $1 AND status = 'pending_inspection') AS pending_inspection,
                (SELECT count(*)::int FROM evs_queue WHERE tenant_id = $1 AND status = 'clean' AND clean_at >= date_trunc('day', now())) AS cleaned_today,
                (SELECT count(*)::int FROM beds WHERE tenant_id = $1 AND status = 'available') AS available`,
            [t],
        )
    ).rows[0];
    ok(res, {
        avgTurnaroundMinutesToday: m.avg_turnaround ?? 0,
        longestWaitMinutes: m.longest_wait,
        bedsDirty: m.dirty,
        bedsInCleaning: m.in_cleaning,
        bedsPendingInspection: m.pending_inspection,
        bedsCleanedToday: m.cleaned_today,
        bedsAvailable: m.available,
    });
}));

// GET /api/evs/beds?ids=a,b,c — latest job per bed, keyed by bedId (bed-board overlay).
evsRouter.get('/api/evs/beds', h(async (req, res) => {
    const ids = String(req.query.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 1000);
    if (!ids.length) return ok(res, {});
    const r = await query(
        `${QUEUE_SELECT} WHERE q.tenant_id = $1 AND q.bed_id = ANY($2::text[]) AND ${DEFAULT_QUEUE_WHERE} ORDER BY q.created_at DESC`,
        [req.user.tenantId, ids],
    );
    const map = {};
    for (const row of r.rows) if (!map[row.bed_id]) map[row.bed_id] = queueOut(row);
    ok(res, map);
}));

// GET /api/evs/housekeepers — tenant users who can be assigned cleaning work.
evsRouter.get('/api/evs/housekeepers', h(async (req, res) => {
    const r = await query(
        `SELECT id, first_name, last_name, email, role FROM users WHERE tenant_id = $1 AND is_active AND role IN ('staff','nurse') ORDER BY role DESC, first_name, last_name`,
        [req.user.tenantId],
    );
    ok(res, r.rows.map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim() || u.email, role: u.role })));
}));

// POST /api/evs/queue { bedId, cleaningType? } — manually flag a bed dirty (spill, isolation re-clean, …).
evsRouter.post('/api/evs/queue', evsStaff, h(async (req, res) => {
    const b = parse(z.object({ bedId: z.string().min(1), cleaningType: z.enum(['Terminal', 'Routine', 'Isolation', 'Discharge']).default('Routine') }), req.body);
    const row = await withTx(async (db) => {
        const bed = await lockBed(db, b.bedId, req.user.tenantId);
        if (bed.status === 'occupied') throw conflict('Bed is occupied; discharge or transfer the patient first');
        const occ = await db.query(`SELECT 1 FROM encounters WHERE bed_id = $1 AND status <> 'discharged'`, [bed.id]);
        if (occ.rowCount) throw conflict('Bed is occupied; discharge or transfer the patient first');
        const item = await enqueueEvs(db, { tenantId: req.user.tenantId, bedId: bed.id, cleaningType: b.cleaningType });
        if (!item) throw conflict('Bed already has an open cleaning job');
        if (bed.status === 'available') await db.query(`UPDATE beds SET status = 'dirty' WHERE id = $1`, [bed.id]);
        return loadItem(db, item.id, req.user.tenantId);
    });
    created(res, queueOut(row), { message: 'Bed added to the EVS queue' });
}));

function transition(path, { from, apply, message }) {
    evsRouter.post(`/api/evs/queue/:id/${path}`, evsStaff, h(async (req, res) => {
        const row = await withTx(async (db) => {
            const item = await loadItem(db, req.params.id, req.user.tenantId, true);
            if (from && !from.includes(item.status)) throw conflict(`Bed must be ${from.join(' or ').replace(/_/g, ' ')} (currently ${item.status.replace(/_/g, ' ')})`);
            await apply(db, item, req);
            return loadItem(db, req.params.id, req.user.tenantId);
        });
        ok(res, queueOut(row), { message });
    }));
}

transition('assign', {
    from: ['dirty', 'in_cleaning'],
    message: 'Housekeeper assigned',
    apply: async (db, item, req) => {
        const b = parse(z.object({ housekeeperId: z.string().min(1) }), req.body);
        const hk = await db.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active', [b.housekeeperId, req.user.tenantId]);
        if (!hk.rowCount) throw notFound('Housekeeper not found');
        await db.query('UPDATE evs_queue SET assigned_to = $1 WHERE id = $2', [b.housekeeperId, item.id]);
    },
});

transition('start', {
    from: ['dirty'],
    message: 'Cleaning started',
    apply: async (db, item, req) => {
        // Starting without an explicit assignment assigns the actor (the person who started it is cleaning it).
        await db.query(`UPDATE evs_queue SET status = 'in_cleaning', started_at = now(), assigned_to = COALESCE(assigned_to, $2) WHERE id = $1`, [item.id, req.user.id]);
    },
});

transition('complete', {
    from: ['in_cleaning'],
    message: 'Sent for inspection',
    apply: async (db, item) => {
        await db.query(`UPDATE evs_queue SET status = 'pending_inspection', completed_at = now() WHERE id = $1`, [item.id]);
    },
});

transition('inspect', {
    from: ['pending_inspection'],
    message: 'Inspection recorded',
    apply: async (db, item, req) => {
        await db.query(`UPDATE evs_queue SET inspected_by = $2, inspected_at = now() WHERE id = $1`, [item.id, req.user.id]);
    },
});

transition('approve', {
    from: ['pending_inspection'],
    message: 'Bed marked clean',
    apply: async (db, item, req) => {
        await db.query(
            `UPDATE evs_queue SET status = 'clean', clean_at = now(), inspected_by = COALESCE(inspected_by, $2), inspected_at = COALESCE(inspected_at, now()) WHERE id = $1`,
            [item.id, req.user.id],
        );
        // Back in service. A bed reserved while it was being cleaned stays 'hold' for its patient.
        await db.query(`UPDATE beds SET status = 'available' WHERE id = $1 AND status = 'dirty'`, [item.bed_id]);
    },
});
