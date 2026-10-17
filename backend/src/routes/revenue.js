import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { badRequest, conflict, h, notFound, ok, created, parse } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';

export const revenueRouter = Router();
const billing = requireRole('billing', 'physician');

// ================================================================= CDI
const cdiOut = (q) => ({
    patientName: '', attendingPhysician: '', attendingPhysicianId: '', los: 0, currentDrg: '', currentDrgWeight: 0, potentialDrg: '', revenueOpportunity: 0,
    queriesSent: 0, assignCdiSpecialist: '', clinicalScenario: '', questionToPhysician: '', optionsProvided: [], sentTo: '', dueDate: '', sentBy: '', sentAt: '',
    physicianResponse: '', selectedOptionId: '', responseLocked: false,
    ...q.data,
    queryId: q.query_id,
    tenantId: q.tenant_id,
    encounterId: q.encounter_id,
    patientId: q.patient_id,
    queryStatus: q.query_status,
    sentToPhysicianId: q.sent_to_physician_id ?? '',
});

const QUERY_TYPES = ['Unclear Documentation', 'CC/MCC Capture', 'Principal Diagnosis Clarification', 'Procedure Clarification', 'POA (Present on Admission) Status', 'Other'];
const formSchema = z.object({
    queryType: z.enum(QUERY_TYPES),
    clinicalScenario: z.string().trim().min(1).max(5000),
    questionToPhysician: z.string().trim().min(1).max(2000),
    optionsProvided: z.array(z.object({ id: z.string().min(1), text: z.string().min(1).max(500) })).min(1).max(10),
    sentTo: z.string().trim().max(200).default(''),
    sentToPhysicianId: z.string().trim().max(100).default(''),
    dueDate: z.string().max(40).default(''),
    currentDrg: z.string().max(20).default(''),
    potentialDrg: z.string().max(20).default(''),
    revenueOpportunity: z.coerce.number().min(0).default(0),
    sentBy: z.string().max(200).default(''),
    sentAt: z.string().max(40).default(''),
});

const getCdi = async (db, req, id) => (await db.query('SELECT * FROM cdi_queries WHERE query_id = $1 AND tenant_id = $2 FOR UPDATE', [id, req.user.tenantId])).rows[0];

revenueRouter.get('/api/CDI/worklist/:tenantId', billing, h(async (req, res) => {
    const r = await query('SELECT * FROM cdi_queries WHERE tenant_id = $1 ORDER BY created_at DESC', [req.user.tenantId]);
    ok(res, r.rows.map(cdiOut));
}));

