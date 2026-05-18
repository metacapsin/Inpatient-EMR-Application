import type { IoBalanceSummary } from '../types/ioRecord.types';

export type BalanceSeverity = 'balanced' | 'caution' | 'critical';

export function balanceSeverity(balanceMl: number): BalanceSeverity {
    const abs = Math.abs(balanceMl);
    if (abs >= 2000) return 'critical';
    if (abs >= 1000) return 'caution';
    return 'balanced';
}

export function balanceToneClass(severity: BalanceSeverity): string {
    switch (severity) {
        case 'critical':
            return 'text-red-700 dark:text-red-300';
        case 'caution':
            return 'text-amber-700 dark:text-amber-300';
        default:
            return 'text-emerald-700 dark:text-emerald-300';
    }
}

export function balancePanelClass(severity: BalanceSeverity): string {
    switch (severity) {
        case 'critical':
            return 'border-red-300/80 bg-red-50 ring-1 ring-red-200/60 dark:border-red-500/40 dark:bg-red-950 dark:ring-red-800/40';
        case 'caution':
            return 'border-amber-300/80 bg-amber-50 ring-1 ring-amber-200/60 dark:border-amber-500/40 dark:bg-amber-950 dark:ring-amber-700/35';
        default:
            return 'border-emerald-300/70 bg-emerald-50 ring-1 ring-emerald-200/50 dark:border-emerald-600/35 dark:bg-emerald-950 dark:ring-emerald-800/30';
    }
}

export function formatBalanceMl(ml: number): string {
    const sign = ml > 0 ? '+' : '';
    return `${sign}${ml.toLocaleString()} mL`;
}

export function urineOutputAlert(summary: IoBalanceSummary | null | undefined): boolean {
    if (!summary) return false;
    return summary.urineOutputLastHourMl < 30;
}

export function balance24hCritical(summary: IoBalanceSummary | null | undefined): boolean {
    if (!summary) return false;
    return Math.abs(summary.balance24hMl) >= 2000;
}
