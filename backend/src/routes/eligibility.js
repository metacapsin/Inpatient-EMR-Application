import { Router } from 'express';
import { z } from 'zod';
import { h, ok, parse, notFound, ApiError } from '../lib/http.js';
import { query } from '../db/pool.js';
import * as stedi from '../lib/stedi.js';
import { flattenPayerHit } from '../lib/eligibilityMapper.js';
import { runInline, historyByPatient, getCheck } from '../lib/eligibility.js';

/**
 * Stedi payer directory + eligibility (270/271). URL shapes mirror EMR-Backend
 * (`/Payers/search`, `/Eligibility/checkInline`, ...) so the frontend contract matches the reference.
 */
export const eligibilityRouter = Router();

const stediUnavailable = () => new ApiError(503, 'Payer directory unavailable: Stedi is not configured (STEDI_API_KEY)', undefined, 'STEDI_DISABLED');

/** GET /Payers/search?query=&pageSize= — drops payers that do not support eligibility at all. */
eligibilityRouter.get('/Payers/search', h(async (req, res) => {
    const q = parse(z.object({
        query: z.string().trim().min(1).max(100),
        pageSize: z.coerce.number().int().min(1).max(50).default(15),
        pageToken: z.string().optional(),
        eligibilityOnly: z.enum(['true', 'false']).default('true'),
    }), req.query);
    if (!stedi.isEnabled()) throw stediUnavailable();
    const data = await stedi.searchPayers({ query: q.query, pageSize: q.pageSize, pageToken: q.pageToken });
    let items = (data.items ?? []).map(flattenPayerHit);
    // Keep SUPPORTED and ENROLLMENT_REQUIRED (traditional Medicare reports the latter); drop NOT_SUPPORTED.
    if (q.eligibilityOnly === 'true') items = items.filter((p) => p.transactions?.eligibilityCheck !== 'NOT_SUPPORTED');
    ok(res, { items: items.slice(0, q.pageSize), nextPageToken: data.nextPageToken ?? null });
}));

eligibilityRouter.get('/Payers/:stediId', h(async (req, res) => {
    if (!stedi.isEnabled()) throw stediUnavailable();
    const data = await stedi.getPayer(req.params.stediId);
    ok(res, flattenPayerHit(data.payer ? data : { payer: data }));
}));

const insuranceIn = z.object({
    insuranceCompany: z.string().trim().max(200).optional().nullable(),
    tradingPartnerServiceId: z.string().trim().max(80).optional().nullable(),
    subscriberId: z.string().trim().max(80).optional().nullable(),
    policyNumber: z.string().trim().max(80).optional().nullable(),
    groupNumber: z.string().trim().max(80).optional().nullable(),
}).passthrough();

const SERVICE_TYPE = /^[A-Z0-9]{1,3}$/;

/**
 * POST /Eligibility/checkInline — pre-save (or re-check) eligibility from form data.
 * Body: { patientId?, firstName, lastName, dOB, sex?, serviceTypeCodes?, insurance?, secondaryInsurance? }
 * Returns { primary?, secondary? } per-slot summaries. Persists history only when patientId is given.
 */
eligibilityRouter.post('/Eligibility/checkInline', h(async (req, res) => {
    const b = parse(z.object({
        patientId: z.string().optional().nullable(),
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        dOB: z.string().min(8).max(30),
        sex: z.string().optional().nullable(),
        serviceTypeCodes: z.array(z.string().regex(SERVICE_TYPE)).max(5).optional(),
        insurance: insuranceIn.optional().nullable(),
        secondaryInsurance: insuranceIn.optional().nullable(),
    }), req.body);
    let patientId = null;
    if (b.patientId) {
        const r = await query('SELECT id FROM patients WHERE id = $1 AND tenant_id = $2', [b.patientId, req.user.tenantId]);
        if (!r.rowCount) throw notFound('Patient not found');
        patientId = r.rows[0].id;
    }
    const result = await runInline({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        serviceTypeCodes: b.serviceTypeCodes,
        patientInfo: { ...b, patientId },
    });
    ok(res, result, { stediEnabled: stedi.isEnabled() });
}));

eligibilityRouter.get('/Eligibility/historyByPatient/:id', h(async (req, res) => {
    ok(res, await historyByPatient(req.user.tenantId, req.params.id));
}));

eligibilityRouter.get('/Eligibility/getById/:id', h(async (req, res) => {
    const row = await getCheck(req.user.tenantId, req.params.id);
    if (!row) throw notFound('Eligibility check not found');
    ok(res, row);
}));
