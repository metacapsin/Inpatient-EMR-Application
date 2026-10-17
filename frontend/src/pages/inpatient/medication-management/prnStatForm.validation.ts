import * as yup from 'yup';
import type { FieldError, FieldErrors } from 'react-hook-form';
import type { PrnStatType } from '../../../types/medicationManagement';

/** Centralized copy + rule metadata for PRN/STAT administration form */
export const PRN_STAT_VALIDATION_CONFIG = {
    type: {
        label: 'Type',
        required: 'Type is required',
    },
    medicationName: {
        label: 'Medication name',
        required: 'Medication name is required',
    },
    indication: {
        label: 'Indication',
        required: 'Indication is required',
    },
    orderedTime: {
        label: 'Ordered time',
        required: 'Ordered time is required',
        invalidDatetime: 'Please enter a valid ordered time',
    },
    interval: {
        label: 'Interval',
        required: 'Interval is required',
        invalidPattern: 'Please enter a valid interval (e.g., q4h)',
    },
    maxDose: {
        label: 'Max dose',
        /** Used when a value is present but not a positive number */
        invalidNumber: 'Max dose must be a valid number',
    },
    givenBy: {
        label: 'Given by',
        required: 'Given by is required',
    },
} as const;

/** Interval format such as q4h, q6h (flexible whitespace, case-insensitive) */
export const PRN_STAT_INTERVAL_PATTERN = /^\s*q\s*\d+\s*h\s*$/i;

export type PrnStatFormValues = {
    type: PrnStatType;
    medicationName: string;
    indication: string;
    orderedTime: string;
    lastGivenTime: string;
    interval: string;
    maxDose: string;
    urgencyLevel: string;
    givenBy: string;
    doctorApproval: string;
    remarks: string;
};

export const PRN_STAT_FORM_DEFAULTS: PrnStatFormValues = {
    type: 'PRN',
    medicationName: '',
    indication: '',
    orderedTime: '',
    lastGivenTime: '',
    interval: '',
    maxDose: '',
    urgencyLevel: '',
    givenBy: '',
    doctorApproval: '',
    remarks: '',
};

/** Field order for focusing / scrolling to the first invalid control */
export const PRN_STAT_FIELD_ORDER: (keyof PrnStatFormValues)[] = [
    'type',
    'medicationName',
    'indication',
    'orderedTime',
    'lastGivenTime',
    'interval',
    'maxDose',
    'urgencyLevel',
    'doctorApproval',
    'givenBy',
    'remarks',
];

export const prnStatFormSchema = yup.object({
    type: yup
        .mixed<PrnStatType>()
        .oneOf(['PRN', 'STAT'], PRN_STAT_VALIDATION_CONFIG.type.required)
        .required(PRN_STAT_VALIDATION_CONFIG.type.required),
    medicationName: yup
        .string()
        .trim()
        .required(PRN_STAT_VALIDATION_CONFIG.medicationName.required),
    indication: yup.string().trim().required(PRN_STAT_VALIDATION_CONFIG.indication.required),
    orderedTime: yup
        .string()
        .required(PRN_STAT_VALIDATION_CONFIG.orderedTime.required)
        .test('ordered-datetime', PRN_STAT_VALIDATION_CONFIG.orderedTime.invalidDatetime, (value) => {
            if (!value || !String(value).trim()) return false;
            const parsed = new Date(value);
            return !Number.isNaN(parsed.getTime());
        }),
    lastGivenTime: yup.string().optional().default(''),
    interval: yup.string().when('type', {
        is: 'PRN',
        then: (schema) =>
            schema
                .required(PRN_STAT_VALIDATION_CONFIG.interval.required)
                .test('interval-format', PRN_STAT_VALIDATION_CONFIG.interval.invalidPattern, (value) =>
                    Boolean(value && PRN_STAT_INTERVAL_PATTERN.test(String(value)))
                ),
        otherwise: (schema) => schema.optional().default(''),
    }),
    maxDose: yup
        .string()
        .optional()
        .test('max-dose', PRN_STAT_VALIDATION_CONFIG.maxDose.invalidNumber, (value) => {
            if (value == null || !String(value).trim()) return true;
            const n = Number(String(value).trim());
            return !Number.isNaN(n) && n > 0;
        }),
    urgencyLevel: yup.string().optional().default(''),
    givenBy: yup.string().trim().required(PRN_STAT_VALIDATION_CONFIG.givenBy.required),
    doctorApproval: yup.string().optional().default(''),
    remarks: yup.string().optional().default(''),
}) as yup.ObjectSchema<PrnStatFormValues>;

/**
 * Returns the inline validation message for a control, if any.
 * Mirrors Angular-style `getError(controlName)` used with reactive forms.
 */
export function getError(
    errors: FieldErrors<PrnStatFormValues>,
    controlName: keyof PrnStatFormValues
): string | undefined {
    const err = errors[controlName] as FieldError | undefined;
    return typeof err?.message === 'string' ? err.message : undefined;
}

export function isPrnStatFormValuesValid(values: PrnStatFormValues): boolean {
    try {
        prnStatFormSchema.validateSync(values, { abortEarly: false });
        return true;
    } catch {
        return false;
    }
}

export function defaultOrderedTimeLocal(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
