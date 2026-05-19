import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import type { CodeEventSummary } from '../../../types/codeEvent';
import { CodeEventTypeBadge } from './CodeEventTypeBadge';

type Props = {
    events: CodeEventSummary[];
};

export function IpdCodeAlertStrip({ events }: Props) {
    const navigate = useNavigate();
    if (events.length === 0) return null;

    return (
        <div
            className="shrink-0 rounded-xl border border-red-300/80 bg-red-50 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/40 sm:px-4"
            role="alert"
        >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Siren className="h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
                    <span className="text-xs font-bold uppercase tracking-wide text-red-900 dark:text-red-100">
                        Active emergency events ({events.length})
                    </span>
                </div>
                <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {events.map((e) => (
                        <li key={e.id}>
                            <button
                                type="button"
                                onClick={() => navigate(`/app/inpatient/code-event/${e.id}`)}
                                className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-red-200/90 bg-white px-2.5 py-1.5 text-left text-xs shadow-sm transition hover:bg-red-50 dark:border-red-900/40 dark:bg-[#1a1210] dark:hover:bg-red-950/60"
                            >
                                <span className="font-semibold text-gray-900 dark:text-white truncate">
                                    {e.patientName ?? 'Patient'}
                                </span>
                                <CodeEventTypeBadge eventType={e.eventType} className="!text-[9px]" />
                                <span className="text-gray-500 dark:text-gray-400">{e.location}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
