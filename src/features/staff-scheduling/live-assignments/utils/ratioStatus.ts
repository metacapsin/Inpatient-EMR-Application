import type { UnitCareModel, StaffingRatioStatus } from '../../../../types/staffing.types';

export interface RatioThresholds {
    safeMax: number;
    warningMax: number;
    criticalMax: number;
}

/** Patients per nurse — safe threshold is inclusive. */
const THRESHOLDS: Record<UnitCareModel, RatioThresholds> = {
    ICU: { safeMax: 2, warningMax: 3, criticalMax: Infinity },
    'Step-Down': { safeMax: 3, warningMax: 4, criticalMax: Infinity },
    'Med-Surg': { safeMax: 5, warningMax: 6, criticalMax: Infinity },
    'L&D': { safeMax: 2, warningMax: 3, criticalMax: Infinity },
};

export function resolveUnitCareModel(input: {
    code?: string;
    name?: string;
    roomType?: string;
}): UnitCareModel {
    const hay = `${input.code ?? ''} ${input.name ?? ''} ${input.roomType ?? ''}`.toLowerCase();
    if (hay.includes('icu') || hay.includes('critical')) return 'ICU';
    if (hay.includes('l&d') || hay.includes('labor') || hay.includes('delivery')) return 'L&D';
    if (hay.includes('step') || hay.includes('telemetry') || hay.includes('pcu')) return 'Step-Down';
    return 'Med-Surg';
}

export function ratioStatusForPatientCount(
    patientCount: number,
    careModel: UnitCareModel
): StaffingRatioStatus {
    if (patientCount <= 0) return 'safe';
    const t = THRESHOLDS[careModel];
    if (patientCount <= t.safeMax) return 'safe';
    if (patientCount <= t.warningMax) return 'warning';
    return 'critical';
}

export function formatRatioLabel(patientCount: number, nurseCount = 1): string {
    if (nurseCount <= 0) return '—';
    const perNurse = patientCount / nurseCount;
    return `1:${perNurse % 1 === 0 ? perNurse : perNurse.toFixed(1)}`;
}

export function averagePatientRatio(totalPatients: number, totalNurses: number): number {
    if (totalNurses <= 0) return totalPatients;
    return Math.round((totalPatients / totalNurses) * 10) / 10;
}

export const RATIO_STATUS_STYLES: Record<
    StaffingRatioStatus,
    { label: string; chip: string; dot: string }
> = {
    safe: {
        label: 'Safe',
        chip: 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
        dot: 'bg-emerald-500',
    },
    warning: {
        label: 'Warning',
        chip: 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
        dot: 'bg-amber-500',
    },
    critical: {
        label: 'Critical',
        chip: 'border-red-200/80 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100',
        dot: 'bg-red-500',
    },
};

export const OVERTIME_HOURS_THRESHOLD = 8;
