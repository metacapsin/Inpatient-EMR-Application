import type {
    AdlStatusLevel,
    AlliedHealthDiscipline,
    AlliedHealthVisitType,
    AssistiveDevice,
    DomesticViolenceScreen,
    LivingSituation,
    MobilityAssistLevel,
    NutritionalScreeningScore,
    OralIntakePercent,
    PtAmbulationLevel,
    RtTreatment,
    SubstanceAbuseScreen,
    SupportSystem,
    VentilatorMode,
    WeaningStatus,
} from '../types/alliedHealthNote.types';

export const ALLIED_HEALTH_DISCIPLINES: AlliedHealthDiscipline[] = [
    'Physical Therapy',
    'Occupational Therapy',
    'Respiratory Therapy',
    'Speech Therapy',
    'Social Work',
    'Case Management',
    'Dietitian',
    'Chaplain',
];

export const ALLIED_HEALTH_VISIT_TYPES: AlliedHealthVisitType[] = [
    'Evaluation',
    'Treatment Session',
    'Progress Note',
    'Discharge Note',
    'Consultation Response',
];

export const MOBILITY_ASSIST_OPTIONS: MobilityAssistLevel[] = [
    'Independent',
    'Supervision',
    'Min Assist',
    'Mod Assist',
    'Max Assist',
    'Dependent',
];

export const PT_AMBULATION_OPTIONS: PtAmbulationLevel[] = [
    'Independent',
    'Supervision',
    'Min Assist',
    'Mod Assist',
    'Max Assist',
    'Non-ambulatory',
];

export const ASSISTIVE_DEVICE_OPTIONS: AssistiveDevice[] = [
    'None',
    'Straight Cane',
    'Quad Cane',
    'Walker',
    'Rollator',
    'Crutches',
    'Wheelchair',
];

export const ADL_STATUS_OPTIONS: AdlStatusLevel[] = [
    'Independent',
    'Setup Help',
    'Min Assist',
    'Mod Assist',
    'Max Assist',
    'Dependent',
];

export const VENTILATOR_MODE_OPTIONS: VentilatorMode[] = [
    'Spontaneous',
    'SIMV',
    'AC',
    'PC',
    'PS',
    'CPAP',
    'BiPAP',
];

export const RT_TREATMENT_OPTIONS: RtTreatment[] = [
    'Nebulizer',
    'MDI',
    'CPT',
    'Incentive Spirometry',
    'Suctioning',
    'Vent Weaning',
];

export const WEANING_STATUS_OPTIONS: WeaningStatus[] = [
    'On Vent',
    'Weaning Trial',
    'Extubation Candidate',
    'Extubated Today',
];

export const LIVING_SITUATION_OPTIONS: LivingSituation[] = [
    'Lives Alone',
    'With Family',
    'Assisted Living',
    'Nursing Home',
    'Homeless',
];

export const SUPPORT_SYSTEM_OPTIONS: SupportSystem[] = ['Adequate', 'Limited', 'None'];

export const DOMESTIC_VIOLENCE_OPTIONS: DomesticViolenceScreen[] = [
    'Negative',
    'Positive',
    'Declined',
    'Not Indicated',
];

export const SUBSTANCE_ABUSE_OPTIONS: SubstanceAbuseScreen[] = ['Negative', 'Positive', 'Referred'];

export const DISCHARGE_PLANNING_NEED_OPTIONS = [
    'Home Health',
    'SNF',
    'Hospice',
    'DME',
    'Community Resources',
    'Transportation',
] as const;

export const NUTRITIONAL_SCREENING_OPTIONS: NutritionalScreeningScore[] = ['MUST score', 'NRS-2002 score'];

export const ORAL_INTAKE_OPTIONS: OralIntakePercent[] = ['<25%', '25–50%', '50–75%', '>75%'];

/** Dummy BMI from latest height/weight (MODULE 10). */
export const DUMMY_BMI_FROM_VITALS = '24.8';

export function disciplineHasExtraFields(discipline: AlliedHealthDiscipline): boolean {
    return (
        discipline === 'Physical Therapy' ||
        discipline === 'Occupational Therapy' ||
        discipline === 'Respiratory Therapy' ||
        discipline === 'Social Work' ||
        discipline === 'Dietitian'
    );
}
