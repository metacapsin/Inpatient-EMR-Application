/**
 * Discharge & billing readiness — mock implementation with a documented REST contract for backend work.
 *
 * -----------------------------------------------------------------------------
 * Future REST integration (high-level contract)
 * -----------------------------------------------------------------------------
 *
 * Live routes (2xx bodies should be `DischargeReadinessView`, or `{ status, data }` wrapping it):
 *   GET    /api/encounters/:encounterId/discharge-readiness
 *   PUT    /api/encounters/:encounterId/discharge-summary
 *   POST   /api/encounters/:encounterId/discharge-summary/sign
 *   PATCH  /api/encounters/:encounterId/discharge-checklist/tasks/:taskId
 *   POST   /api/encounters/:encounterId/charges
 *   PATCH  /api/encounters/:encounterId/charges/:chargeId
 *   DELETE /api/encounters/:encounterId/charges/:chargeId
 *   POST   /api/encounters/:encounterId/eligibility
 *   PUT    /api/encounters/:encounterId/claim-prep
 *   POST   /api/encounters/:encounterId/claim-prep/submit
 *
 * Claim submit: backend MUST reject when `encounter.dischargeSigned !== true` (UI mirrors this via
 * `context.dischargeSigned` and/or signed discharge summary).
 */

import type {
    ChargeLine,
    ChecklistTask,
    ClaimPrepState,
    DischargeReadinessEncounterContext,
    DischargeReadinessPayload,
    DischargeReadinessView,
    DischargeSummaryState,
    EligibilityRecord,
    ServiceResult,
} from '../types/dischargeReadiness';
import { asRecord } from '../lib/apiPayload';
import {
    CLAIM_SUBMIT_CLINICAL_NOT_READY_MSG,
    CLAIM_SUBMIT_REQUIRES_SIGNED_DISCHARGE_MSG,
    computeReadinessSnapshot,
    isDischargeSignedForClaim,
    isDischargeSummaryDocumentationComplete,
} from '../utils/dischargeReadinessValidation';

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
import { getApiErrorMessage } from '../lib/httpError';
import api from './api';

/** When `"true"`, use in-memory seed data instead of HTTP (see `VITE_USE_MOCK_FACILITY` pattern). */
export const USE_MOCK_DISCHARGE_READINESS = import.meta.env.VITE_USE_MOCK_DISCHARGE_READINESS === 'true';

/** Path templates for future `api` wiring — keep in sync with backend OpenAPI. */
export const DISCHARGE_READINESS_HTTP_ROUTES = {
    readiness: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-readiness`,
    dischargeSummary: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary`,
    dischargeSummarySign: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary/sign`,
    checklist: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-checklist`,
    charges: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/charges`,
    chargeById: (encounterId: string, chargeId: string) =>
        `/api/encounters/${encodeURIComponent(encounterId)}/charges/${encodeURIComponent(chargeId)}`,
    eligibility: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/eligibility`,
    eligibilityRequest: (requestId: string) => `/api/eligibility-requests/${encodeURIComponent(requestId)}`,
    claimPrep: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/claim-prep`,
    claimSubmit: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/claim-prep/submit`,
} as const;

const store = new Map<string, DischargeReadinessPayload>();

function money(n: number): number {
    return Math.round(n * 100) / 100;
}

function sumCharges(lines: ChargeLine[]): number {
    return money(lines.reduce((s, c) => s + c.total, 0));
}

function defaultContext(encounterId: string): DischargeReadinessEncounterContext {
    return {
        encounterId,
        patientId: 'pat-demo-1',
        patientName: 'Jordan Lee',
        mrn: 'MRN-100482',
        admitDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        locationLabel: 'East Wing / 412-A',
        attendingName: 'Dr. Sam Rivera',
    };
}

