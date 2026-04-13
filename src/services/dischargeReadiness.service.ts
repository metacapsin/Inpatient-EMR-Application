/**
 * Discharge & billing readiness.
 *
 * By default this module calls the inpatient discharge / billing aggregate API
 * (`Encounter/DischargeReadinessController`). Set `VITE_USE_MOCK_DISCHARGE_READINESS=true`
 * for offline UI demos with seeded in-memory data.
 *
 * Live routes (2xx bodies should be `DischargeReadinessView`, or `{ status, data }` wrapping it):
 *   GET    /api/encounters/:encounterId/discharge-readiness
 *   PUT    /api/encounters/:encounterId/discharge-summary
 *   POST   /api/encounters/:encounterId/discharge-summary/sign
 *   PATCH  /api/encounters/:encounterId/discharge-checklist/tasks/:taskId
 *   POST   /api/encounters/:encounterId/charges
 *   PATCH  /api/encounters/:encounterId/charges/:chargeId
 *   POST   /api/encounters/:encounterId/eligibility
 *   PUT    /api/encounters/:encounterId/claim-prep
 *   POST   /api/encounters/:encounterId/claim-prep/submit
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
    ReadinessGate,
    ServiceResult,
} from '../types/dischargeReadiness';
import { asRecord } from '../lib/apiPayload';

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

export const DISCHARGE_READINESS_HTTP_ROUTES = {
    readiness: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-readiness`,
    dischargeSummary: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary`,
    dischargeSummarySign: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/discharge-summary/sign`,
    checklistTask: (encounterId: string, taskId: string) =>
        `/api/encounters/${encodeURIComponent(encounterId)}/discharge-checklist/tasks/${encodeURIComponent(taskId)}`,
    charges: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/charges`,
    chargeById: (encounterId: string, chargeId: string) =>
        `/api/encounters/${encodeURIComponent(encounterId)}/charges/${encodeURIComponent(chargeId)}`,
    eligibility: (encounterId: string) => `/api/encounters/${encodeURIComponent(encounterId)}/eligibility`,
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
        procedures: '0BH17EZ — Insertion of endotracheal tube, via natural or artificial opening',
        finalDiagnoses:
            'Principal: J18.9 — Pneumonia, unspecified organism\nI10 — Essential (primary) hypertension',
        disposition: 'Home',
        conditionAtDischarge: 'Improved',
        dischargeMedications:
            'Amoxicillin-clavulanate 875/125 mg — 1 tablet PO BID × 7 days\nAlbuterol inhaler — 2 puffs INH q4h PRN wheeze',
        followUpInstructions: 'PCP in 7–10 days. Return for fever, worsening shortness of breath, or inability to take oral meds.',
        signedAt: null,
        signedBy: null,
        signedByName: null,
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

function computeGates(p: DischargeReadinessPayload): ReadinessGate[] {
    const gates: ReadinessGate[] = [];

    const summarySigned = p.summary.status === 'signed';
    gates.push({
        id: 'gate-summary-signed',
        category: 'clinical',
        severity: 'hard',
        message: 'Discharge summary must be signed by a provider',
        resolved: summarySigned,
        ownerRole: 'provider',
    });

    const checklistBlockers = p.checklist.filter((t) => t.blocksDischarge && !t.completed);
    gates.push({
        id: 'gate-nursing-checklist',
        category: 'operational',
        severity: checklistBlockers.length === 0 ? 'soft' : 'hard',
        message:
            checklistBlockers.length === 0
                ? 'All required nursing discharge tasks are complete'
                : `Incomplete nursing tasks: ${checklistBlockers.map((t) => t.label).join('; ')}`,
        resolved: checklistBlockers.length === 0,
        ownerRole: 'nursing',
    });

    const pendingCharges = p.charges.filter((c) => c.status === 'pending_capture');
    gates.push({
        id: 'gate-charges-pending',
        category: 'financial',
        severity: pendingCharges.length > 0 ? 'hard' : 'soft',
        message:
            pendingCharges.length === 0
                ? 'No charges stuck in pending capture'
                : `${pendingCharges.length} charge line(s) still pending capture`,
        resolved: pendingCharges.length === 0,
        ownerRole: 'billing',
    });

    const lastElig = p.eligibilityHistory[0];
    gates.push({
        id: 'gate-eligibility',
        category: 'financial',
        severity: 'hard',
        message: lastElig
            ? lastElig.status === 'inactive' || lastElig.status === 'error'
                ? `Coverage issue: ${lastElig.displaySummary}`
                : 'Coverage verified for inquiry window'
            : 'Eligibility (270/271) has not been run for this encounter',
        resolved: Boolean(lastElig && lastElig.status === 'active'),
        ownerRole: 'billing',
    });

    const hasPrincipal = Boolean(p.claimPrep.principalDxCode?.trim());
    gates.push({
        id: 'gate-principal-dx',
        category: 'financial',
        severity: 'hard',
        message: hasPrincipal ? 'Principal diagnosis present for claim' : 'Principal diagnosis required for inpatient claim',
        resolved: hasPrincipal,
        ownerRole: 'coding',
    });

    return gates;
}

function deriveReadiness(p: DischargeReadinessPayload): DischargeReadinessView {
    const gates = computeGates(p);
    const hardUnresolved = gates.filter((g) => g.severity === 'hard' && !g.resolved);
    const clinicalIds = new Set(['gate-summary-signed', 'gate-nursing-checklist']);
    const financialIds = new Set(['gate-charges-pending', 'gate-eligibility', 'gate-principal-dx']);

    const clinicalHard = hardUnresolved.filter((g) => clinicalIds.has(g.id));
    const billingHard = hardUnresolved.filter((g) => financialIds.has(g.id));

    return {
        ...p,
        gates,
        clinicalReady: clinicalHard.length === 0,
        billingReady: billingHard.length === 0,
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
    if (
        Array.isArray(body.gates) &&
        typeof body.clinicalReady === 'boolean' &&
        typeof body.billingReady === 'boolean'
    ) {
        return { ...(body as unknown as DischargeReadinessView), summary: p.summary };
    }
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
    const id = encounterId.trim();
    if (!id) return { ok: false, message: 'Encounter id is required' };
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(120);
        const p = ensurePayload(id);
        return { ok: true, data: deriveReadiness(p) };
    }
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
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        if (p.summary.status === 'signed') return { ok: false, message: 'Signed summaries cannot be edited (use amendment flow on backend).' };
        p.summary = { ...p.summary, ...partial };
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { data } = await api.put(DISCHARGE_READINESS_HTTP_ROUTES.dischargeSummary(id), partial);
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
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
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(100);
        const p = ensurePayload(id);
        if (!p.summary.hospitalCourse.trim()) return { ok: false, message: 'Hospital course is required before sign-off.' };
        if (!p.summary.finalDiagnoses.trim()) {
            return { ok: false, message: 'Final diagnoses (ICD-10-CM) are required before sign-off.' };
        }
        if (!/\bprincipal\b/i.test(p.summary.finalDiagnoses)) {
            return {
                ok: false,
                message: 'Mark the principal diagnosis (e.g. start a line with "Principal:") before sign-off.',
            };
        }
        if (!p.summary.procedures.trim()) {
            return { ok: false, message: 'Procedures are required before sign-off.' };
        }
        if (!p.summary.dischargeMedications.trim()) {
            return { ok: false, message: 'Discharge medications are required before sign-off.' };
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
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        const t = p.checklist.find((x) => x.id === taskId);
        if (!t) return { ok: false, message: 'Checklist task not found' };
        Object.assign(t, patch);
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { data } = await api.patch(DISCHARGE_READINESS_HTTP_ROUTES.checklistTask(id, taskId), patch);
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function addChargeLine(
    encounterId: string,
    line: Omit<ChargeLine, 'id' | 'total'> & { total?: number }
): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        const chId = `ch-${Date.now()}`;
        const total = money(line.quantity * line.unitPrice);
        const row: ChargeLine = {
            id: chId,
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
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { category, description, serviceDate, serviceCode, quantity, unitPrice, status } = line;
        const { data } = await api.post(DISCHARGE_READINESS_HTTP_ROUTES.charges(id), {
            category,
            description,
            serviceDate,
            serviceCode,
            quantity,
            unitPrice,
            status,
        });
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
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
}

export async function runEligibilityCheck(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(350);
        const p = ensurePayload(id);
        const record: EligibilityRecord = {
            id: `elig-${Date.now()}`,
            requestedAt: new Date().toISOString(),
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
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(80);
        const p = ensurePayload(id);
        p.claimPrep = { ...p.claimPrep, ...patch };
        store.set(id, p);
        return { ok: true, data: deriveReadiness(p) };
    }
    try {
        const { data } = await api.put(DISCHARGE_READINESS_HTTP_ROUTES.claimPrep(id), patch);
        const view = await afterMutation(id, data);
        return { ok: true, data: view };
    } catch (e) {
        return { ok: false, message: getApiErrorMessage(e) };
    }
}

export async function submitClaimPrep(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    const id = encounterId.trim();
    if (USE_MOCK_DISCHARGE_READINESS) {
        await mockDelay(200);
        const view = deriveReadiness(ensurePayload(id));
        if (!view.billingReady) return { ok: false, message: 'Resolve all hard billing blockers before submit.' };
        const p = ensurePayload(id);
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
