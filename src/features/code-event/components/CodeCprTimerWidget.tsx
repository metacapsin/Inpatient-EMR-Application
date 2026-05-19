import { useEffect, useMemo, useRef, useState } from 'react';
import type { CodeEventTimelineEntry } from '../../../types/codeEvent';
import { formatCodeEventDuration } from '../utils/codeEventFormatters';
import { CPR_START_TYPE, CPR_STOP_TYPE } from '../constants/codeEventOptions';
import { CODE_EVENT_SECTION_CARD_CLASS } from '../constants/codeEventLayout';
import { cn } from '../../../lib/utils';

const CPR_REMINDER_MS = 2 * 60 * 1000;

type Props = {
    timeline: CodeEventTimelineEntry[];
    disabled?: boolean;
};

function resolveCprState(timeline: CodeEventTimelineEntry[]): { running: boolean; startedAt: number | null } {
    const sorted = [...timeline].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let running = false;
    let startedAt: number | null = null;
    for (const entry of sorted) {
        if (entry.entryType === CPR_START_TYPE) {
            running = true;
            const t = new Date(entry.timestamp).getTime();
            if (!Number.isNaN(t)) startedAt = t;
        }
        if (entry.entryType === CPR_STOP_TYPE) {
            running = false;
            startedAt = null;
        }
    }
    return { running, startedAt };
}

export function CodeCprTimerWidget({ timeline, disabled }: Props) {
    const [now, setNow] = useState(Date.now());
    const [flash, setFlash] = useState(false);
    const lastReminderRef = useRef(0);

    const { running, startedAt } = useMemo(() => resolveCprState(timeline), [timeline]);
    const elapsedMs = running && startedAt ? now - startedAt : 0;

    useEffect(() => {
        if (!running) return;
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [running]);

    useEffect(() => {
        if (!running || !startedAt) return;
        const elapsed = Date.now() - startedAt;
        const reminders = Math.floor(elapsed / CPR_REMINDER_MS);
        if (reminders > lastReminderRef.current) {
            lastReminderRef.current = reminders;
            setFlash(true);
            const t = window.setTimeout(() => setFlash(false), 800);
            return () => clearTimeout(t);
        }
    }, [now, running, startedAt]);

    useEffect(() => {
        if (!running) lastReminderRef.current = 0;
    }, [running]);

    return (
        <section className={cn(CODE_EVENT_SECTION_CARD_CLASS, flash && 'ring-2 ring-amber-400/80 dark:ring-amber-500/50')}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">CPR timer</h3>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Auto-starts on CPR Started · 2-minute cycle reminder
                    </p>
                </div>
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        running ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    )}
                >
                    {running ? 'Running' : 'Idle'}
                </span>
            </div>
            <p
                className={cn(
                    'mt-3 font-mono text-3xl font-bold tabular-nums tracking-tight',
                    running ? 'text-red-800 dark:text-red-200' : 'text-gray-400 dark:text-gray-500',
                    disabled && 'opacity-60'
                )}
                aria-live="polite"
            >
                {running ? formatCodeEventDuration(elapsedMs) : '—:—'}
            </p>
            {flash ? (
                <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Check compression quality · rhythm · meds</p>
            ) : null}
        </section>
    );
}
