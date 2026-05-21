import type { HAIEventType } from '../../types/haiEvent';
import { cn } from '../../lib/utils';

const EVENT_STYLES: Record<HAIEventType, string> = {
    infection_detected:
        'bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900/40',
    isolation_started:
        'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/40',
    severity_updated:
        'bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900/40',
    status_changed:
        'bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/40',
    infection_resolved:
        'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40',
};

const EVENT_LABELS: Record<HAIEventType, string> = {
    infection_detected: 'Detected',
    isolation_started: 'Isolation',
    severity_updated: 'Severity',
    status_changed: 'Status',
    infection_resolved: 'Resolved',
};

type Props = {
    eventType: HAIEventType;
    className?: string;
};

export function HAIEventBadge({ eventType, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                EVENT_STYLES[eventType],
                className
            )}
        >
            {EVENT_LABELS[eventType]}
        </span>
    );
}
