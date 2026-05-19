import { cn } from '../../../lib/utils';

export function CodeEventStatusBadge({ status }: { status: 'active' | 'closed' | string }) {
    const active = status === 'active';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                active
                    ? 'bg-red-600 text-white dark:bg-red-700'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            )}
        >
            {active ? (
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
            ) : null}
            {active ? 'Active' : 'Closed'}
        </span>
    );
}
