import type { ComplianceStatus } from '../../types/quality';

/** Theme-token classes — use emr.* and semantic status tokens only */
export const QM_STATUS_STYLES: Record<
    ComplianceStatus,
    { badge: string; bar: string; dot: string; label: string }
> = {
    compliant: {
        badge: 'bg-emr-success/10 text-emr-success border-emr-success/25 dark:bg-emr-success/15 dark:text-emerald-400 dark:border-emerald-500/30',
        bar: 'bg-emr-success',
        dot: 'bg-emr-success',
        label: 'Compliant',
    },
    pending: {
        badge: 'bg-emr-warning/10 text-emr-warning border-emr-warning/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
        bar: 'bg-emr-warning',
        dot: 'bg-emr-warning',
        label: 'Pending',
    },
    deficient: {
        badge: 'bg-emr-danger/10 text-emr-danger border-emr-danger/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
        bar: 'bg-emr-danger',
        dot: 'bg-emr-danger',
        label: 'Deficient',
    },
    na: {
        badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/10 dark:text-gray-400 dark:border-white/10',
        bar: 'bg-gray-300 dark:bg-gray-600',
        dot: 'bg-gray-400 dark:bg-gray-500',
        label: 'N/A',
    },
};

export function overallScoreStatus(score: number): ComplianceStatus {
    if (score >= 85) return 'compliant';
    if (score >= 70) return 'pending';
    return 'deficient';
}

export const QM_PANEL = {
    backdrop: 'bg-black/40 backdrop-blur-sm',
    surface: 'bg-white/95 dark:bg-[#12100e]/95 backdrop-blur-xl border-emr-border dark:border-white/10',
    header: 'border-b border-emr-border/80 dark:border-white/10',
    stickyHeader: 'sticky top-0 z-10 bg-white/90 dark:bg-[#12100e]/90 backdrop-blur-md',
    card: 'rounded-xl border border-emr-border bg-white shadow-sm dark:border-white/10 dark:bg-[#1a1816]/80',
    glass: 'bg-white/80 dark:bg-[#1a1816]/70 backdrop-blur-md',
} as const;

export const QM_STATUS_ICON: Record<ComplianceStatus, string> = {
    compliant: '✅',
    deficient: '❌',
    pending: '⏳',
    na: 'N/A',
};
