import { cn } from '@/lib/utils';
import { qmKpiCardClass } from '../../styles/qualityDashboardClasses';

export function KpiCardSkeleton() {
    return (
        <div className={qmKpiCardClass} aria-hidden>
            <div className="mb-1 h-2 w-14 animate-pulse rounded bg-emr-hover dark:bg-white/10" />
            <div className="flex items-end justify-between gap-1">
                <div className="h-5 w-10 animate-pulse rounded bg-emr-hover dark:bg-white/10" />
                <div className="h-4 w-12 animate-pulse rounded bg-emr-border/60 dark:bg-white/5" />
            </div>
        </div>
    );
}

export function TableRowSkeleton({ compact }: { compact?: boolean }) {
    const cellPad = compact ? 'px-2 py-1' : 'px-3 py-2';
    return (
        <tr className="border-b border-emr-border/50 dark:border-white/5" aria-hidden>
            <td className={cellPad}>
                <div className="h-3 w-28 animate-pulse rounded bg-emr-hover dark:bg-white/10" />
            </td>
            <td className={cellPad}>
                <div className="mx-auto h-3 w-6 animate-pulse rounded bg-emr-hover dark:bg-white/10" />
            </td>
            {Array.from({ length: 7 }).map((_, i) => (
                <td key={i} className={cellPad}>
                    <div className="h-5 w-full animate-pulse rounded bg-emr-border/50 dark:bg-white/5" />
                </td>
            ))}
            <td className={cellPad}>
                <div className="ml-auto h-4 w-10 animate-pulse rounded-full bg-emr-hover dark:bg-white/10" />
            </td>
        </tr>
    );
}

export function PanelElementSkeleton() {
    return (
        <div className="space-y-2 rounded-lg border border-emr-border p-3 dark:border-white/10" aria-hidden>
            <div className="h-3 w-3/4 animate-pulse rounded bg-emr-hover dark:bg-white/10" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-emr-border/60 dark:bg-white/5" />
        </div>
    );
}