function seedPayload(encounterId: string): DischargeReadinessPayload {
    const summary: DischargeSummaryState = {
        status: 'draft',
        admissionDiagnosis: 'Community-acquired pneumonia',
        hospitalCourse:
            'Admitted for hypoxia and fever. IV antibiotics started day 1. Oxygen weaned by day 3. Ambulating independently.',
        procedures: [
            { id: 'p1', code: '0BH17EZ', description: 'Insertion of endotracheal tube, via natural or artificial opening' },
        ],
        finalDiagnoses: [
            { id: 'd1', code: 'J18.9', description: 'Pneumonia, unspecified organism', isPrincipal: true },
            { id: 'd2', code: 'I10', description: 'Essential (primary) hypertension', isPrincipal: false },
        ],
        disposition: 'Home',
        conditionAtDischarge: 'Improved',
        dischargeMedications: [
            { id: 'm1', name: 'Amoxicillin-clavulanate 875/125 mg', sig: '1 tablet PO BID x 7 days' },
            { id: 'm2', name: 'Albuterol inhaler', sig: '2 puffs INH q4h PRN wheeze' },
        ],
        followUpInstructions: 'PCP in 7–10 days. Return for fever, worsening shortness of breath, or inability to take oral meds.',
        signedAt: null,
        signedBy: null,
    };

    const checklist: ChecklistTask[] = [
        {
            id: 'c1',
            label: 'Medication reconciliation completed',
            completed: true,
            blocksDischarge: true,
            notes: '',
        },
        {
            id: 'c2',
            label: 'Patient / caregiver education documented',
            completed: true,
            blocksDischarge: true,
            notes: 'Inhaler technique reviewed',
        },
        {
            id: 'c3',
            label: 'Durable medical equipment arranged (if applicable)',
            completed: false,
            blocksDischarge: false,
            notes: 'N/A — none ordered',
        },
        {
            id: 'c4',
            label: 'Follow-up appointments scheduled or given',
            completed: false,
            blocksDischarge: true,
            notes: '',
        },
        {
            id: 'c5',
            label: 'Discharge instructions packet printed / given',
            completed: true,
            blocksDischarge: true,
            notes: '',
        },
    ];

    const charges: ChargeLine[] = [
        {
            id: 'ch1',
            category: 'room_board',
            description: 'Medical/surgical — semi-private',
            serviceDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
            serviceCode: '0120',
            quantity: 4,
            unitPrice: 2850,
            total: 11400,
            status: 'posted',
        },
        {
            id: 'ch2',
            category: 'lab',
            description: 'CMP, CBC with differential',
            serviceDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
            serviceCode: '80053',
            quantity: 1,
            unitPrice: 210,
            total: 210,
            status: 'posted',
        },
        {
            id: 'ch3',
            category: 'radiology',
            description: 'Chest X-ray 2 views',
            serviceDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
            serviceCode: '71045',
            quantity: 1,
            unitPrice: 380,
            total: 380,
            status: 'posted',
        },
        {
            id: 'ch4',
            category: 'pharmacy',
            description: 'IV ceftriaxone (inpatient admin)',
            serviceDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
            serviceCode: 'J0696',
            quantity: 6,
            unitPrice: 45,
            total: 270,
            status: 'pending_capture',
        },
    ];

    const eligibilityHistory: EligibilityRecord[] = [];

    const claimPrep: ClaimPrepState = {
        status: 'not_ready',
        principalDxCode: 'J18.9',
        principalDxDescription: 'Pneumonia, unspecified organism',
        procedureCodes: ['0BH17EZ'],
        totalCharges: sumCharges(charges),
        estimatedPatientResponsibility: 0,
        claimFrequency: '1 — Original',
        admissionType: '3 — Elective (as entered at registration)',
        lastSubmittedAt: null,
        payerClaimId: null,
    };

    return {
        context: { ...defaultContext(encounterId), encounterId },
        summary,
        checklist,
        charges,
        eligibilityHistory,
        claimPrep: { ...claimPrep, totalCharges: sumCharges(charges) },
    };
}

