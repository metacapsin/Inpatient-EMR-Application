import { useNavigate } from 'react-router-dom';
import type { CodeEventSummary } from '../../../types/codeEvent';

type Props = {
    events: CodeEventSummary[];
    className?: string;
};

export function IpdActiveCodeBadges({ events, className = '' }: Props) {
    const navigate = useNavigate();
    if (events.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {events.map((e) => (
                <button
                    key={e.id}
                    type="button"
                    onClick={() => navigate(`/app/inpatient/code-event/${e.id}`)}
                    className="inline-flex items-center gap-1 rounded-full border border-red-300/80 bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-red-700 dark:border-red-800"
                    title={`${e.eventType} · ${e.location}`}
                >
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    {e.eventType.replace('Code ', '').slice(0, 8)}
                </button>
            ))}
        </div>
    );
}
