/** MODULE 10 — Allied Health Notes (FULL-FLASH-PLAN spec). */

export type AlliedHealthNoteStatus = 'Draft' | 'Signed';

export type AlliedHealthDiscipline =
    | 'Physical Therapy'
    | 'Occupational Therapy'
    | 'Respiratory Therapy'
    | 'Speech Therapy'
    | 'Social Work'
    | 'Case Management'
    | 'Dietitian'
    | 'Chaplain';

export type AlliedHealthVisitType =
    | 'Evaluation'
    | 'Treatment Session'
    | 'Progress Note'
    | 'Discharge Note'
    | 'Consultation Response';

export type MobilityAssistLevel =
    | 'Independent'
    | 'Supervision'
    | 'Min Assist'
    | 'Mod Assist'
    | 'Max Assist'
    | 'Dependent';

export type PtAmbulationLevel =
    | 'Independent'
    | 'Supervision'
    | 'Min Assist'
    | 'Mod Assist'
    | 'Max Assist'
    | 'Non-ambulatory';

export type AssistiveDevice =
    | 'None'
    | 'Straight Cane'
    | 'Quad Cane'
    | 'Walker'
    | 'Rollator'
    | 'Crutches'
    | 'Wheelchair';

export type AdlStatusLevel =
    | 'Independent'
    | 'Setup Help'
    | 'Min Assist'
    | 'Mod Assist'
    | 'Max Assist'
    | 'Dependent';

export type VentilatorMode =
    | 'Spontaneous'
    | 'SIMV'
    | 'AC'
    | 'PC'
    | 'PS'
    | 'CPAP'
    | 'BiPAP';

export type RtTreatment =
    | 'Nebulizer'
    | 'MDI'
    | 'CPT'
    | 'Incentive Spirometry'
    | 'Suctioning'
    | 'Vent Weaning';

export type WeaningStatus =
    | 'On Vent'
    | 'Weaning Trial'
    | 'Extubation Candidate'
    | 'Extubated Today';

export type LivingSituation =
    | 'Lives Alone'
    | 'With Family'
    | 'Assisted Living'
    | 'Nursing Home'
    | 'Homeless';

export type SupportSystem = 'Adequate' | 'Limited' | 'None';

export type DomesticViolenceScreen = 'Negative' | 'Positive' | 'Declined' | 'Not Indicated';

export type SubstanceAbuseScreen = 'Negative' | 'Positive' | 'Referred';

export type DischargePlanningNeed =
    | 'Home Health'
    | 'SNF'
    | 'Hospice'
    | 'DME'
    | 'Community Resources'
    | 'Transportation';

export type NutritionalScreeningScore = 'MUST score' | 'NRS-2002 score';

export type OralIntakePercent = '<25%' | '25–50%' | '50–75%' | '>75%';

export interface PtDisciplineFields {
    bedMobility: MobilityAssistLevel | '';
    transfers: MobilityAssistLevel | '';
    ambulation: PtAmbulationLevel | '';
    ambulationDistance: string;
    assistiveDevice: AssistiveDevice | '';
    dischargeMobilityGoal: string;
}

export interface OtDisciplineFields {
    grooming: AdlStatusLevel | '';
    dressing: AdlStatusLevel | '';
    bathing: AdlStatusLevel | '';
    adaptiveEquipmentRecommended: string;
}

export interface RtDisciplineFields {
    ventilatorMode: VentilatorMode | '';
    fio2: string;
    peep: string;
    treatmentGiven: RtTreatment[];
    postTreatmentSpo2: string;
    weaningStatus: WeaningStatus | '';
}

export interface SocialWorkDisciplineFields {
    livingSituation: LivingSituation | '';
    supportSystem: SupportSystem | '';
    financialConcerns: boolean;
    financialConcernsText: string;
    domesticViolenceScreen: DomesticViolenceScreen | '';
    substanceAbuseScreen: SubstanceAbuseScreen | '';
    dischargePlanningNeeds: DischargePlanningNeed[];
}

export interface DietitianDisciplineFields {
    bmi: string;
    nutritionalScreeningScore: NutritionalScreeningScore | '';
    estimatedCaloricNeeds: string;
    recommendedDiet: string;
    oralIntakePercent: OralIntakePercent | '';
}

export interface AlliedHealthNote {
    id: string;
    patientId: string;
    encounterId: string;
    discipline: AlliedHealthDiscipline;
    visitType: AlliedHealthVisitType;
    visitDateTime: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    signedBy: string;
    credentials: string;
    signedAt: string | null;
    status: AlliedHealthNoteStatus;
    ptFields?: PtDisciplineFields;
    otFields?: OtDisciplineFields;
    rtFields?: RtDisciplineFields;
    socialWorkFields?: SocialWorkDisciplineFields;
    dietitianFields?: DietitianDisciplineFields;
}

export type AlliedHealthNoteDraft = Omit<AlliedHealthNote, 'id' | 'status' | 'signedAt'> & {
    id?: string;
    status?: AlliedHealthNoteStatus;
    signedAt?: string | null;
};
