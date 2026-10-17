import { useMemo } from 'react';
import type { CodeEventTimelineEntry } from '../../../types/codeEvent';
import { formatCodeEventDateTime } from '../utils/codeEventFormatters';
import { cn } from '../../../lib/utils';
import { MEDICATION_TIMELINE_TYPES } from '../constants/codeEventOptions';

type Props = {
    entries: CodeEventTimelineEntry[];
};

export function CodeEventTimelineFeed({ entries }: Props) {
    const sorted = useMemo(
        () => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        [entries]
    );

    if (sorted.length === 0) {
        return <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">No timeline entries yet.</p>;
    }

    return (
        <ol className="relative space-y-0 border-l-2 border-gray-200 pl-4 dark:border-white/10" aria-label="Event timeline">
            {sorted.map((entry, idx) => {
                const isMed = MEDICATION_TIMELINE_TYPES.includes(entry.entryType);
                return (
                    <li key={entry.id} className={cn('relative pb-4', idx === 0 && 'pt-1')}>
                        <span
                            className={cn(
                                'absolute -left-[1.35rem] top-1 flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#141210]',
                                isMed ? 'bg-violet-600' : 'bg-primary'
                            )}
                            aria-hidden
                        />
                        <div
                            className={cn(
                                'rounded-lg border px-3 py-2',
                                isMed
                                    ? 'border-violet-200/80 bg-violet-50/80 dark:border-violet-900/40 dark:bg-violet-950/25'
                                    : 'border-gray-200/80 bg-gray-50/50 dark:border-white/10 dark:bg-white/[0.03]'
                            )}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-[10px] font-mono font-semibold text-gray-500 dark:text-gray-400">
                                    {formatCodeEventDateTime(entry.timestamp)}
                                </span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-800 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-white/10">
                                    {entry.entryType}
                                </span>
                            </div>
                            {isMed && entry.medication?.name ? (
                                <p className="mt-1 text-sm font-semibold text-violet-950 dark:text-violet-100">
                                    {entry.medication.name}
                                    {entry.medication.dose || entry.medication.route
                                        ? ` · ${[entry.medication.dose, entry.medication.route].filter(Boolean).join(' ')}`
                                        : ''}
                                </p>
                            ) : null}
                            {entry.joules != null && entry.joules > 0 ? (
                                <p className="mt-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">{entry.joules} J</p>
                            ) : null}
                            {entry.notes?.trim() ? (
                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{entry.notes}</p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">Entered by {entry.enteredBy}</p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
