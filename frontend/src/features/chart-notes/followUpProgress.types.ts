/** Mirrors EMR-ng FollowUpProgressNote form shape (subset used for inpatient v1). */

export const FOLLOW_UP_NOTE_TYPE =
    'Follow-Up Progress Note (99212-99215/99308-99310/99347-99350)' as const;

export const VISIT_SETTING_OPTIONS = [
    { label: 'Office (POS 11)', value: 'office' },
    { label: 'SNF/Nursing Facility (POS 31)', value: 'snf' },
    { label: 'Home (POS 12)', value: 'home' },
    { label: 'Telehealth (POS 02)', value: 'telehealth' },
] as const;

export const MDM_LEVEL_OPTIONS = [
    { label: 'Straightforward', value: 'straightforward' },
    { label: 'Low', value: 'low' },
    { label: 'Moderate', value: 'moderate' },
    { label: 'High', value: 'high' },
] as const;

export const OFFICE_CPT_OPTIONS = [
    { label: '99212 — Straightforward (~10–19 min)', value: '99212' },
    { label: '99213 — Low (~20–29 min)', value: '99213' },
    { label: '99214 — Moderate (~30–39 min)', value: '99214' },
    { label: '99215 — High (~40–54 min)', value: '99215' },
] as const;

export const SNF_CPT_OPTIONS = [
    { label: '99307 — Straightforward', value: '99307' },
    { label: '99308 — Low', value: '99308' },
    { label: '99309 — Moderate', value: '99309' },
    { label: '99310 — High', value: '99310' },
] as const;

export const HOME_CPT_OPTIONS = [
    { label: '99347 — Straightforward', value: '99347' },
    { label: '99348 — Low', value: '99348' },
    { label: '99349 — Moderate', value: '99349' },
    { label: '99350 — High', value: '99350' },
] as const;

export const ROS_SYSTEMS = [
    { key: 'constitutional', label: 'Constitutional' },
    { key: 'heent', label: 'HEENT' },
    { key: 'cardiovascular', label: 'Cardiovascular' },
    { key: 'respiratory', label: 'Respiratory' },
    { key: 'gastrointestinal', label: 'Gastrointestinal' },
    { key: 'genitourinary', label: 'Genitourinary' },
    { key: 'musculoskeletal', label: 'Musculoskeletal' },
    { key: 'neurological', label: 'Neurological' },
    { key: 'psychiatric', label: 'Psychiatric' },
    { key: 'endocrine', label: 'Endocrine' },
    { key: 'dermatologic', label: 'Dermatologic' },
] as const;

export const EXAM_SYSTEMS = [
    { key: 'generalAppearance', label: 'General Appearance' },
    { key: 'heent', label: 'HEENT' },
    { key: 'neck', label: 'Neck' },
    { key: 'cardiovascular', label: 'Cardiovascular' },
    { key: 'respiratory', label: 'Respiratory' },
    { key: 'abdomen', label: 'Abdomen' },
    { key: 'musculoskeletal', label: 'Musculoskeletal' },
    { key: 'neurological', label: 'Neurological' },
    { key: 'psychiatric', label: 'Psychiatric' },
    { key: 'skin', label: 'Skin / Integumentary' },
    { key: 'extremities', label: 'Extremities' },
] as const;

export type AssessmentPlanRow = { dx: string; icd10: string; plan: string };

export type FollowUpProgressData = {
    encounter: {
        visitSetting: string;
        cptCode: string;
        billingPath: string;
        mdmLevel: string;
        modifier: string;
        totalTime: string;
    };
    chiefComplaint: { patientWords: string };
    intervalHistory: string;
    allergiesText: string;
    medicationsText: string;
    vitals: {
        bp: string;
        hr: string;
        rr: string;
        temp: string;
        tempRoute: string;
        spo2: string;
        weight: string;
        height: string;
        bmi: string;
    };
    ros: Record<string, string>;
    physExam: Record<string, string> & { additionalNarrative?: string };
    assessmentPlan: AssessmentPlanRow[];
    followUpPlan: string;
};

export function emptyFollowUpProgressData(): FollowUpProgressData {
    const ros: Record<string, string> = {};
    for (const s of ROS_SYSTEMS) ros[`${s.key}Notes`] = '';
    const physExam: Record<string, string> = { additionalNarrative: '' };
    for (const s of EXAM_SYSTEMS) physExam[`${s.key}Findings`] = '';
    return {
        encounter: {
            visitSetting: 'office',
            cptCode: '',
            billingPath: 'MDM',
            mdmLevel: '',
            modifier: 'None',
            totalTime: '',
        },
        chiefComplaint: { patientWords: '' },
        intervalHistory: '',
        allergiesText: '',
        medicationsText: '',
        vitals: {
            bp: '',
            hr: '',
            rr: '',
            temp: '',
            tempRoute: '',
            spo2: '',
            weight: '',
            height: '',
            bmi: '',
        },
        ros,
        physExam,
        assessmentPlan: [
            { dx: '', icd10: '', plan: '' },
            { dx: '', icd10: '', plan: '' },
            { dx: '', icd10: '', plan: '' },
        ],
        followUpPlan: '',
    };
}

export function cptOptionsForSetting(visitSetting: string) {
    if (visitSetting === 'snf') return SNF_CPT_OPTIONS;
    if (visitSetting === 'home') return HOME_CPT_OPTIONS;
    return OFFICE_CPT_OPTIONS;
}

export function validateFollowUpProgress(data: FollowUpProgressData): Record<string, string> {
    const e: Record<string, string> = {};
    if (!data.encounter.visitSetting) e.visitSetting = 'Visit setting is required.';
    if (!data.encounter.cptCode) e.cptCode = 'CPT code is required.';
    if (!data.chiefComplaint.patientWords.trim()) e.chiefComplaint = 'Chief complaint is required.';
    if (!data.vitals.bp.trim()) e.bp = 'BP is required.';
    if (!data.vitals.hr.trim()) e.hr = 'HR is required.';
    const apOk = data.assessmentPlan.some((r) => r.dx.trim() || r.plan.trim());
    if (!apOk) e.assessmentPlan = 'Add at least one assessment / plan row.';
    const rosFilled = ROS_SYSTEMS.filter((s) => (data.ros[`${s.key}Notes`] || '').trim()).length;
    if (rosFilled < 4) e.ros = 'Document at least 4 ROS systems.';
    return e;
}