revenueRouter.post('/api/CDI/query/create', billing, h(async (req, res) => {
    const b = parse(
        formSchema.extend({
            encounterId: z.string().min(1),
            patientId: z.string().min(1),
            patientName: z.string().max(200).default(''),
            attendingPhysician: z.string().max(200).default(''),
            attendingPhysicianId: z.string().max(100).default(''),
            los: z.coerce.number().int().min(0).default(0),
        }),
        req.body,
    );
    const enc = await query('SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2', [b.encounterId, req.user.tenantId]);
    if (!enc.rowCount) throw notFound('Encounter not found');
    if (enc.rows[0].patient_id !== b.patientId) throw badRequest('patientId does not match the encounter');
    const { encounterId, patientId, sentToPhysicianId, ...data } = b;
    const r = await query(
        `INSERT INTO cdi_queries (tenant_id, encounter_id, patient_id, sent_to_physician_id, data) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.user.tenantId, encounterId, patientId, sentToPhysicianId || null, JSON.stringify({ ...data, queriesSent: 0 })],
    );
    created(res, cdiOut(r.rows[0]));
}));

revenueRouter.put('/api/CDI/query/:queryId/send', billing, h(async (req, res) => {
    const f = parse(formSchema, req.body);
    const out = await withTx(async (db) => {
        const q = await getCdi(db, req, req.params.queryId);
        if (!q) throw notFound('CDI query not found');
        if (q.query_status === 'Closed') throw conflict('Query is closed');
        const { sentToPhysicianId, ...data } = f;
        return (
            await db.query(
                `UPDATE cdi_queries SET data = data || $1::jsonb, sent_to_physician_id = $2, query_status = 'Open', updated_at = now() WHERE query_id = $3 RETURNING *`,
                [JSON.stringify({ ...data, queriesSent: (q.data.queriesSent ?? 0) + 1, sentAt: data.sentAt || new Date().toISOString() }), sentToPhysicianId || null, q.query_id],
            )
        ).rows[0];
    });
    ok(res, cdiOut(out));
}));

revenueRouter.get('/api/CDI/query/inbox/:physicianId', h(async (req, res) => {
    const r = await query(`SELECT * FROM cdi_queries WHERE tenant_id = $1 AND sent_to_physician_id = $2 ORDER BY created_at DESC`, [req.user.tenantId, req.params.physicianId]);
    ok(res, r.rows.map(cdiOut));
}));

revenueRouter.put('/api/CDI/query/:queryId/answer', requireRole('physician'), h(async (req, res) => {
    const b = parse(z.object({ selectedOptionId: z.string().min(1), physicianResponse: z.string().max(5000).default('') }), req.body);
    const out = await withTx(async (db) => {
        const q = await getCdi(db, req, req.params.queryId);
        if (!q) throw notFound('CDI query not found');
        if (q.data.responseLocked || q.query_status !== 'Open') throw conflict('This query can no longer be answered');
        if (!(q.data.optionsProvided ?? []).some((o) => o.id === b.selectedOptionId)) throw badRequest('selectedOptionId is not one of the provided options');
        return (
            await db.query(
                `UPDATE cdi_queries SET data = data || $1::jsonb, query_status = 'Answered', updated_at = now() WHERE query_id = $2 RETURNING *`,
                [JSON.stringify({ selectedOptionId: b.selectedOptionId, physicianResponse: b.physicianResponse, responseLocked: true }), q.query_id],
            )
        ).rows[0];
    });
    ok(res, cdiOut(out));
}));

revenueRouter.put('/api/CDI/query/:queryId/close', billing, h(async (req, res) => {
    const r = await query(`UPDATE cdi_queries SET query_status = 'Closed', updated_at = now() WHERE query_id = $1 AND tenant_id = $2 RETURNING *`, [req.params.queryId, req.user.tenantId]);
    if (!r.rowCount) throw notFound('CDI query not found');
    ok(res, cdiOut(r.rows[0]));
}));

revenueRouter.put('/api/CDI/query/:queryId/assign', billing, h(async (req, res) => {
    const { specialist } = parse(z.object({ specialist: z.string().trim().min(1).max(200) }), req.body);
    const r = await query(
        `UPDATE cdi_queries SET data = data || jsonb_build_object('assignCdiSpecialist', $1::text), updated_at = now() WHERE query_id = $2 AND tenant_id = $3 RETURNING *`,
        [specialist, req.params.queryId, req.user.tenantId],
    );
    if (!r.rowCount) throw notFound('CDI query not found');
    ok(res, cdiOut(r.rows[0]));
}));

// ============================================================= Denials
const denialOut = (d) => ({ ...d.data, denialId: d.denial_id, tenantId: d.tenant_id, status: d.status });

const CATEGORIES = ['Authorization', 'Coding', 'Clinical', 'Timely Filing', 'Duplicate', 'Eligibility'];
const STATUSES = ['New', 'Working', 'Appealed', 'Resolved', 'Written Off'];
const money = z.coerce.number().min(0);

const denialBody = z.object({
    claimNumber: z.string().trim().min(1).max(60),
    patientId: z.string().min(1),
    patientName: z.string().max(200).default(''),
    dateOfService: z.string().max(40),
    payer: z.string().trim().min(1).max(200),
    billedAmount: money,
    deniedAmount: money,
    denialCode: z.string().trim().min(1).max(30),
    denialReason: z.string().max(2000).default(''),
    category: z.enum(CATEGORIES),
    appealDeadline: z.string().max(40).default(''),
    status: z.enum(STATUSES).default('New'),
    appeal: z.record(z.string(), z.unknown()).default({}),
});

revenueRouter.get('/api/Denial/worklist/:tenantId', billing, h(async (req, res) => {
    const r = await query('SELECT * FROM claim_denials WHERE tenant_id = $1 ORDER BY created_at DESC', [req.user.tenantId]);
    ok(res, r.rows.map(denialOut));
}));

revenueRouter.post('/api/Denial/create', billing, h(async (req, res) => {
    const { tenantId: _ignored, ...body } = req.body ?? {};
    const b = parse(denialBody, body);
    if (b.deniedAmount > b.billedAmount) throw badRequest('deniedAmount cannot exceed billedAmount');
    const p = await query('SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2', [b.patientId, req.user.tenantId]);
    if (!p.rowCount) throw notFound('Patient not found');
    const { status, ...data } = b;
    const r = await query('INSERT INTO claim_denials (tenant_id, status, data) VALUES ($1,$2,$3) RETURNING *', [req.user.tenantId, status, JSON.stringify(data)]);
    created(res, denialOut(r.rows[0]));
}));

revenueRouter.get('/api/Denial/analytics/:tenantId', billing, h(async (req, res) => {
    const rows = (await query('SELECT * FROM claim_denials WHERE tenant_id = $1', [req.user.tenantId])).rows.map(denialOut);
    const by = (keyFn, valFn = () => 1) => {
        const m = new Map();
        for (const d of rows) m.set(keyFn(d), (m.get(keyFn(d)) ?? 0) + valFn(d));
        return m;
    };
    const appealed = rows.filter((d) => d.appeal?.outcome && d.appeal.outcome !== 'Pending');
    const overturned = appealed.filter((d) => ['Approved', 'Partially Approved'].includes(d.appeal.outcome));
    const totalBilledByPayer = by((d) => d.payer, (d) => d.billedAmount);
    const deniedByPayer = by((d) => d.payer, (d) => d.deniedAmount);
    const monthly = new Map();
    for (const d of rows) {
        const month = String(d.dateOfService ?? '').slice(0, 7) || 'Unknown';
        const cur = monthly.get(month) ?? { month, count: 0, amount: 0 };
        cur.count += 1;
        cur.amount += d.deniedAmount;
        monthly.set(month, cur);
    }
    ok(res, {
        denialByCategory: CATEGORIES.map((category) => ({ category, count: rows.filter((d) => d.category === category).length })),
        denialRateByPayer: [...totalBilledByPayer].map(([payer, billed]) => ({ payer, ratePercent: billed ? Math.round(((deniedByPayer.get(payer) ?? 0) / billed) * 1000) / 10 : 0 })),
        topDenialCodes: [...by((d) => d.denialCode, (d) => d.deniedAmount)].map(([code, amount]) => ({ code, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10),
        appealOverturnRatePercent: appealed.length ? Math.round((overturned.length / appealed.length) * 1000) / 10 : 0,
        monthlyDenialTrend: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    });
}));

async function mutateDenial(req, fn) {
    return withTx(async (db) => {
        const d = (await db.query('SELECT * FROM claim_denials WHERE denial_id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.denialId, req.user.tenantId])).rows[0];
        if (!d) throw notFound('Denial not found');
        const { status, data } = fn(d);
        return (await db.query('UPDATE claim_denials SET status = $1, data = $2, updated_at = now() WHERE denial_id = $3 RETURNING *', [status, JSON.stringify(data), d.denial_id])).rows[0];
    });
}

revenueRouter.put('/api/Denial/:denialId/writeoff', billing, h(async (req, res) => {
    const b = parse(z.object({ writeOffAmount: money, writeOffApprovedBy: z.string().trim().min(1).max(200) }), req.body);
    const out = await mutateDenial(req, (d) => {
        if (b.writeOffAmount > d.data.deniedAmount) throw badRequest('writeOffAmount cannot exceed the denied amount');
        return { status: 'Written Off', data: { ...d.data, appeal: { ...d.data.appeal, writeOffAmount: b.writeOffAmount, writeOffApprovedBy: b.writeOffApprovedBy } } };
    });
    ok(res, denialOut(out));
}));

revenueRouter.post('/api/Denial/:denialId/appeal', billing, h(async (req, res) => {
    const appeal = parse(
        z.object({
            appealLevel: z.string().max(50), appealType: z.string().max(50),
            supportingClinicalDocuments: z.array(z.string().max(500)).default([]),
            appealLetter: z.string().max(20000).default(''), letterS3Upload: z.string().max(500).default(''),
            submittedDate: z.string().max(40).default(''), submittedBy: z.string().max(200).default(''),
            payerReferenceNumber: z.string().max(100).default(''), expectedResponseDate: z.string().max(40).default(''),
            outcome: z.enum(['Approved', 'Partially Approved', 'Denied', 'Pending']).default('Pending'),
            outcomeDate: z.string().max(40).default(''), approvedAmount: money.default(0), writeOffAmount: money.default(0), writeOffApprovedBy: z.string().max(200).default(''),
        }),
        req.body,
    );
    const out = await mutateDenial(req, (d) => {
        if (['Written Off', 'Resolved'].includes(d.status)) throw conflict(`A ${d.status.toLowerCase()} denial cannot be appealed`);
        return { status: 'Appealed', data: { ...d.data, appeal } };
    });
    ok(res, denialOut(out));
}));

revenueRouter.put('/api/Denial/:denialId', billing, h(async (req, res) => {
    const patch = parse(denialBody.partial().omit({ patientId: true }), req.body);
    const out = await mutateDenial(req, (d) => {
        const { status, ...rest } = patch;
        return { status: status ?? d.status, data: { ...d.data, ...rest, appeal: { ...d.data.appeal, ...(rest.appeal ?? {}) } } };
    });
    ok(res, denialOut(out));
}));

