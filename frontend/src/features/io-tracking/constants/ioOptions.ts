export const IO_INTAKE_CATEGORIES = [
    'IV Fluid',
    'PO (Oral)',
    'Tube Feeding',
    'Blood Product',
    'Irrigation',
    'Medication Flush',
    'Other',
] as const;

export const IO_FLUID_TYPES = [
    'NS',
    'LR',
    'D5W',
    'D5NS',
    'D5½NS',
    'Albumin 5%',
    'PRBC',
    'FFP',
    'Platelets',
    'Plasma',
] as const;

export const IO_FLUID_FREE_TEXT = 'Free text';

export const IO_OUTPUT_CATEGORIES = [
    'Urine',
    'Emesis',
    'NG/OG Drain',
    'JP Drain',
    'Hemovac',
    'Chest Tube',
    'Stool',
    'Wound Drain',
    'CSF',
    'Other',
] as const;

export const IO_COLOR_CONSISTENCY_OPTIONS = [
    'Clear',
    'Yellow',
    'Dark',
    'Bloody',
    'Green',
    'Brown',
    'Cloudy',
] as const;

export function toSelectOptions(values: readonly string[]) {
    return values.map((v) => ({ label: v, value: v }));
}
