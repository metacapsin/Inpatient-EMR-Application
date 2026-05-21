import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { getHaiEncounterTimeline } from '../../services/haiEvent.service';
import { HAIEventTimelineCard } from './HAIEventTimelineCard';

type Props = {
    encounterId: string;
};

export function HAIEncounterTimeline({ encounterId }: Props) {
    const id = encounterId.trim();

    const timelineQuery = useQuery({
        queryKey: ['haiEvent', 'encounter', id],
        queryFn: () => getHaiEncounterTimeline(id),
        enabled: Boolean(id),
        staleTime: 30_000,
    });

    const events = timelineQuery.data?.events ?? [];
    const loading = timelineQuery.isLoading && !timelineQuery.data;
    const usingMock = timelineQuery.isSuccess && import.meta.env.VITE_HAI_EVENT_MOCK !== 'false';

    if (!id) {
        return (
            <section className="rounded-lg border border-dashed border-gray-200/90 bg-gray-50/50 px-4 py-6 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select an active encounter to view infection event history.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#1a1a1a]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" aria-hidden />
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Encounter infection timeline
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            HAI events for encounter {id.length > 12 ? `…${id.slice(-8)}` : id}
                        </p>
                    </div>
                </div>
                {usingMock ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">
                        Demo data
                    </span>
                ) : null}
            </div>

            <div className="px-4 py-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8">
                        <Loader2 className="h-7 w-7 animate-spin text-primary/80" aria-hidden />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading timeline…</p>
                    </div>
                ) : timelineQuery.isError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Could not load infection timeline. Showing empty state.
                    </p>
                ) : events.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No infection events recorded for this encounter.
                    </p>
                ) : (
                    <ol className="list-none pl-0">
                        {events.map((event, index) => (
                            <HAIEventTimelineCard
                                key={event.id}
                                event={event}
                                isLast={index === events.length - 1}
                            />
                        ))}
                    </ol>
                )}
            </div>
        </section>
    );
}
