import type {
    ClaimPrepStatus,
    DischargeReadinessPayload,
    DischargeSummaryState,
    EligibilityRecord,
    ReadinessGate,
} from '../types/dischargeReadiness';

function dedupePreserveOrder(messages: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of messages) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        out.push(m);
    }
    return out;
}

/** Ordered unresolved gates (any severity) for full UI / validation lists. */
function collectOrderedUnresolvedGateMessages(gates: ReadinessGate[], order: readonly string[]): string[] {
    const byId = new Map(gates.map((g) => [g.id, g]));
    const out: string[] = [];
    for (const id of order) {
        const g = byId.get(id);
        if (g && !g.resolved) out.push(g.message);
    }
    return dedupePreserveOrder(out);
}

/** Ordered hard-unresolved gates for strict claim checks that only count hard blockers. */
function collectOrderedHardUnresolvedGateMessages(gates: ReadinessGate[], order: readonly string[]): string[] {
    const byId = new Map(gates.map((g) => [g.id, g]));
    const out: string[] = [];
    for (const id of order) {
        const g = byId.get(id);
        if (g && !g.resolved && g.severity === 'hard') out.push(g.message);
    }
    return dedupePreserveOrder(out);
}

/** ICD-10-CM code pattern (letter + 2 digits + optional .digits). */
export const ICD10_CM_CODE_REGEX = /^[A-Z][0-9]{2}(\.[0-9A-Z]+)*$/;

export const REQUIRED_FIELD_MSG = 'This field is required';

/** Default eligibility freshness when `expiresAt` is not returned by the payer interface. */
export const ELIGIBILITY_VALID_MS = 24 * 60 * 60 * 1000;

export function normalizePrincipalIcdInput(raw: string): string {
    return raw.trim().toUpperCase();
}

export function isValidIcd10CmCode(raw: string): boolean {
    const n = normalizePrincipalIcdInput(raw);
    return n.length > 0 && ICD10_CM_CODE_REGEX.test(n);
}

/** Error message for a single ICD-10-CM code, or `undefined` when valid. */
export function getIcd10CmValidationError(code: string): string | undefined {
    const n = normalizePrincipalIcdInput(code);
    if (!n) return REQUIRED_FIELD_MSG;
    if (!ICD10_CM_CODE_REGEX.test(n)) return 'Use ICD-10-CM format (e.g. J18.9, I10, R07.89)';
    return undefined;
}

/** @deprecated use isValidIcd10CmCode */
export const PRINCIPAL_ICD10_CM_REGEX = ICD10_CM_CODE_REGEX;

/** @deprecated use getIcd10CmValidationError */
export function isValidPrincipalIcd(raw: string): boolean {
    return isValidIcd10CmCode(raw);
}

/** @deprecated use getIcd10CmValidationError */
export function getPrincipalIcdValidationError(code: string): string | undefined {
    return getIcd10CmValidationError(code);
}

/** Pull ICD-10-CM-like tokens from free text (final diagnoses block). */
export function extractIcd10CandidatesFromText(text: string): string[] {
    const upper = text.toUpperCase();
    const re = /\b([A-Z][0-9]{2}(?:\.[0-9A-Z]+)*)\b/g;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(upper)) !== null) {
        out.push(m[1]);
    }
    return out;
}

export function finalDiagnosesContainValidIcd10(text: string): boolean {
    const candidates = extractIcd10CandidatesFromText(text);
    return candidates.some((c) => isValidIcd10CmCode(c));
}

export function getFinalDiagnosesIcdError(text: string): string | undefined {
    const t = text.trim();
    if (!t) return REQUIRED_FIELD_MSG;
    if (!finalDiagnosesContainValidIcd10(t)) {
        return 'Enter at least one ICD-10-CM code (e.g. J18.9) in the diagnoses list';
    }
    return undefined;
}

export type DischargeSummaryRequiredKey =
    | 'admissionDiagnosis'
    | 'hospitalCourse'
    | 'finalDiagnoses'
    | 'dischargeMedications'
    | 'followUpInstructions';

export type DischargeSummaryRequiredErrors = Partial<Record<DischargeSummaryRequiredKey, string>>;

export type DischargeSummaryValidatedFields = Record<DischargeSummaryRequiredKey, string>;

