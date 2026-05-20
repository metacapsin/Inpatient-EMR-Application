import type { CarePlanDiagnosis } from '../types/carePlan.types';

export function todayYmd(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

export function isPastTargetDate(ymd: string): boolean {
    if (!ymd.trim()) return false;
    const t = new Date(`${ymd}T12:00:00`).getTime();
    const today = new Date(`${todayYmd()}T12:00:00`).getTime();
    return !Number.isNaN(t) && t < today;
}

export function validateDiagnosesForSave(diagnoses: CarePlanDiagnosis[]): string | null {
    if (!diagnoses.length) return 'Add at least one NANDA diagnosis before saving.';
    for (const d of diagnoses) {
        if (!d.nandaCode.trim() || !d.nandaLabel.trim()) {
            return 'Each diagnosis requires a NANDA diagnosis and code.';
        }
        for (const g of d.goals) {
            if (g.targetDate && isPastTargetDate(g.targetDate)) {
                return 'Goal target date cannot be in the past.';
            }
        }
    }
    return null;
}