function ensurePayload(encounterId: string): DischargeReadinessPayload {
    let p = store.get(encounterId);
    if (!p) {
        p = seedPayload(encounterId);
        store.set(encounterId, p);
    }
    return p;
}

function deriveReadiness(p: DischargeReadinessPayload): DischargeReadinessView {
    const snap = computeReadinessSnapshot(p);
    return {
        ...p,
        gates: snap.gates,
        clinicalReady: snap.isClinicalReady,
        billingReady: snap.isBillingReady,
    };
}

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

function hasDischargePayloadShape(o: Record<string, unknown>): boolean {
    return (
        asRecord(o.context) != null &&
        asRecord(o.summary) != null &&
        Array.isArray(o.checklist) &&
        Array.isArray(o.charges) &&
        Array.isArray(o.eligibilityHistory) &&
        asRecord(o.claimPrep) != null
    );
}

function parseDischargeReadinessView(raw: unknown): DischargeReadinessView {
    const body = unwrapEnvelope(raw);
    if (!hasDischargePayloadShape(body)) {
        throw new Error('Unexpected discharge readiness response shape');
    }
    const base = body as unknown as DischargeReadinessPayload;
    const p: DischargeReadinessPayload = {
        ...base,
        summary: normalizeDischargeSummary(base.summary),
    };
    return deriveReadiness(p);
}

async function refetchView(encounterId: string): Promise<DischargeReadinessView> {
    const { data } = await api.get(DISCHARGE_READINESS_HTTP_ROUTES.readiness(encounterId));
    return parseDischargeReadinessView(data);
}

async function afterMutation(encounterId: string, raw: unknown): Promise<DischargeReadinessView> {
    if (raw === undefined || raw === null || raw === '') {
        return refetchView(encounterId);
    }
    if (typeof raw === 'object' && raw !== null && Object.keys(raw as object).length === 0) {
        return refetchView(encounterId);
    }
    try {
        return parseDischargeReadinessView(raw);
    } catch {
        return refetchView(encounterId);
    }
}

function mockDelay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

export async function fetchDischargeReadiness(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 120));
    if (!encounterId.trim()) return { ok: false, message: 'Encounter id is required' };
    const p = ensurePayload(encounterId.trim());
    return { ok: true, data: deriveReadiness(p) };
}

export async function saveDischargeSummaryDraft(
    encounterId: string,
    partial: Partial<DischargeSummaryState>
): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 80));
    const p = ensurePayload(encounterId.trim());
    if (p.summary.status === 'signed') return { ok: false, message: 'Signed summaries cannot be edited (use amendment flow on backend).' };
    p.summary = { ...p.summary, ...partial };
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
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
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(100);
        const p = ensurePayload(id);
        if (!isDischargeSummaryDocumentationComplete(p.summary)) {
            return {
                ok: false,
                message:
                    'Complete all required discharge summary fields (including at least one valid ICD-10-CM code in final diagnoses) before sign-off.',
            };
        }
        p.summary.status = 'signed';
        p.summary.signedAt = payload.signedAt;
        p.summary.signedBy = payload.signedBy.trim();
        p.summary.signedByName = payload.signedByName.trim() || null;
        store.set(id, p);
        console.log('Signing payload:', payload);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        console.log('Signing payload:', payload);
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.dischargeSummarySign(id), payload);
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function updateChecklistTask(
    encounterId: string,
    taskId: string,
    patch: Partial<Pick<ChecklistTask, 'completed' | 'notes'>>
): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 80));
    const p = ensurePayload(encounterId.trim());
    const t = p.checklist.find((x) => x.id === taskId);
    if (!t) return { ok: false, message: 'Checklist task not found' };
    Object.assign(t, patch);
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}