export function validateDischargeSummaryRequired(form: DischargeSummaryValidatedFields): {
    ok: boolean;
    errors: DischargeSummaryRequiredErrors;
} {
    const errors: DischargeSummaryRequiredErrors = {};
    if (!form.admissionDiagnosis.trim()) errors.admissionDiagnosis = REQUIRED_FIELD_MSG;
    if (!form.hospitalCourse.trim()) errors.hospitalCourse = REQUIRED_FIELD_MSG;
    const fdErr = getFinalDiagnosesIcdError(form.finalDiagnoses);
    if (fdErr) errors.finalDiagnoses = fdErr;
    if (!form.dischargeMedications.trim()) errors.dischargeMedications = REQUIRED_FIELD_MSG;
    if (!form.followUpInstructions.trim()) errors.followUpInstructions = REQUIRED_FIELD_MSG;
    return { ok: Object.keys(errors).length === 0, errors };
}

/** Summary documentation complete for sign-off (draft path). */
export function isDischargeSummaryDocumentationComplete(summary: DischargeSummaryState): boolean {
    if (summary.status === 'signed') return true;
    const { ok } = validateDischargeSummaryRequired({
        admissionDiagnosis: summary.admissionDiagnosis ?? '',
        hospitalCourse: summary.hospitalCourse ?? '',
        finalDiagnoses: summary.finalDiagnoses ?? '',
        dischargeMedications: summary.dischargeMedications ?? '',
        followUpInstructions: summary.followUpInstructions ?? '',
    });
    return ok;
}

export function eligibilityExpiresAtMs(record: EligibilityRecord): number {
    if (record.expiresAt) {
        const t = new Date(record.expiresAt).getTime();
        if (!Number.isNaN(t)) return t;
    }
    const req = new Date(record.requestedAt).getTime();
    if (Number.isNaN(req)) return 0;
    return req + ELIGIBILITY_VALID_MS;
}

export function isEligibilityValidForDischarge(record: EligibilityRecord | undefined, nowMs: number = Date.now()): boolean {
    if (!record) return false;
    if (record.status !== 'active') return false;
    return nowMs < eligibilityExpiresAtMs(record);
}

export function formatEligibilityExpiryLabel(record: EligibilityRecord): string {
    return new Date(eligibilityExpiresAtMs(record)).toLocaleString();
}

function principalDxValid(claimPrep: DischargeReadinessPayload['claimPrep']): boolean {
    const code = claimPrep.principalDxCode?.trim() ?? '';
    return !getIcd10CmValidationError(code);
}

