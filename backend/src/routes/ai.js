import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { ApiError, h, ok, parse, rows } from '../lib/http.js';
import { config, isProd } from '../config.js';
import { generateText, isAiEnabled, parseJsonText } from '../lib/gemini.js';

export const aiRouter = Router();

// AI calls are available to clinical roles only (admin passes via requireRole's bypass).
const clinical = requireRole('physician', 'nurse', 'pharmacist');

// Per-user throttle: the key is the authenticated user, not the IP, so one busy workstation
// cannot exhaust another's budget. Skipped under test like the global limiter in app.js.
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isProd ? 30 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
    skip: () => config.env === 'test',
    message: { status: 'error', message: 'Too many AI requests, slow down', code: 'AI_RATE_LIMITED' },
});

const DISCLAIMER = 'AI-generated content. Verify against the medical record before clinical use.';

async function logRequest({ req, patientId, endpoint, model, prompt, status, errorCode, startedAt, usage }) {
    try {
        await query(
            `INSERT INTO ai_requests (tenant_id, user_id, patient_id, endpoint, model, prompt_sha256, status, error_code, latency_ms, prompt_tokens, output_tokens)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                req.user.tenantId,
                req.user.id,
                patientId ?? null,
                endpoint,
                model,
                crypto.createHash('sha256').update(prompt).digest('hex'),
                status,
                errorCode ?? null,
                Date.now() - startedAt,
                usage?.promptTokens ?? 0,
                usage?.outputTokens ?? 0,
            ],
        );
    } catch (e) {
        console.error('[ai] failed to write ai_requests row:', e.message);
    }
}

/** Runs a model call, always writes the audit row, rethrows the ApiError. */
async function audited(req, { patientId, endpoint, prompt }, fn) {
    const startedAt = Date.now();
    try {
        const out = await fn();
        await logRequest({ req, patientId, endpoint, model: out.model, prompt, status: 'ok', startedAt, usage: out.usage });
        return out;
    } catch (e) {
        const code = e instanceof ApiError ? e.code ?? `HTTP_${e.status}` : 'UNEXPECTED';
        await logRequest({ req, patientId, endpoint, model: config.ai.model, prompt, status: 'error', errorCode: code, startedAt });
        throw e;
    }
}

aiRouter.get('/api/ai/status', h(async (_req, res) => {
    ok(res, { enabled: isAiEnabled(), model: config.ai.model, disclaimer: DISCLAIMER });
}));

// Admin-only read of the ai_requests ledger (Settings → Audit Trail's second tab). No prompt or
// response text is ever stored here (see logRequest above) — only ids, model, status and timing.
aiRouter.get(
    '/api/ai/requests',
    requireRole('admin'),
    h(async (req, res) => {
        const f = parse(
            z.object({
                patientId: z.string().trim().min(1).optional(),
                limit: z.coerce.number().int().min(1).max(200).default(100),
                skip: z.coerce.number().int().min(0).default(0),
            }),
            req.query,
        );
        const params = [req.user.tenantId];
        let where = 'tenant_id = $1';
        if (f.patientId) {
            params.push(f.patientId);
            where += ` AND patient_id = $${params.length}`;
        }
        params.push(f.limit, f.skip);
        const r = await query(
            `SELECT * FROM ai_requests WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );
        ok(res, rows(r.rows));
    }),
);

// ------------------------------------------------------------------ medication explanation
const MEDICATION_SYSTEM = `You are a medical information assistant that provides patient-friendly medication explanations in clear, simple, accurate language.
Respond ONLY with a JSON object of this exact shape:
{"medicationName":"string","medicationType":"string","usedFor":["string"],"howItWorks":"string","howToTake":{"dose":"string","route":"string","duration":"string","instructions":["string"]},"importantPrecautions":["string"],"commonSideEffects":["string"],"seriousSideEffects":["string"],"whenToContactDoctor":["string"],"additionalNotes":"string"}
Use "Not specified" when information is unavailable. Do not invent doses that were not provided.`;