export async function addChargeLine(
    encounterId: string,
    line: Omit<ChargeLine, 'id' | 'total'> & { total?: number }
): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 80));
    const p = ensurePayload(encounterId.trim());
    const id = `ch-${Date.now()}`;
    const total = money(line.quantity * line.unitPrice);
    const row: ChargeLine = {
        id,
        category: line.category,
        description: line.description,
        serviceDate: line.serviceDate,
        serviceCode: line.serviceCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total,
        status: line.status,
    };
    p.charges.push(row);
    p.claimPrep.totalCharges = sumCharges(p.charges);
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}

export async function updateChargeLine(
    encounterId: string,
    chargeId: string,
    patch: Partial<Pick<ChargeLine, 'status' | 'quantity' | 'unitPrice' | 'description'>>
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        const c = p.charges.find((x) => x.id === chargeId);
        if (!c) return { ok: false, message: 'Charge not found' };
        if (c.status === 'posted') {
            if (patch.quantity != null || patch.unitPrice != null || patch.description != null) {
                return { ok: false, message: 'Posted charges cannot be edited (adjust via correction workflow).' };
            }
        }
        Object.assign(c, patch);
        if (patch.quantity != null || patch.unitPrice != null) {
            c.total = money(c.quantity * c.unitPrice);
        }
        p.claimPrep.totalCharges = sumCharges(p.charges);
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { data } = await api.patch(DISCHARGE_READINESS_HTTP_ROUTES.chargeById(id, chargeId), patch);
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
    p.claimPrep.totalCharges = sumCharges(p.charges);
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}

export async function deleteChargeLine(encounterId: string, chargeId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        const idx = p.charges.findIndex((x) => x.id === chargeId);
        if (idx < 0) return { ok: false, message: 'Charge not found' };
        const c = p.charges[idx];
        if (c.status === 'posted') {
            return { ok: false, message: 'Posted charges cannot be deleted (use a credit / adjustment workflow).' };
        }
        p.charges.splice(idx, 1);
        p.claimPrep.totalCharges = sumCharges(p.charges);
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        await api.delete(DISCHARGE_READINESS_HTTP_ROUTES.chargeById(id, chargeId));
        const view = await refetchView(id);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function runEligibilityCheck(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(350);
        const p = ensurePayload(id);
        const requestedAt = new Date().toISOString();
        const record: EligibilityRecord = {
            id: `elig-${Date.now()}`,
            requestedAt,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            displaySummary: 'Active coverage — PPO medical in-network benefits apply for facility.',
            planName: 'Mock Health PPO Gold',
            memberId: 'X12****2193',
            copayNote: 'Inpatient copay: $500 per admit (plan summary; verify with remittance).',
            deductibleNote: 'Deductible: $500 individual — met amount not guaranteed from 271.',
            priorAuthRequired: false,
            errorCode: null,
        };
        p.eligibilityHistory.unshift(record);
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const serviceDateFrom = new Date().toISOString().slice(0, 10);
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.eligibility(id), { serviceDateFrom });
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function updateClaimPrep(
    encounterId: string,
    patch: Partial<ClaimPrepState>
): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 80));
    const p = ensurePayload(encounterId.trim());
    p.claimPrep = { ...p.claimPrep, ...patch };
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}

export async function submitClaimPrep(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(200);
        const p = ensurePayload(id);
        if (!isDischargeSignedForClaim(p)) {
            return { ok: false, message: CLAIM_SUBMIT_REQUIRES_SIGNED_DISCHARGE_MSG };
        }
        const snap = computeReadinessSnapshot(p);
        if (!snap.isClinicalReady) {
            return { ok: false, message: CLAIM_SUBMIT_CLINICAL_NOT_READY_MSG };
        }
        if (snap.hardBlockers.length > 0) {
            return { ok: false, message: 'Resolve all readiness blockers before submitting the claim.' };
        }
        p.claimPrep.status = 'submitted';
        p.claimPrep.lastSubmittedAt = new Date().toISOString();
        p.claimPrep.payerClaimId = `PAYER-${Math.floor(Math.random() * 1e9)}`;
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.claimSubmit(id));
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}
