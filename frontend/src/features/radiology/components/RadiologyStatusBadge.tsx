import { cn } from '../../../lib/utils';

export function RadiologyStatusBadge({ status }: { status: string }) {
    const s = status?.trim() || '—';
    const lower = s.toLowerCase();

    const tone =
        lower === 'final' || lower === 'amended'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            : lower === 'preliminary' || lower === 'in progress'
              ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200'
              : lower === 'scheduled' || lower === 'patient arrived'
                ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200'
                : lower === 'ordered'
                  ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

    return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', tone)}>{s}</span>;
}
