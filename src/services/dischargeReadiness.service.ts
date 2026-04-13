/**
 * Discharge & billing readiness — mock implementation with a documented REST contract for backend work.
 *
 * -----------------------------------------------------------------------------
 * Future REST integration (high-level contract)
 * -----------------------------------------------------------------------------
 *
 * Aggregate (optional convenience):
 *   GET  /api/encounters/:encounterId/discharge-readiness
 *        → { context, summary, checklist, charges, eligibilityHistory, claimPrep, gates?, clinicalReady?, billingReady? }
 *        Server may compute gates or return raw aggregates only.
 *
 * Discharge summary:
 *   GET  /api/encounters/:encounterId/discharge-summary
 *   PUT  /api/encounters/:encounterId/discharge-summary
 *        Body: Partial<DischargeSummaryState> (structured sections + narrative)
 *   POST /api/encounters/:encounterId/discharge-summary/sign
 *        Body: { attestedByUserId?: string } — server records signer + timestamp, applies lock policy.
 *
 * Nursing checklist:
 *   GET  /api/encounters/:encounterId/discharge-checklist
 *   PUT  /api/encounters/:encounterId/discharge-checklist
 *        Body: { tasks: Partial<ChecklistTask>[] } or PATCH per task id.
 *
 * Charges:
 *   GET  /api/encounters/:encounterId/charges
 *   POST /api/encounters/:encounterId/charges
 *        Body: Omit<ChargeLine, 'id'|'total'> & { id?: string } — server assigns id, computes total.
 *   PATCH /api/encounters/:encounterId/charges/:chargeId
 *
 * Eligibility (270/271 — async in production):
 *   POST /api/encounters/:encounterId/eligibility
 *        Body: { serviceDateFrom, serviceDateTo?, serviceTypeCodes?: string[] }
 *        → { requestId } | inline normalized 271 snapshot
 *   GET  /api/eligibility-requests/:requestId
 *        → status + normalized benefits + raw trace id for support.
 *
 * Claim preparation:
 *   GET  /api/encounters/:encounterId/claim-prep
 *   PUT  /api/encounters/:encounterId/claim-prep
 *   POST /api/encounters/:encounterId/claim-prep/submit
 *        → { claimId, clearinghouseTraceId }
 *
 * Validation / errors: 400 (business rule), 409 (version conflict on summary), 403 (RBAC),
 * 502/504 (clearinghouse). Frontend should surface message + correlation id.
 * -----------------------------------------------------------------------------
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
    const eligOk = Boolean(lastElig && (lastElig.status === 'active' || lastElig.status === 'unknown'));
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

export async function signDischargeSummary(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 100));
    const p = ensurePayload(encounterId.trim());
    if (!p.summary.hospitalCourse.trim()) return { ok: false, message: 'Hospital course is required before sign-off.' };
    if (!p.summary.finalDiagnoses.some((d) => d.isPrincipal)) return { ok: false, message: 'A principal diagnosis is required.' };
    p.summary.status = 'signed';
    p.summary.signedAt = new Date().toISOString();
    p.summary.signedBy = p.context.attendingName;
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
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
    await new Promise((r) => setTimeout(r, 80));
    const p = ensurePayload(encounterId.trim());
    const c = p.charges.find((x) => x.id === chargeId);
    if (!c) return { ok: false, message: 'Charge not found' };
    Object.assign(c, patch);
    if (patch.quantity != null || patch.unitPrice != null) {
        c.total = money(c.quantity * c.unitPrice);
    }
    p.claimPrep.totalCharges = sumCharges(p.charges);
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}

export async function runEligibilityCheck(encounterId: string): Promise<ServiceResult<DischargeReadinessView>> {
    await new Promise((r) => setTimeout(r, 350));
    const p = ensurePayload(encounterId.trim());
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
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
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
    await new Promise((r) => setTimeout(r, 200));
    const view = deriveReadiness(ensurePayload(encounterId.trim()));
    if (!view.billingReady) return { ok: false, message: 'Resolve all hard billing blockers before submit.' };
    const p = ensurePayload(encounterId.trim());
    p.claimPrep.status = 'submitted';
    p.claimPrep.lastSubmittedAt = new Date().toISOString();
    p.claimPrep.payerClaimId = `PAYER-${Math.floor(Math.random() * 1e9)}`;
    store.set(encounterId.trim(), p);
    return { ok: true, data: deriveReadiness(p) };
}
