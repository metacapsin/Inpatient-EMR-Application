import type {
    CarePlanDiagnosisStatus,
    CarePlanGoalStatus,
    CarePlanInterventionFrequency,
    CarePlanInterventionStatus,
    CarePlanPriority,
    CarePlanResponsibleDiscipline,
} from '../types/carePlan.types';

export const CARE_PLAN_PRIORITIES: CarePlanPriority[] = ['High', 'Medium', 'Low'];

export const CARE_PLAN_DIAGNOSIS_STATUSES: CarePlanDiagnosisStatus[] = ['Active', 'Resolved', 'Discontinued'];

export const CARE_PLAN_GOAL_STATUSES: CarePlanGoalStatus[] = ['Not Met', 'Partially Met', 'Met'];

export const CARE_PLAN_INTERVENTION_FREQUENCIES: CarePlanInterventionFrequency[] = [
    'Each Shift',
    'Daily',
    'BID',
    'TID',
    'QID',
    'PRN',
    'Continuous',
    'Weekly',
];

export const CARE_PLAN_DISCIPLINES: CarePlanResponsibleDiscipline[] = [
    'RN',
    'LVN',
    'CNA',
    'PT',
    'OT',
    'RT',
    'MD',
    'Social Work',
];

export const CARE_PLAN_INTERVENTION_STATUSES: CarePlanInterventionStatus[] = ['Active', 'Discontinued'];

export const PRIORITY_CHIP_CLASS: Record<CarePlanPriority, string> = {
    High: 'bg-rose-100 text-rose-900 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/50',
    Medium: 'bg-amber-100 text-amber-950 ring-amber-200/80 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-800/45',
    Low: 'bg-gray-100 text-gray-700 ring-gray-200/80 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10',
};
