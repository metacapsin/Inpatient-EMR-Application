import { cn } from '../../../lib/utils';

export function OrderPriorityPill({ priority }: { priority: string }) {
    const p = priority?.trim() || '—';
    const lower = p.toLowerCase();
    const isStat = lower === 'stat';

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight ring-1 ring-inset',
                isStat
                    ? 'bg-red-100 text-red-900 ring-red-300/60 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-500/40'
                    : lower === 'urgent'
                      ? 'bg-orange-100 text-orange-900 ring-orange-200/70 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-700/40'
                      : 'bg-gray-100 text-gray-700 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600/50'
            )}
        >
            <span className="truncate capitalize">{p}</span>
        </span>
    );
}
