import { cn } from '../../../lib/utils';

export function RadiologyPriorityBadge({ priority }: { priority: string }) {
    const p = priority?.trim() || '—';
    const lower = p.toLowerCase();
    const isStat = lower === 'stat';

    return (
        <span
            className={cn(
                'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                isStat
                    ? 'bg-red-100 text-red-800 ring-1 ring-red-300/60 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-500/40'
                    : lower === 'urgent'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            )}
        >
            {p}
        </span>
    );
}
