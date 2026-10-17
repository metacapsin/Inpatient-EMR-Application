/** Structured Care Plan — strict contract (matches api/models/CarePlan.js). */

export type CarePlanPriority = 'High' | 'Medium' | 'Low';

export type CarePlanDiagnosisStatus = 'Active' | 'Resolved' | 'Discontinued';

export type CarePlanGoalStatus = 'Not Met' | 'Partially Met' | 'Met';

export type CarePlanInterventionFrequency =
    | 'Each Shift'
    | 'Daily'
    | 'BID'
    | 'TID'
    | 'QID'
    | 'PRN'
    | 'Continuous'
    | 'Weekly';

export type CarePlanResponsibleDiscipline =
    | 'RN'
    | 'LVN'
    | 'CNA'
    | 'PT'
    | 'OT'
    | 'RT'
    | 'MD'
    | 'Social Work';

export type CarePlanInterventionStatus = 'Active' | 'Discontinued';

export interface CarePlanGoal {
    id: string;
    statement: string;
    targetDate: string;
    status: CarePlanGoalStatus;
    evaluationNote: string;
}

export interface CarePlanIntervention {
    id: string;
    text: string;
    frequency: CarePlanInterventionFrequency;
    responsibleDiscipline: CarePlanResponsibleDiscipline;
    status: CarePlanInterventionStatus;
}

export interface CarePlanDiagnosis {
    id: string;
    nandaCode: string;
    nandaLabel: string;
    relatedTo: string;
    evidencedBy: string;
    priority: CarePlanPriority;
    goals: CarePlanGoal[];
    interventions: CarePlanIntervention[];
    addedAt: string;
    addedBy: string;
    status: CarePlanDiagnosisStatus;
}

export interface CarePlanDocument {
    id: string;
    patientId: string;
    encounterId: string;
    tenantId: string;
    diagnoses: CarePlanDiagnosis[];
    interdisciplinaryNotes: string;
    lastReviewedBy: string;
    lastReviewedByName: string;
    lastReviewedAt: string | null;
    version: number;
}

export interface NandaSearchResult {
    code: string;
    label: string;
    definition?: string;
}

export interface CarePlanCreatePayload {
    patientId: string;
    encounterId: string;
    tenantId: string;
    diagnoses: CarePlanDiagnosis[];
    interdisciplinaryNotes?: string;
    lastReviewedBy?: string;
    lastReviewedByName?: string;
}

export interface CarePlanUpdatePayload {
    tenantId: string;
    encounterId: string;
    diagnoses: CarePlanDiagnosis[];
    interdisciplinaryNotes: string;
    lastReviewedBy?: string;
    lastReviewedByName?: string;
}

export interface CarePlanGoalStatusPayload {
    diagnosisId: string;
    goalId: string;
    status: CarePlanGoalStatus;
    evaluationNote?: string;
}

export type CarePlanDataSource = 'api' | 'mock';

export interface FlowsheetCarePlanSuggestion {
    id: string;
    nandaCode: string;
    nandaLabel: string;
    reason: string;
}
