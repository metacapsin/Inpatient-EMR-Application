import type {
    ClaimPrepStatus,
    DischargeReadinessPayload,
    DischargeSummaryState,
    EligibilityRecord,
    ReadinessGate,
} from '../types/dischargeReadiness';

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

export type ReadinessSnapshot = {
    gates: ReadinessGate[];
    /** Signed summary + nursing checklist clear (ADT-style clinical discharge track). */
    isClinicalReady: boolean;
    /** Financial prerequisites for claim / billing path. */
    isBillingReady: boolean;
    /** Provider may execute sign when true (draft summary, all preconditions except signature). */
    canSignDischargeSummary: boolean;
    hardBlockers: ReadinessGate[];
    softBlockers: ReadinessGate[];
};

const SIGN_RELEVANT_GATE_IDS = new Set([
    'gate-summary-fields',
    'gate-nursing-checklist',
    'gate-charges-count',
    'gate-charges-pending',
    'gate-eligibility',
    'gate-principal-dx',
]);

export function computeReadinessSnapshot(p: DischargeReadinessPayload, nowMs: number = Date.now()): ReadinessSnapshot {
    const gates = computeReadinessGates(p, nowMs);
    const hardUnresolved = gates.filter((g) => g.severity === 'hard' && !g.resolved);
    const softUnresolved = gates.filter((g) => g.severity === 'soft' && !g.resolved);

    const clinicalHardIds = new Set(['gate-summary-signed', 'gate-nursing-checklist']);
    const financialHardIds = new Set([
        'gate-charges-count',
        'gate-charges-pending',
        'gate-eligibility',
        'gate-principal-dx',
    ]);

    const clinicalHard = hardUnresolved.filter((g) => clinicalHardIds.has(g.id));
    const billingHard = hardUnresolved.filter((g) => financialHardIds.has(g.id));

    const summaryFieldsOk = gates.find((g) => g.id === 'gate-summary-fields')?.resolved ?? false;
    const signPrecheckHard = hardUnresolved.filter((g) => SIGN_RELEVANT_GATE_IDS.has(g.id));
    const canSignDischargeSummary =
        p.summary.status === 'draft' && summaryFieldsOk && signPrecheckHard.length === 0;

    return {
        gates,
        isClinicalReady: clinicalHard.length === 0,
        isBillingReady: billingHard.length === 0,
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

export function getClaimSubmitBlockedReason(params: {
    payload: DischargeReadinessPayload;
    snapshot: ReadinessSnapshot | undefined;
    principalDxCodeForm: string;
    canEdit: boolean;
    claimPrepStatus: ClaimPrepStatus;
}): string | undefined {
    if (!params.canEdit) return 'Your role cannot submit claims.';
    if (params.claimPrepStatus === 'submitted') return 'Claim already submitted.';
    if (!isDischargeSignedForClaim(params.payload)) return CLAIM_SUBMIT_REQUIRES_SIGNED_DISCHARGE_MSG;
    if (!params.snapshot) return 'Unable to evaluate readiness.';
    if (!params.snapshot.isClinicalReady) {
        return CLAIM_SUBMIT_CLINICAL_NOT_READY_MSG;
    }
    if (params.snapshot.hardBlockers.length > 0) {
        return params.snapshot.hardBlockers.map((g) => g.message).join(' · ') || 'Resolve all hard blockers before submitting.';
    }
    return getIcd10CmValidationError(params.principalDxCodeForm);
}

export function canSubmitInpatientClaim(params: {
    payload: DischargeReadinessPayload;
    snapshot: ReadinessSnapshot | undefined;
    principalDxCodeForm: string;
    canEdit: boolean;
    claimPrepStatus: ClaimPrepStatus;
}): boolean {
    return getClaimSubmitBlockedReason(params) === undefined;
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
        'gate-charges-pending',
        'gate-eligibility',
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
                    'gate-charges-pending': '[data-charges-tab]',
                    'gate-eligibility': '[data-insurance-tab]',
                    'gate-principal-dx': '[data-billing-field="principalDxCode"]',
                    'gate-summary-signed': '[data-discharge-summary-tab]',
                };
                document.querySelector<HTMLElement>(sel[id])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
        }
    }
}