const optStr = (max) => z.string().trim().max(max).optional().default('');
const medicationBody = z.object({
    patientId: z.string().trim().min(1).max(100).optional(),
    brandName: optStr(200),
    genericName: optStr(200),
    description: optStr(500),
    strength: optStr(100),
    route: optStr(100),
    type: optStr(100),
    doseInstruction: optStr(300),
    frequency: optStr(100),
    duration: optStr(100),
    quantity: optStr(50),
    refills: optStr(50),
});

const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const str = (v, d = 'Not specified') => (typeof v === 'string' && v.trim() ? v.trim() : d);

aiRouter.post('/api/ai/medication-explanation', clinical, aiLimiter, h(async (req, res) => {
    const b = parse(medicationBody, req.body);
    const name = b.brandName || b.genericName;
    if (!name) throw new ApiError(400, 'brandName or genericName is required');
    // Medication facts only; no patient identity, dates or free-text notes are sent to the model.
    const lines = [
        'Explain the following medication for a patient:',
        b.brandName && `Brand name: ${b.brandName}`,
        b.genericName && `Generic name: ${b.genericName}`,
        b.description && `Description: ${b.description}`,
        b.strength && `Strength: ${b.strength}`,
        b.route && `Route: ${b.route}`,
        b.type && `Type: ${b.type}`,
        b.doseInstruction && `Dose instruction: ${b.doseInstruction}`,
        b.frequency && `Frequency: ${b.frequency}`,
        b.duration && `Duration: ${b.duration}`,
        b.quantity && `Quantity: ${b.quantity}`,
        b.refills && `Refills: ${b.refills}`,
    ].filter(Boolean);
    const prompt = lines.join('\n');

    const out = await audited(req, { patientId: b.patientId, endpoint: 'medication-explanation', prompt }, () =>
        generateText({ system: MEDICATION_SYSTEM, user: prompt, json: true, maxOutputTokens: 1024, temperature: 0.2 }),
    );
    const p = parseJsonText(out.text);
    ok(res, {
        medicationName: str(p.medicationName, name),
        medicationType: str(p.medicationType),
        usedFor: arr(p.usedFor),
        howItWorks: str(p.howItWorks, 'Information not available'),
        howToTake: {
            dose: str(p.howToTake?.dose),
            route: str(p.howToTake?.route),
            duration: str(p.howToTake?.duration),
            instructions: arr(p.howToTake?.instructions),
        },
        importantPrecautions: arr(p.importantPrecautions),
        commonSideEffects: arr(p.commonSideEffects),
        seriousSideEffects: arr(p.seriousSideEffects),
        whenToContactDoctor: arr(p.whenToContactDoctor),
        additionalNotes: str(p.additionalNotes, ''),
        disclaimer: DISCLAIMER,
        model: out.model,
    });
}));

// ------------------------------------------------------------------ chart chatbot
/**
 * Minimised, server-built patient context: clinical facts only (no name, MRN, DOB, address,
 * contacts, insurance). Capped per section so the prompt stays small and bounded.
 */
