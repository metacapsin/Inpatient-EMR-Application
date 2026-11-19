import type {
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

    return gates;
}

export type ReadinessSnapshot = {
    gates: ReadinessGate[];
    /** Signed summary + nursing checklist clear (ADT-style clinical discharge track). */
    isClinicalReady: boolean;
    /** Always false until charge capture / claims exist on the server. */
    isBillingReady: boolean;
    /** Provider may execute sign when true (draft summary, all preconditions except signature). */
    canSignDischargeSummary: boolean;
    hardBlockers: ReadinessGate[];
    softBlockers: ReadinessGate[];
};

/** Preconditions for signing the discharge summary (clinical + charge presence; not full claim billing). */
const SIGN_RELEVANT_GATE_IDS = new Set(['gate-summary-fields', 'gate-nursing-checklist']);

export function computeReadinessSnapshot(p: DischargeReadinessPayload, nowMs: number = Date.now()): ReadinessSnapshot {
    const gates = computeReadinessGates(p, nowMs);
    const hardUnresolved = gates.filter((g) => g.severity === 'hard' && !g.resolved);
    const softUnresolved = gates.filter((g) => g.severity === 'soft' && !g.resolved);

    const clinicalHardIds = new Set(['gate-summary-signed', 'gate-nursing-checklist']);

    const clinicalHard = hardUnresolved.filter((g) => clinicalHardIds.has(g.id));

    const summaryFieldsOk = gates.find((g) => g.id === 'gate-summary-fields')?.resolved ?? false;
    const signPrecheckHard = hardUnresolved.filter((g) => SIGN_RELEVANT_GATE_IDS.has(g.id));
    const canSignDischargeSummary =
        p.summary.status === 'draft' && summaryFieldsOk && signPrecheckHard.length === 0;

    return {
        gates,
        isClinicalReady: clinicalHard.length === 0,
        isBillingReady: false,
        canSignDischargeSummary,
        hardBlockers: hardUnresolved,
        softBlockers: softUnresolved,
    };
}

/**
 * Unresolved server gates, hard first, as display strings. The server (`lib/dischargeGates.js`) is the
 * only authority on whether discharge can be finalized; this just formats what it returned.
 */
export function serverGateBlockingMessages(gates: ReadinessGate[]): string[] {
    const hard = gates.filter((g) => g.severity === 'hard' && !g.resolved).map((g) => g.message);
    const soft = gates.filter((g) => g.severity === 'soft' && !g.resolved).map((g) => g.message);
    return dedupePreserveOrder([...hard, ...soft]);
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

export function scrollToFirstReadinessIssue(snapshot: ReadinessSnapshot): void {
    const order = ['gate-summary-fields', 'gate-nursing-checklist', 'gate-summary-signed'];
    const sel: Record<string, string> = {
        'gate-summary-fields': '[data-discharge-summary-tab]',
        'gate-nursing-checklist': '[data-nursing-checklist-tab]',
        'gate-summary-signed': '[data-discharge-summary-tab]',
    };
    const unresolved = snapshot.gates.filter((g) => !g.resolved && g.severity === 'hard');
    for (const id of order) {
        if (unresolved.some((g) => g.id === id)) {
            requestAnimationFrame(() => {
                document.querySelector<HTMLElement>(sel[id])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
        }
    }
}
