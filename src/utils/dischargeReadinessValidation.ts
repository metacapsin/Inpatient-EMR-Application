/** ICD-10-CM principal diagnosis pattern (letter + 2 digits + optional .digits). */
export const PRINCIPAL_ICD10_CM_REGEX = /^[A-Z][0-9]{2}(\.[0-9]+)?$/;

export const REQUIRED_FIELD_MSG = 'This field is required';

export function normalizePrincipalIcdInput(raw: string): string {
    return raw.trim().toUpperCase();
}

export function isValidPrincipalIcd(raw: string): boolean {
    const n = normalizePrincipalIcdInput(raw);
    return n.length > 0 && PRINCIPAL_ICD10_CM_REGEX.test(n);
}

/** Error message for principal ICD, or `undefined` when valid. */
export function getPrincipalIcdValidationError(code: string): string | undefined {
    const n = normalizePrincipalIcdInput(code);
    if (!n) return REQUIRED_FIELD_MSG;
    if (!PRINCIPAL_ICD10_CM_REGEX.test(n)) return 'Invalid ICD-10 code';
    return undefined;
}

export type DischargeSummaryRequiredKey =
    | 'admissionDiagnosis'
    | 'hospitalCourse'
    | 'finalDiagnoses'
    | 'disposition'
    | 'conditionAtDischarge';

export type DischargeSummaryRequiredErrors = Partial<Record<DischargeSummaryRequiredKey, string>>;

export type DischargeSummaryValidatedFields = Record<DischargeSummaryRequiredKey, string>;

export function validateDischargeSummaryRequired(form: DischargeSummaryValidatedFields): {
    ok: boolean;
    errors: DischargeSummaryRequiredErrors;
} {
    const errors: DischargeSummaryRequiredErrors = {};
    if (!form.admissionDiagnosis.trim()) errors.admissionDiagnosis = REQUIRED_FIELD_MSG;
    if (!form.hospitalCourse.trim()) errors.hospitalCourse = REQUIRED_FIELD_MSG;
    if (!form.finalDiagnoses.trim()) errors.finalDiagnoses = REQUIRED_FIELD_MSG;
    if (!form.disposition.trim()) errors.disposition = 'Disposition must be selected';
    if (!form.conditionAtDischarge.trim()) errors.conditionAtDischarge = REQUIRED_FIELD_MSG;
    return { ok: Object.keys(errors).length === 0, errors };
}

/** Scroll order matches visual form flow (approximate tab reading order). */
export const DISCHARGE_SUMMARY_ERROR_SCROLL_ORDER: DischargeSummaryRequiredKey[] = [
    'admissionDiagnosis',
    'disposition',
    'conditionAtDischarge',
    'hospitalCourse',
    'finalDiagnoses',
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
