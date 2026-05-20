import { cn } from '../../../lib/utils';

export function OrderStatusBadge({ status }: { status: string }) {
    const s = status?.trim().replace(/_/g, ' ') || '—';
    const lower = s.toLowerCase();

    const tone =
        lower === 'completed'
            ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800/40'
            : lower === 'cancelled'
              ? 'bg-rose-100 text-rose-900 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/40'
              : lower === 'in progress' || lower === 'in_progress'
                ? 'bg-sky-100 text-sky-900 ring-sky-200/70 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-800/40'
                : lower === 'accepted'
                  ? 'bg-violet-100 text-violet-900 ring-violet-200/70 dark:bg-violet-900/40 dark:text-violet-100 dark:ring-violet-800/40'
                  : lower === 'pending'
                    ? 'bg-amber-100 text-amber-900 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/40'
                    : 'bg-gray-100 text-gray-600 ring-gray-200/70 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600/50';

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize leading-tight ring-1 ring-inset',
                tone
            )}
        >
            <span className="truncate">{s}</span>
        </span>
    );
}
