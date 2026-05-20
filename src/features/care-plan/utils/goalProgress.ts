import type { CarePlanDiagnosis, CarePlanGoalStatus } from '../types/carePlan.types';

export function goalCompletionPercent(diagnosis: CarePlanDiagnosis): number {
    const goals = diagnosis.goals.filter((g) => g.statement.trim());
    if (goals.length === 0) return 0;
    const met = goals.filter((g) => g.status === 'Met').length;
    const partial = goals.filter((g) => g.status === 'Partially Met').length;
    return Math.round(((met + partial * 0.5) / goals.length) * 100);
}

export function overallGoalCompletionPercent(diagnoses: CarePlanDiagnosis[]): number {
    const active = diagnoses.filter((d) => d.status === 'Active');
    if (active.length === 0) return 100;
    const sum = active.reduce((s, d) => s + goalCompletionPercent(d), 0);
    return Math.round(sum / active.length);
}

export function carePlanReviewStatus(diagnoses: CarePlanDiagnosis[]): 'Complete' | 'In Progress' | 'Not Started' {
    if (diagnoses.length === 0) return 'Not Started';
    const pct = overallGoalCompletionPercent(diagnoses);
    if (pct >= 100) return 'Complete';
    return 'In Progress';
}

export function statusWeight(s: CarePlanGoalStatus): number {
    if (s === 'Met') return 2;
    if (s === 'Partially Met') return 1;
    return 0;
}