async function buildPatientContext(tenantId, patientId) {
    const patient = (await query('SELECT id, sex, dob FROM patients WHERE id = $1 AND tenant_id = $2', [patientId, tenantId])).rows[0];
    if (!patient) throw new ApiError(404, 'Patient not found');
    const ageYears = patient.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

    const [problems, allergies, meds, vitals, labs, encounter] = await Promise.all([
        query(`SELECT icd10_code, icd10_description, status, chronicity, onset_date FROM problems
               WHERE tenant_id=$1 AND patient_id=$2 AND status <> 'entered_in_error' ORDER BY status, created_at DESC LIMIT 25`, [tenantId, patientId]),
        query(`SELECT allergen, reaction, severity, allergy_type FROM patient_allergies
               WHERE tenant_id=$1 AND patient_id=$2 AND is_active ORDER BY created_at DESC LIMIT 25`, [tenantId, patientId]),
        query(`SELECT name, dose, route, frequency, source FROM medications
               WHERE tenant_id=$1 AND patient_id=$2 AND is_active ORDER BY source, name LIMIT 40`, [tenantId, patientId]),
        query(`SELECT DISTINCT ON (metric_type) metric_type, value_primary, value_secondary, unit, recorded_at FROM health_metrics
               WHERE tenant_id=$1 AND patient_id=$2 ORDER BY metric_type, recorded_at DESC`, [tenantId, patientId]),
        query(`SELECT test_name, value_num, value_text, unit, abnormal_flag, is_critical, resulted_at FROM lab_results lr
               JOIN lab_orders lo ON lo.id = lr.lab_order_id
               WHERE lr.tenant_id=$1 AND lo.patient_id=$2 ORDER BY lr.resulted_at DESC NULLS LAST LIMIT 30`, [tenantId, patientId]).catch(() => ({ rows: [] })),
        query(`SELECT admission_type, diagnosis, admitted_at, status FROM encounters
               WHERE tenant_id=$1 AND patient_id=$2 AND status <> 'discharged' ORDER BY admitted_at DESC LIMIT 1`, [tenantId, patientId]),
    ]);
    const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : undefined);
    return {
        demographics: { sex: patient.sex, ageYears },
        currentEncounter: encounter.rows[0]
            ? { admissionType: encounter.rows[0].admission_type, admissionDiagnosis: encounter.rows[0].diagnosis, admittedOn: d(encounter.rows[0].admitted_at), status: encounter.rows[0].status }
            : null,
        problems: problems.rows.map((r) => ({ code: r.icd10_code, description: r.icd10_description, status: r.status, chronicity: r.chronicity, onset: d(r.onset_date) })),
        allergies: allergies.rows.map((r) => ({ allergen: r.allergen, reaction: r.reaction, severity: r.severity, type: r.allergy_type })),
        medications: meds.rows.map((r) => ({ name: r.name, dose: r.dose, route: r.route, frequency: r.frequency, source: r.source })),
        latestVitals: vitals.rows.map((r) => ({ type: r.metric_type, value: r.value_primary, value2: r.value_secondary, unit: r.unit, at: d(r.recorded_at) })),
        recentLabs: labs.rows.map((r) => ({ test: r.test_name, value: r.value_num ?? r.value_text, unit: r.unit, flag: r.abnormal_flag, critical: r.is_critical, at: d(r.resulted_at) })),
    };
}

const CHAT_SYSTEM = `You are a clinical information assistant for hospital staff reviewing an inpatient chart.
Answer only from the patient context provided; if the context does not contain the answer, say so plainly.
Do not recommend specific doses or treatments; summarise what is documented and highlight items worth reviewing.
Be concise and structured. Never guess the patient's identity.`;

const chatBody = z.object({
    patientId: z.string().trim().min(1).max(100),
    query: z.string().trim().min(1).max(4000),
    history: z
        .array(z.object({ role: z.enum(['user', 'assistant', 'model']), content: z.string().trim().min(1).max(4000) }))
        .max(20)
        .optional()
        .default([]),
    maxTokens: z.number().int().min(64).max(2048).optional(),
    temperature: z.number().min(0).max(1).optional(),
});

aiRouter.post('/api/ai/chatbot', clinical, aiLimiter, h(async (req, res) => {
    const b = parse(chatBody, req.body);
    const context = await buildPatientContext(req.user.tenantId, b.patientId);
    const contextJson = JSON.stringify(context);
    const user = `Patient context (JSON):\n${contextJson.slice(0, 12000)}\n\nQuestion: ${b.query}`;
    const history = b.history.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.content }));

    const out = await audited(req, { patientId: b.patientId, endpoint: 'chatbot', prompt: user }, () =>
        generateText({ system: CHAT_SYSTEM, user, history, maxOutputTokens: b.maxTokens ?? 1024, temperature: b.temperature ?? 0.3 }),
    );
    res.json({
        status: 'success',
        message: { role: 'assistant', content: out.text },
        content: out.text,
        disclaimer: DISCLAIMER,
        model: out.model,
    });
}));
