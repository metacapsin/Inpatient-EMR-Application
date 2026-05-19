import type { RadiologyOrderStatus, RadiologyPriority } from '../types/radiologyOrder.types';

export const RADIOLOGY_STATUSES: RadiologyOrderStatus[] = [
    'Ordered',
    'Scheduled',
    'Patient Arrived',
    'In Progress',
    'Preliminary',
    'Final',
    'Amended',
];

export const RADIOLOGY_PRIORITIES: RadiologyPriority[] = ['Routine', 'Urgent', 'STAT'];

export const MODALITY_OPTIONS = [
    { label: 'X-Ray', value: 'X-Ray' },
    { label: 'CT', value: 'CT' },
    { label: 'MRI', value: 'MRI' },
    { label: 'Ultrasound', value: 'Ultrasound' },
    { label: 'Nuclear Medicine', value: 'Nuclear Medicine' },
    { label: 'PET', value: 'PET' },
    { label: 'Fluoroscopy', value: 'Fluoroscopy' },
    { label: 'Mammography', value: 'Mammography' },
] as const;

export const BODY_REGION_BY_MODALITY: Record<string, string[]> = {
    'X-Ray': ['Chest', 'Abdomen', 'Pelvis', 'Spine', 'Extremity', 'Skull', 'Hand', 'Foot'],
    CT: ['Head', 'Chest', 'Abdomen', 'Pelvis', 'Spine', 'Extremity', 'Angiography'],
    MRI: ['Brain', 'Spine', 'Chest', 'Abdomen', 'Pelvis', 'Knee', 'Shoulder', 'Hip'],
    Ultrasound: ['Abdomen', 'Pelvis', 'Thyroid', 'Breast', 'Vascular', 'Obstetric'],
    'Nuclear Medicine': ['Bone', 'Thyroid', 'Cardiac', 'Renal', 'Lung'],
    PET: ['Whole Body', 'Brain', 'Cardiac'],
    Fluoroscopy: ['GI', 'GU', 'Spine', 'Joint'],
    Mammography: ['Bilateral', 'Left', 'Right', 'Diagnostic'],
};

export const LATERALITY_OPTIONS = [
    { label: 'Left', value: 'Left' },
    { label: 'Right', value: 'Right' },
    { label: 'Bilateral', value: 'Bilateral' },
    { label: 'N/A', value: 'N/A' },
];

export const CONTRAST_OPTIONS = [
    { label: 'Without contrast', value: 'Without contrast' },
    { label: 'With contrast', value: 'With contrast' },
    { label: 'With and without contrast', value: 'With and without contrast' },
];

export const PREGNANCY_STATUS_OPTIONS = [
    { label: 'Not applicable', value: 'Not applicable' },
    { label: 'Unknown', value: 'Unknown' },
    { label: 'No', value: 'No' },
    { label: 'Yes', value: 'Yes' },
];

export const TRANSPORT_OPTIONS = [
    { label: 'No', value: 'false' },
    { label: 'Yes', value: 'true' },
];

/** Common ICD-10-CM codes for imaging indications (type-ahead source). */
export const COMMON_ICD10_SUGGESTIONS: { code: string; label: string }[] = [
    { code: 'R07.9', label: 'Chest pain, unspecified' },
    { code: 'J18.9', label: 'Pneumonia, unspecified organism' },
    { code: 'S72.001A', label: 'Fracture of unspecified part of neck of right femur, initial' },
    { code: 'M54.5', label: 'Low back pain' },
    { code: 'R10.9', label: 'Unspecified abdominal pain' },
    { code: 'I63.9', label: 'Cerebral infarction, unspecified' },
    { code: 'C50.911', label: 'Malignant neoplasm of unspecified site of right female breast' },
    { code: 'K35.80', label: 'Unspecified acute appendicitis' },
    { code: 'N18.9', label: 'Chronic kidney disease, unspecified' },
    { code: 'Z87.891', label: 'Personal history of nicotine dependence' },
];

export function toSelectOptions(values: string[]): { label: string; value: string }[] {
    return values.map((v) => ({ label: v, value: v }));
}

export function bodyRegionsForModality(modality: string): { label: string; value: string }[] {
    const regions = BODY_REGION_BY_MODALITY[modality] ?? [];
    return toSelectOptions(regions);
}
