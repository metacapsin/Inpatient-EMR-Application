import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

type InfectionBadgeProps = {
    label?: string;
    className?: string;
    size?: 'sm' | 'md';
};

/** Isolation precaution indicator for bed board and dashboards. */
export function InfectionIsolationBadge({ label = 'Isolation Required', className, size = 'sm' }: InfectionBadgeProps) {
    const sizeCls =
        size === 'md'
            ? 'px-2.5 py-1 text-xs gap-1.5'
            : 'px-2 py-0.5 text-[10px] gap-1';

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center rounded-full font-semibold ring-1 ring-inset',
                'bg-amber-100 text-amber-900 ring-amber-300/80 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-800/50',
                sizeCls,
                className
            )}
            title={label}
        >
            <AlertTriangle className={size === 'md' ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'} aria-hidden />
            <span className="truncate">{label}</span>
        </span>
    );
}

export function InfectionStatusBadge({ status }: { status: string }) {
    const cls =
        status === 'Active'
            ? 'bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200'
            : status === 'Monitoring'
              ? 'bg-orange-100 text-orange-800 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-200'
              : 'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200';

    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
            {status}
        </span>
    );
}
