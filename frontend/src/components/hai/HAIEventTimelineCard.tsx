import { format, isValid, parseISO } from 'date-fns';
import type { HAIEvent } from '../../types/haiEvent';
import { severityBadgeClass } from '../../lib/infectionControlUtils';
import { HAIEventBadge } from './HAIEventBadge';

function formatOccurredAt(iso: string): string {
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d, yyyy · h:mm a');
    } catch {
        return iso;
    }
}

type Props = {
    event: HAIEvent;
    isLast?: boolean;
};

export function HAIEventTimelineCard({ event, isLast }: Props) {
    return (
        <li className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
                <span
                    className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-white/10"
                    aria-hidden
                />
            ) : null}
            <span
                className="relative z-[1] mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary/15 ring-2 ring-primary/20 dark:border-[#1a1a1a] dark:bg-primary/20"
                aria-hidden
            >
                <span className="h-2 w-2 rounded-full bg-primary" />
            </span>
            <article className="min-w-0 flex-1 rounded-lg border border-gray-200/70 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-[#1a1a1a]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{event.title}</h4>
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {formatOccurredAt(event.occurredAt)}
                            {event.recordedBy ? ` · ${event.recordedBy}` : ''}
                        </p>
                    </div>
                    <HAIEventBadge eventType={event.eventType} />
                </div>

                {event.description ? (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
                ) : null}

                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {event.infectionType ? (
                        <div>
                            <dt className="inline font-semibold text-gray-500 dark:text-gray-500">Type: </dt>
                            <dd className="inline text-gray-800 dark:text-gray-200">{event.infectionType}</dd>
                        </div>
                    ) : null}
                    {event.severity ? (
                        <div className="flex items-center gap-1">
                            <dt className="font-semibold text-gray-500 dark:text-gray-500">Severity:</dt>
                            <dd>
                                <span
                                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${severityBadgeClass(event.severity)}`}
                                >
                                    {event.severity}
                                </span>
                            </dd>
                        </div>
                    ) : null}
                    {event.status ? (
                        <div>
                            <dt className="inline font-semibold text-gray-500 dark:text-gray-500">Status: </dt>
                            <dd className="inline font-medium text-gray-800 dark:text-gray-200">{event.status}</dd>
                        </div>
                    ) : null}
                    {event.isolationType ? (
                        <div>
                            <dt className="inline font-semibold text-gray-500 dark:text-gray-500">Isolation: </dt>
                            <dd className="inline text-gray-800 dark:text-gray-200">{event.isolationType}</dd>
                        </div>
                    ) : null}
                </dl>
            </article>
        </li>
    );
}
