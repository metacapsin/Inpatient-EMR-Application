/**
 * Discharge & billing readiness.
 *
 * Everything here is LIVE against backend/src/routes/dischargeReadiness.js. There is no client-side
 * store: charge capture and claim prep are reported by the server as `sections.*.available === false`
 * and the UI renders an "not available" state for them. Discharge gates come from the server only.
 *
 * Routes (2xx bodies are `{ status, data }` wrapping a `DischargeReadinessView`):
 *   GET    /api/encounters/:encounterId/discharge-readiness
 *   PUT    /api/encounters/:encounterId/discharge-summary
 *   POST   /api/encounters/:encounterId/discharge-summary/sign
 *   PATCH  /api/encounters/:encounterId/discharge-checklist/tasks/:taskId
 *   POST   /api/encounters/:encounterId/eligibility
 */

import type {
    ChecklistTask,
    DischargeReadinessPayload,
    DischargeReadinessView,
    DischargeSummaryState,
    ReadinessGate,
    ServiceResult,
} from '../types/dischargeReadiness';
import { asRecord } from '../lib/apiPayload';
import { getApiErrorMessage } from '../lib/httpError';
import api from './api';

function diagnosisArrayLine(row: Record<string, unknown>): string {
    const code = typeof row.code === 'string' ? row.code : '';
    const desc = typeof row.description === 'string' ? row.description : '';
    const principal = row.isPrincipal === true;
    const body = [code, desc].filter(Boolean).join(' — ');
    if (principal && body) return `Principal: ${body}`;
    return body || code || desc;
}

function procedureArrayLine(row: Record<string, unknown>): string {
    const code = typeof row.code === 'string' ? row.code : '';
    const desc = typeof row.description === 'string' ? row.description : '';
    return [code, desc].filter(Boolean).join(' ').trim();
}

function medicationArrayLine(row: Record<string, unknown>): string {
    const name = typeof row.name === 'string' ? row.name : '';
    const sig = typeof row.sig === 'string' ? row.sig : '';
    if (name && sig) return `${name} — ${sig}`;
    return name || sig;
}

function coerceSummaryMultiline(
    raw: unknown,
    fromRow: (row: Record<string, unknown>) => string
): string {
    if (typeof raw === 'string') return raw;
    if (!Array.isArray(raw)) return '';
    return raw
        .map((item) => {
            const o = asRecord(item);
            return o ? fromRow(o) : '';
        })
        .filter((line) => line.length > 0)
        .join('\n');
}

/** Accepts string fields or legacy row[] from older API payloads. */
function normalizeDischargeSummary(raw: unknown): DischargeSummaryState {
    const s = asRecord(raw);
    if (!s) {
        return {
            status: 'draft',
            admissionDiagnosis: '',
            hospitalCourse: '',
            finalDiagnoses: '',
            procedures: '',
            disposition: 'Home',
            conditionAtDischarge: '',
            dischargeMedications: '',
            followUpInstructions: '',
            signedAt: null,
            signedBy: null,
            signedByName: null,
        };
    }
    const st = s.status === 'signed' || s.status === 'draft' ? s.status : 'draft';
    return {
        status: st,
        admissionDiagnosis: typeof s.admissionDiagnosis === 'string' ? s.admissionDiagnosis : '',
        hospitalCourse: typeof s.hospitalCourse === 'string' ? s.hospitalCourse : '',
        finalDiagnoses: coerceSummaryMultiline(s.finalDiagnoses, diagnosisArrayLine),
        procedures: coerceSummaryMultiline(s.procedures, procedureArrayLine),
        disposition: typeof s.disposition === 'string' ? s.disposition : 'Home',
        conditionAtDischarge: typeof s.conditionAtDischarge === 'string' ? s.conditionAtDischarge : '',
        dischargeMedications: coerceSummaryMultiline(s.dischargeMedications, medicationArrayLine),
        followUpInstructions: typeof s.followUpInstructions === 'string' ? s.followUpInstructions : '',
        signedAt: s.signedAt === null || typeof s.signedAt === 'string' ? (s.signedAt as string | null) : null,
        signedBy: s.signedBy === null || typeof s.signedBy === 'string' ? (s.signedBy as string | null) : null,
        signedByName:
            s.signedByName === null || typeof s.signedByName === 'string' ? (s.signedByName as string | null) : null,
    };
}

export const DISCHARGE_READINESS_HTTP_ROUTES = {
    readiness: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-readiness`,
    dischargeSummary: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary`,
    dischargeSummarySign: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary/sign`,
    checklistTask: (encounterId: string, taskId: string) =>
        `/api/encounters/${encodeURIComponent(encounterId)}/discharge-checklist/tasks/${encodeURIComponent(taskId)}`,
    eligibility: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/eligibility`,
    amaDischarge: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/ama-discharge`,
    deathRecord: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/death-record`,
} as const;

function unwrapEnvelope(raw: unknown): Record<string, unknown> {
    const o = asRecord(raw);
    if (!o) throw new Error('Empty discharge readiness response');
    const st = typeof o.status === 'string' ? o.status.toLowerCase() : '';
    if ((st === 'success' || st === 'ok') && o.data !== undefined) {
        const inner = asRecord(o.data);
        if (inner) return inner;
    }
    return o;
}

