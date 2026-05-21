import type { InfectionFormErrors, InfectionFormValues, InfectionRecord } from '../types/infectionControl';

export function validateInfectionForm(form: InfectionFormValues): InfectionFormErrors {
    const errors: InfectionFormErrors = {};
    if (!form.infectionType.trim()) errors.infectionType = 'Infection type is required';
    if (!form.severity) errors.severity = 'Severity is required';
    if (!form.status) errors.status = 'Status is required';
    return errors;
}

export function hasFormErrors(errors: InfectionFormErrors): boolean {
    return Object.keys(errors).length > 0;
}

/** True when all required fields (type, severity, status) are filled. */
export function isInfectionFormValid(form: InfectionFormValues): boolean {
    return !hasFormErrors(validateInfectionForm(form));
}

export function infectionToFormValues(record: InfectionRecord): InfectionFormValues {
    return {
        infectionType: record.infectionType,
        symptoms: record.symptoms,
        source: record.source,
        severity: record.severity,
        isolationRequired: record.isolationRequired,
        isolationType: record.isolationType,
        notes: record.notes,
        status: record.status,
        detectedDate: record.detectedDate,
    };
}

/** Active or monitoring infection with isolation flag. */
export function recordRequiresIsolation(record: InfectionRecord): boolean {
    return record.isolationRequired && record.status !== 'Resolved';
}

export function patientRequiresIsolation(records: InfectionRecord[], patientId: string): boolean {
    return records.some((r) => r.patientId === patientId && recordRequiresIsolation(r));
}

export function patientHasActiveInfectionMonitoring(records: InfectionRecord[], patientId: string): boolean {
    return records.some(
        (r) => r.patientId === patientId && (r.status === 'Active' || r.status === 'Monitoring')
    );
}

export function patientsNeedingDeepClean(records: InfectionRecord[]): string[] {
    const labels = new Set<string>();
    for (const r of records) {
        if (r.status === 'Active' && r.isolationRequired) {
            labels.add(`${r.infectionType} (${r.patientId})`);
        }
    }
    return [...labels];
}

export function ppeRequiredPatientLabels(
    records: InfectionRecord[],
    bedRows: { patientId: string | null; patientName: string | null }[]
): string[] {
    const out: string[] = [];
    for (const row of bedRows) {
        if (!row.patientId) continue;
        if (patientRequiresIsolation(records, row.patientId)) {
            out.push(row.patientName?.trim() || row.patientId);
        }
    }
    return out;
}

export function statusBadgeClass(status: InfectionRecord['status']): string {
    switch (status) {
        case 'Active':
            return 'bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900/40';
        case 'Monitoring':
            return 'bg-orange-100 text-orange-800 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900/40';
        case 'Resolved':
            return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40';
        default:
            return 'bg-gray-100 text-gray-700 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-300';
    }
}

export function severityBadgeClass(severity: InfectionRecord['severity']): string {
    switch (severity) {
        case 'Critical':
        case 'High':
            return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300';
        case 'Moderate':
            return 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200';
        default:
            return 'bg-gray-50 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300';
    }
}
