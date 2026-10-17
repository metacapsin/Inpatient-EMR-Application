import type { CarePlanDocument } from '../types/carePlan.types';
import { carePlanReviewStatus } from './goalProgress';

/** Discharge readiness warning when structured care plan is incomplete. */
export function carePlanDischargeWarnings(plan: CarePlanDocument | null | undefined): string[] {
    if (!plan) return ['Structured care plan has not been started for this encounter.'];
    if (plan.diagnoses.length === 0) {
        return ['Structured care plan has no NANDA diagnoses documented.'];
    }
    const review = carePlanReviewStatus(plan.diagnoses);
    if (review !== 'Complete') {
        return ['Structured care plan goals are not fully met — review nursing evaluations before discharge.'];
    }
    return [];
}
