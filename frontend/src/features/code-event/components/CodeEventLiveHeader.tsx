import { useEffect, useState } from 'react';
import type { CodeEventRecord } from '../../../types/codeEvent';
import { formatCodeEventDuration } from '../utils/codeEventFormatters';
import { CodeEventTypeBadge } from './CodeEventTypeBadge';
import { CodeEventStatusBadge } from './CodeEventStatusBadge';
import { CODE_EVENT_LIVE_HEADER_CLASS } from '../constants/codeEventLayout';

type Props = {
    event: CodeEventRecord;
};

export function CodeEventLiveHeader({ event }: Props) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (event.status !== 'active') return;
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [event.status]);

    const start = new Date(event.calledAt).getTime();
    const elapsed = event.status === 'active' && !Number.isNaN(start) ? formatCodeEventDuration(now - start) : '—';

    return (
        <header className={CODE_EVENT_LIVE_HEADER_CLASS} aria-label="Active code event">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-red-950 dark:text-red-50">
                            {event.patientName ?? 'Patient'}
                            <span className="ml-2 font-mono text-xs font-semibold text-red-800/80 dark:text-red-200/80">
                                MRN {event.patientMrn ?? '—'}
                            </span>
                        </p>
                        <p className="text-[11px] font-medium text-red-800/90 dark:text-red-200/90">
                            {event.location} · Lead {event.teamLeadName}
                        </p>
                    </div>
                    <CodeEventTypeBadge eventType={event.eventType} />
                    <CodeEventStatusBadge status={event.status} />
                </div>
                <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800/70 dark:text-red-300/70">
                            Event duration
                        </p>
                        <p className="font-mono text-lg font-bold tabular-nums text-red-950 dark:text-red-50">{elapsed}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
