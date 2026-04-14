import * as yup from 'yup';
import type { FieldError, FieldErrors } from 'react-hook-form';
import type { DischargeMedLine } from '../../../types/medicationManagement';

/** Dose: number + unit (e.g. 10 mg, 2.5 ml, 500 mcg) */
export const DISCHARGE_DOSE_PATTERN = /^\d+(\.\d+)?\s+[a-zA-Zµμ%/·\-]+$/;

export const DISCHARGE_MED_VALIDATION_MESSAGES = {
    nameRequired: 'Medication name is required',
    doseRequired: 'Dose is required',
    doseFormat: 'Enter a valid dose (e.g. 10 mg)',
    frequencyRequired: 'Please select frequency',
    durationRequired: 'Duration is required',
    durationFormat: 'Enter a valid duration (e.g. 5 or 5 days)',
    instructionsRequired: 'Instructions are required',
    preparedByRequired: 'Prepared by is required',
    reviewedByRequired: 'Reviewed by is required',
} as const;

export const DISCHARGE_FREQUENCY_OPTIONS = [
    'Daily',
    'OD',
    'BD',
    'TDS',
    'QID',
    'Weekly',
    'SOS',
    'PRN',
    'STAT',
    'Hourly',
    'As directed',
] as const;

export type DischargeFrequencyOption = (typeof DISCHARGE_FREQUENCY_OPTIONS)[number];

export function normalizeDischargeFrequency(raw: string): DischargeFrequencyOption | '' {
    const t = raw.trim();
    if (!t) return '';
    if ((DISCHARGE_FREQUENCY_OPTIONS as readonly string[]).includes(t)) {
        return t as DischargeFrequencyOption;
    }
    const k = t.toLowerCase();
    const synonyms: Record<string, DischargeFrequencyOption> = {
        'once daily': 'Daily',
        daily: 'Daily',
        od: 'OD',
        bd: 'BD',
        bid: 'BD',
        'twice daily': 'BD',
        tds: 'TDS',
        tid: 'TDS',
        'three times daily': 'TDS',
        qid: 'QID',
        weekly: 'Weekly',
        sos: 'SOS',
        prn: 'PRN',
        stat: 'STAT',
        hourly: 'Hourly',
        'as directed': 'As directed',
    };
    return synonyms[k] ?? '';
}

export function emptyMedicationLine(): DischargeMedLine {
    return {
        name: '',
        dose: '',
        frequency: '',
        duration: '',
        instructions: '',
    };
}

export type DischargeMedsFormValues = {
    medications: DischargeMedLine[];
    preparedBy: string;
    reviewedBy: string;
    counsellingDone: boolean;
};

export const DISCHARGE_MED_FORM_DEFAULTS: DischargeMedsFormValues = {
    medications: [emptyMedicationLine()],
    preparedBy: '',
    reviewedBy: '',
    counsellingDone: false,
};

const medicationLineSchema = yup.object({
    name: yup.string().trim().required(DISCHARGE_MED_VALIDATION_MESSAGES.nameRequired),
    dose: yup
        .string()
        .trim()
        .required(DISCHARGE_MED_VALIDATION_MESSAGES.doseRequired)
        .matches(DISCHARGE_DOSE_PATTERN, DISCHARGE_MED_VALIDATION_MESSAGES.doseFormat),
    frequency: yup
        .string()
        .trim()
        .required(DISCHARGE_MED_VALIDATION_MESSAGES.frequencyRequired)
        .oneOf([...DISCHARGE_FREQUENCY_OPTIONS], DISCHARGE_MED_VALIDATION_MESSAGES.frequencyRequired),
    duration: yup
        .string()
        .trim()
        .required(DISCHARGE_MED_VALIDATION_MESSAGES.durationRequired)
        .test(
            'duration-format',
            DISCHARGE_MED_VALIDATION_MESSAGES.durationFormat,
            (value) => {
                if (!value) return false;
                if (/^\d+(\.\d+)?$/.test(value)) return true;
                return /^\d+(\.\d+)?\s*(days?|weeks?|months?|d|w|m)\b/i.test(value);
            }
        ),
    instructions: yup.string().trim().required(DISCHARGE_MED_VALIDATION_MESSAGES.instructionsRequired),
}) as yup.ObjectSchema<DischargeMedLine>;

export const dischargeMedsFormSchema = yup.object({
    medications: yup.array().of(medicationLineSchema).min(1).required(),
    preparedBy: yup.string().trim().required(DISCHARGE_MED_VALIDATION_MESSAGES.preparedByRequired),
    reviewedBy: yup.string().trim().required(DISCHARGE_MED_VALIDATION_MESSAGES.reviewedByRequired),
    counsellingDone: yup.boolean().default(false),
}) as yup.ObjectSchema<DischargeMedsFormValues>;

/**
 * Inline message for a control (supports nested paths such as `medications.0.name`).
 * Mirrors Angular-style `getError(controlName)` used with reactive forms.
 */
export function getError(errors: FieldErrors<DischargeMedsFormValues>, controlName: string): string | undefined {
    const segments = controlName.split('.');
    let current: unknown = errors;
    for (const seg of segments) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[seg];
    }
    const err = current as FieldError | undefined;
    return typeof err?.message === 'string' ? err.message : undefined;
}

export function isDischargeMedsFormValuesValid(values: DischargeMedsFormValues): boolean {
    try {
        dischargeMedsFormSchema.validateSync(values, { abortEarly: false });
        return true;
    } catch {
        return false;
    }
}

export function buildDischargeMedFieldPaths(medicationCount: number): string[] {
    const lineKeys: (keyof DischargeMedLine)[] = ['name', 'dose', 'frequency', 'duration', 'instructions'];
    const paths: string[] = [];
    for (let i = 0; i < medicationCount; i++) {
        for (const k of lineKeys) {
            paths.push(`medications.${i}.${k}`);
        }
    }
    paths.push('preparedBy', 'reviewedBy');
    return paths;
}

export function dischargeMedFieldDomId(path: string): string {
    return `discharge-med-field-${path.replace(/\./g, '-')}`;
}

export function firstInvalidDischargeMedPath(
    errors: FieldErrors<DischargeMedsFormValues>,
    medicationCount: number
): string | undefined {
    for (const p of buildDischargeMedFieldPaths(medicationCount)) {
        if (getError(errors, p)) return p;
    }
    return undefined;
}