function normalizeGates(raw: unknown): ReadinessGate[] {
    if (!Array.isArray(raw)) return [];
    const out: ReadinessGate[] = [];
    for (const item of raw) {
        const g = asRecord(item);
        if (!g || typeof g.id !== 'string') continue;
        out.push({
            id: g.id,
            category: (g.category === 'clinical' || g.category === 'operational' || g.category === 'financial' ? g.category : 'operational'),
            severity: g.severity === 'soft' ? 'soft' : 'hard',
            message: typeof g.message === 'string' ? g.message : g.id,
            resolved: g.resolved === true,
            ownerRole: (g.ownerRole === 'provider' || g.ownerRole === 'nursing' || g.ownerRole === 'billing' || g.ownerRole === 'registration' || g.ownerRole === 'coding' ? g.ownerRole : 'nursing'),
        });
    }
    return out;
}

function parseDischargeReadinessView(raw: unknown): DischargeReadinessView {
    const body = unwrapEnvelope(raw);
    if (asRecord(body.context) == null || asRecord(body.summary) == null || !Array.isArray(body.checklist)) {
        throw new Error('Unexpected discharge readiness response shape');
    }
    const base = body as unknown as DischargeReadinessPayload;
    const gates = normalizeGates(body.gates);
    const sections = asRecord(body.sections) as DischargeReadinessPayload['sections'] | undefined;
    const chargesAvailable = sections?.charges?.available === true && Array.isArray(body.charges);
    const claimAvailable = sections?.claimPrep?.available === true && asRecord(body.claimPrep) != null;
    return {
        context: base.context,
        summary: normalizeDischargeSummary(base.summary),
        checklist: base.checklist,
        eligibilityHistory: Array.isArray(body.eligibilityHistory) ? base.eligibilityHistory : [],
        charges: chargesAvailable ? base.charges : null,
        claimPrep: claimAvailable ? base.claimPrep : null,
        sections,
        gates,
        clinicalReady: body.clinicalReady === true || (gates.length > 0 && gates.every((g) => g.severity !== 'hard' || g.resolved)),
        billingReady: false,
        medRecComplete: typeof body.medRecComplete === 'boolean' ? body.medRecComplete : undefined,
    };
}

async function refetchView(encounterId: string): Promise<DischargeReadinessView> {
    const { data } = await api.get(DISCHARGE_READINESS_HTTP_ROUTES.readiness(encounterId));
    return parseDischargeReadinessView(data);
}

async function afterMutation(encounterId: string, raw: unknown): Promise<DischargeReadinessView> {
    if (raw === undefined || raw === null || raw === '') return refetchView(encounterId);
    if (typeof raw === 'object' && raw !== null && Object.keys(raw as object).length === 0) return refetchView(encounterId);
    try {
        return parseDischargeReadinessView(raw);
    } catch {
        return refetchView(encounterId);
    }
}

export async function fetchDischargeReadiness(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (!id) return { ok: false, message: 'Encounter id is required' };
    try {
        const { data } = await api.get(DISCHARGE_READINESS_HTTP_ROUTES.readiness(id));
        return { ok: true, data: parseDischargeReadinessView(data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function saveDischargeSummaryDraft(
    encounterId: string,
    partial: Partial<DischargeSummaryState>
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    try {
        const { data } = await api.put(DISCHARGE_READINESS_HTTP_ROUTES.dischargeSummary(id), partial);
        return { ok: true, data: await afterMutation(id, data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

/** Body for `POST .../discharge-summary/sign` (encounter id is also in the URL). */
export type DischargeSummarySignPayload = {
    encounterId: string;
    signedBy: string;
    signedByName: string;
    signedAt: string;
};

export async function signDischargeSummary(
    encounterId: string,
    payload: DischargeSummarySignPayload,
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (!payload.signedBy?.trim()) {
        return { ok: false, message: 'Provider identity (signedBy) is required to sign the discharge summary.' };
    }
    try {
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.dischargeSummarySign(id), payload);
        return { ok: true, data: await afterMutation(id, data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function updateChecklistTask(
    encounterId: string,
    taskId: string,
    patch: Partial<Pick<ChecklistTask, 'completed' | 'notes'>>
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    try {
        const { data } = await api.patch(DISCHARGE_READINESS_HTTP_ROUTES.checklistTask(id, taskId), patch);
        return { ok: true, data: await afterMutation(id, data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export type AmaDischargePayload = {
    reason: string;
    risksExplained: boolean;
    witnessName: string;
    patientSignature: string;
};

export async function recordAmaDischarge(
    encounterId: string,
    payload: AmaDischargePayload,
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    try {
        await api.post(DISCHARGE_READINESS_HTTP_ROUTES.amaDischarge(id), payload);
        return { ok: true, data: await refetchView(id) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export type DeathRecordPayload = {
    diedAt: string;
    pronouncingPhysicianId: string;
    causeOfDeath?: string;
};

export async function recordDeath(
    encounterId: string,
    payload: DeathRecordPayload,
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    try {
        await api.post(DISCHARGE_READINESS_HTTP_ROUTES.deathRecord(id), payload);
        return { ok: true, data: await refetchView(id) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function listActivePhysicians(): Promise<ServiceResult<{ id: string; name: string }[]>> {
    try {
        const { data } = await api.get<{ data?: unknown }>('/api/physicians');
        const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const list = rows
            .map((r) => asRecord(r))
            .filter((r): r is Record<string, unknown> => Boolean(r))
            .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? '') }))
            .filter((r) => r.id);
        return { ok: true, data: list };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function runEligibilityCheck(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    try {
        const serviceDateFrom = new Date().toISOString().slice(0, 10);
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.eligibility(id), { serviceDateFrom });
        return { ok: true, data: await afterMutation(id, data) };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}