export function computeReadinessGates(p: DischargeReadinessPayload, nowMs: number = Date.now()): ReadinessGate[] {
    const gates: ReadinessGate[] = [];

    const summarySigned = p.summary.status === 'signed';
    const summaryDocOk = isDischargeSummaryDocumentationComplete(p.summary);

    gates.push({
        id: 'gate-summary-fields',
        category: 'clinical',
        severity: 'hard',
        message: summaryDocOk
            ? 'Required discharge summary documentation is present'
            : 'Complete required discharge summary sections (diagnoses must include a valid ICD-10-CM code)',
        resolved: summaryDocOk,
        ownerRole: 'provider',
    });

    gates.push({
        id: 'gate-summary-signed',
        category: 'clinical',
        severity: 'hard',
        message: summarySigned ? 'Discharge summary is signed' : 'Discharge summary must be signed by a provider',
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

    const chargeCount = p.charges.length;
    gates.push({
        id: 'gate-charges-count',
        category: 'financial',
        severity: 'hard',
        message: chargeCount > 0 ? 'At least one charge line is present' : 'Add at least one charge line before billing / discharge',
        resolved: chargeCount > 0,
        ownerRole: 'billing',
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

    const chargeLineSum = p.charges.reduce((s, c) => s + c.total, 0);
    const totalChargesPositive = p.charges.length > 0 && p.claimPrep.totalCharges > 0 && chargeLineSum > 0;
    gates.push({
        id: 'gate-charges-positive-total',
        category: 'financial',
        severity: 'hard',
        message: totalChargesPositive
            ? 'Total charges are greater than zero'
            : p.charges.length === 0
              ? 'Total charges must be positive (add charge lines with non-zero line totals and matching claim prep total)'
              : 'Total charges must be greater than zero (claim prep total and line totals must both be positive)',
        resolved: totalChargesPositive,
        ownerRole: 'billing',
    });

    const encounterRoutingOk = Boolean(p.context.encounterId?.trim()) && Boolean(p.context.patientId?.trim());
    gates.push({
        id: 'gate-encounter-claim-routing',
        category: 'financial',
        severity: 'hard',
        message: encounterRoutingOk
            ? 'Encounter is linked for claim routing'
            : 'Encounter and patient identifiers are required for claim submission',
        resolved: encounterRoutingOk,
        ownerRole: 'billing',
    });

    const ub04ContextOk =
        Boolean(p.claimPrep.claimFrequency?.trim()) && Boolean(p.claimPrep.admissionType?.trim());
    gates.push({
        id: 'gate-claim-ub04-context',
        category: 'financial',
        severity: 'hard',
        message: ub04ContextOk
            ? 'UB-04 / 837I context (frequency, admission type) is populated'
            : 'UB-04 / 837I context is incomplete: enter claim frequency and admission type',
        resolved: ub04ContextOk,
        ownerRole: 'billing',
    });

    const lastElig = p.eligibilityHistory[0];
    const eligOk = isEligibilityValidForDischarge(lastElig, nowMs);
    gates.push({
        id: 'gate-eligibility',
        category: 'financial',
        severity: 'hard',
        message: (() => {
            if (!lastElig) return 'Eligibility (270/271) has not been run for this encounter';
            if (lastElig.status === 'error') {
                return `Eligibility error: ${lastElig.displaySummary || lastElig.errorCode || 'Unknown'}`;
            }
            if (lastElig.status === 'inactive') {
                return `Coverage inactive: ${lastElig.displaySummary}`;
            }
            if (lastElig.status !== 'active') return `Eligibility status not usable: ${lastElig.displaySummary}`;
            if (!eligOk) {
                return `Eligibility expired (valid through ${formatEligibilityExpiryLabel(lastElig)}). Run a new check.`;
            }
            return 'Active eligibility on file within the allowed time window';
        })(),
        resolved: eligOk,
        ownerRole: 'billing',
    });

    const principalOk = principalDxValid(p.claimPrep);
    gates.push({
        id: 'gate-principal-dx',
        category: 'financial',
        severity: 'hard',
        message: principalOk
            ? 'Principal ICD-10-CM is valid for claim preparation'
            : 'Enter a valid principal ICD-10-CM code for the inpatient claim (e.g. J18.9)',
        resolved: principalOk,
        ownerRole: 'coding',
    });

    return gates;
}

/**
 * Hard gates that define UI "billing ready" (tab, header, finalize billing leg).
 * Excludes eligibility and pending capture so payer work does not show a false "billing not ready" on those alone.
 */
export const BILLING_READY_GATE_IDS = [
    'gate-charges-count',
    'gate-charges-positive-total',
    'gate-encounter-claim-routing',
    'gate-claim-ub04-context',
    'gate-principal-dx',
] as const;

const BILLING_READY_GATE_ID_SET = new Set<string>(BILLING_READY_GATE_IDS);

/** Full claim-submit evaluation order (summary, charges, insurance, billing coding) — collect all hard failures. */
const CLAIM_SUBMIT_GATE_ORDER: string[] = [
    'gate-summary-signed',
    'gate-summary-fields',
    'gate-nursing-checklist',
    'gate-charges-count',
    'gate-charges-positive-total',
    'gate-charges-pending',
    'gate-eligibility',
    'gate-encounter-claim-routing',
    'gate-claim-ub04-context',
    'gate-principal-dx',
];

/** Discharge workspace alert: summary, operational, charges, insurance, billing — all unresolved gates. */
export const DISCHARGE_WORKSPACE_GATE_DISPLAY_ORDER: readonly string[] = [
    'gate-summary-fields',
    'gate-summary-signed',
    'gate-nursing-checklist',
    'gate-charges-count',
    'gate-charges-positive-total',
    'gate-charges-pending',
    'gate-eligibility',
    'gate-encounter-claim-routing',
    'gate-claim-ub04-context',
    'gate-principal-dx',
];

export type ReadinessSnapshot = {
    gates: ReadinessGate[];
    /** Signed summary + nursing checklist clear (ADT-style clinical discharge track). */
    isClinicalReady: boolean;
    /** Billing tab / header / finalize: only {@link BILLING_READY_GATE_IDS} (not eligibility or pending capture). */
    isBillingReady: boolean;
    /** Provider may execute sign when true (draft summary, all preconditions except signature). */
    canSignDischargeSummary: boolean;
    hardBlockers: ReadinessGate[];
    softBlockers: ReadinessGate[];
};

/** Preconditions for signing the discharge summary (clinical + charge presence; not full claim billing). */
const SIGN_RELEVANT_GATE_IDS = new Set([
    'gate-summary-fields',
    'gate-nursing-checklist',
    'gate-charges-count',
    'gate-charges-pending',
]);

export function computeReadinessSnapshot(p: DischargeReadinessPayload, nowMs: number = Date.now()): ReadinessSnapshot {
    const gates = computeReadinessGates(p, nowMs);
    const hardUnresolved = gates.filter((g) => g.severity === 'hard' && !g.resolved);
    const softUnresolved = gates.filter((g) => g.severity === 'soft' && !g.resolved);

    const clinicalHardIds = new Set(['gate-summary-signed', 'gate-nursing-checklist']);

    const clinicalHard = hardUnresolved.filter((g) => clinicalHardIds.has(g.id));
    const billingReadyUnresolved = hardUnresolved.filter((g) => BILLING_READY_GATE_ID_SET.has(g.id));

    const summaryFieldsOk = gates.find((g) => g.id === 'gate-summary-fields')?.resolved ?? false;
    const signPrecheckHard = hardUnresolved.filter((g) => SIGN_RELEVANT_GATE_IDS.has(g.id));
    const canSignDischargeSummary =
        p.summary.status === 'draft' && summaryFieldsOk && signPrecheckHard.length === 0;

    return {
        gates,
        isClinicalReady: clinicalHard.length === 0,
        isBillingReady: billingReadyUnresolved.length === 0,
        canSignDischargeSummary,
        hardBlockers: hardUnresolved,
        softBlockers: softUnresolved,
    };
}

/** Shown when claim submit is blocked because discharge is not signed (matches backend rule on `encounter.dischargeSigned`). */
export const CLAIM_SUBMIT_REQUIRES_SIGNED_DISCHARGE_MSG =
    'Please sign discharge summary before submitting claim';

export const CLAIM_SUBMIT_CLINICAL_NOT_READY_MSG =
    'Clinical discharge readiness is not complete (signed summary and nursing checklist required).';

/**
 * Whether the encounter is considered discharged/signed for billing purposes.
 * Prefer API `context.dischargeSigned` when present; otherwise discharge summary status.
 */
export function isDischargeSignedForClaim(p: DischargeReadinessPayload): boolean {
    if (p.context.dischargeSigned === true) return true;
    if (p.context.dischargeSigned === false) return false;
    return p.summary.status === 'signed';
}

/**
 * All claim-submit issues (hard gates in order + discharge-signed rule + live principal ICD form).
 * Does not stop at the first failure.
 */
export function getClaimSubmitValidationMessages(params: {
    payload: DischargeReadinessPayload;
    snapshot: ReadinessSnapshot | undefined;
    principalDxCodeForm: string;
    canEdit: boolean;
    claimPrepStatus: ClaimPrepStatus;
}): string[] {
    const messages: string[] = [];
    if (!params.canEdit) return ['Your role cannot submit claims.'];
    if (params.claimPrepStatus === 'submitted') return ['Claim already submitted.'];
    if (!params.snapshot) return ['Unable to evaluate readiness.'];

    if (!isDischargeSignedForClaim(params.payload)) {
        messages.push(CLAIM_SUBMIT_REQUIRES_SIGNED_DISCHARGE_MSG);
    }

    const submitGateIds = !isDischargeSignedForClaim(params.payload)
        ? CLAIM_SUBMIT_GATE_ORDER.filter((id) => id !== 'gate-summary-signed')
        : CLAIM_SUBMIT_GATE_ORDER;

    messages.push(...collectOrderedHardUnresolvedGateMessages(params.snapshot.gates, submitGateIds));

    const icdErr = getIcd10CmValidationError(params.principalDxCodeForm);
    if (icdErr) messages.push(icdErr);

    return dedupePreserveOrder(messages);
}

/** Single-line summary for tooltips; full list use {@link getClaimSubmitValidationMessages}. */
export function getClaimSubmitBlockedReason(params: {
    payload: DischargeReadinessPayload;
    snapshot: ReadinessSnapshot | undefined;
    principalDxCodeForm: string;
    canEdit: boolean;
    claimPrepStatus: ClaimPrepStatus;
}): string | undefined {
    const msgs = getClaimSubmitValidationMessages(params);
    return msgs.length > 0 ? msgs.join(' · ') : undefined;
}

/**
 * Finalize / command-strip: every unresolved readiness gate (summary, charges, insurance, billing),
 * in stable order. Same underlying list as {@link computeReadinessGates} (always computed from the encounter payload).
 */
export function getDischargeWorkspaceBlockingMessages(snapshot: ReadinessSnapshot): string[] {
    return collectOrderedUnresolvedGateMessages(snapshot.gates, DISCHARGE_WORKSPACE_GATE_DISPLAY_ORDER);
}

export function canSubmitInpatientClaim(params: {
    payload: DischargeReadinessPayload;
    snapshot: ReadinessSnapshot | undefined;
    principalDxCodeForm: string;
    canEdit: boolean;
    claimPrepStatus: ClaimPrepStatus;
}): boolean {
    return getClaimSubmitValidationMessages(params).length === 0;
}

/**
 * Server-style claim submit validation (no RBAC). Use before POST claim submit for mock and live API.
 * Returns all issues joined for API error text.
 */
export function validateInpatientClaimSubmission(p: DischargeReadinessPayload): string | undefined {
    const snapshot = computeReadinessSnapshot(p);
    const msgs = getClaimSubmitValidationMessages({
        payload: p,
        snapshot,
        principalDxCodeForm: p.claimPrep.principalDxCode?.trim() ?? '',
        canEdit: true,
        claimPrepStatus: p.claimPrep.status,
    });
    return msgs.length > 0 ? msgs.join(' · ') : undefined;
}

/** Visual form order for scrolling to the first invalid summary field. */
export const DISCHARGE_SUMMARY_ERROR_SCROLL_ORDER: DischargeSummaryRequiredKey[] = [
    'admissionDiagnosis',
    'hospitalCourse',
    'finalDiagnoses',
    'dischargeMedications',
    'followUpInstructions',
];

export function scrollToFirstDischargeSummaryError(errors: DischargeSummaryRequiredErrors): void {
    for (const key of DISCHARGE_SUMMARY_ERROR_SCROLL_ORDER) {
        if (errors[key]) {
            requestAnimationFrame(() => {
                document
                    .querySelector<HTMLElement>(`[data-discharge-field="${key}"]`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            return;
        }
    }
}

export function scrollToPrincipalIcdField(): void {
    requestAnimationFrame(() => {
        document
            .querySelector<HTMLElement>('[data-billing-field="principalDxCode"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

export function scrollToFirstReadinessIssue(snapshot: ReadinessSnapshot): void {
    const order = [
        'gate-summary-fields',
        'gate-nursing-checklist',
        'gate-charges-count',
        'gate-charges-positive-total',
        'gate-charges-pending',
        'gate-eligibility',
        'gate-encounter-claim-routing',
        'gate-claim-ub04-context',
        'gate-principal-dx',
        'gate-summary-signed',
    ];
    const unresolved = snapshot.gates.filter((g) => !g.resolved && g.severity === 'hard');
    for (const id of order) {
        if (unresolved.some((g) => g.id === id)) {
            requestAnimationFrame(() => {
                const sel: Record<string, string> = {
                    'gate-summary-fields': '[data-discharge-summary-tab]',
                    'gate-nursing-checklist': '[data-nursing-checklist-tab]',
                    'gate-charges-count': '[data-charges-tab]',
                    'gate-charges-positive-total': '[data-charges-tab]',
                    'gate-charges-pending': '[data-charges-tab]',
                    'gate-eligibility': '[data-insurance-tab]',
                    'gate-encounter-claim-routing': '[data-encounter-claim-context]',
                    'gate-claim-ub04-context': '[data-claim-ub04-context]',
                    'gate-principal-dx': '[data-billing-field="principalDxCode"]',
                    'gate-summary-signed': '[data-discharge-summary-tab]',
                };
                document.querySelector<HTMLElement>(sel[id])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
        }
    }
}
