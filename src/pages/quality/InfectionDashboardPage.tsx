import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { Activity, Biohazard, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_HAI_UNIT_ID } from '../../data/haiEventMockData';
import { getHaiUnitSummary } from '../../services/haiEvent.service';
import { InfectionQualityKpiRow } from '../../components/hai/InfectionQualityKpiRow';
import { HAIEventTimelineCard } from '../../components/hai/HAIEventTimelineCard';

const UNIT_OPTIONS = [
    { id: 'unit-1', label: 'Medical Unit A' },
    { id: 'unit-2', label: 'Surgical Unit B' },
];

function formatAsOf(iso: string): string {
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d, yyyy · h:mm a');
    } catch {
        return iso;
    }
}

export default function InfectionDashboardPage() {
    const [unitId, setUnitId] = useState(DEFAULT_HAI_UNIT_ID);

    const summaryQuery = useQuery({
        queryKey: ['haiEvent', 'summary', unitId],
        queryFn: () => getHaiUnitSummary(unitId),
        staleTime: 30_000,
    });

    const summary = summaryQuery.data;
    const loading = summaryQuery.isLoading && !summary;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
            <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                        <Biohazard className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Infection quality dashboard
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Hospital/unit HAI summary and analytics
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Unit
                        <select
                            value={unitId}
                            onChange={(e) => setUnitId(e.target.value)}
                            className="h-9 min-w-[10rem] rounded-lg border border-gray-200 bg-white px-2 text-sm font-medium text-gray-900 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100"
                        >
                            {UNIT_OPTIONS.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Link
                        to="/app/dashboard"
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-200 dark:hover:bg-white/[0.04]"
                    >
                        IPD dashboard
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading infection summary…</p>
                </div>
            ) : summaryQuery.isError ? (
                <div className="rounded-lg border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    Failed to load unit summary. Try again later.
                </div>
            ) : summary ? (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{summary.unitName}</span>
                            {' · '}
                            Updated {formatAsOf(summary.asOf)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">
                            GET /api/HAIEvent/summary/{unitId}
                        </span>
                    </div>

                    <InfectionQualityKpiRow summary={summary} loading={summaryQuery.isFetching} />

                    {summary.activeByType && summary.activeByType.length > 0 ? (
                        <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm p-4">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                Active infections by type
                            </h2>
                            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {summary.activeByType.map((row) => (
                                    <li
                                        key={row.infectionType}
                                        className="flex items-center justify-between rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]"
                                    >
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {row.infectionType}
                                        </span>
                                        <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                                            {row.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm flex flex-col min-h-0 overflow-hidden">
                        <div className="shrink-0 flex items-center gap-2 border-b border-white-light dark:border-dark px-4 py-3">
                            <Activity className="h-4 w-4 text-primary" aria-hidden />
                            <div>
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent unit events</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Latest HAI events across encounters</p>
                            </div>
                        </div>
                        <div className="px-4 py-4 max-h-[28rem] overflow-y-auto [scrollbar-width:thin]">
                            {summary.recentEvents && summary.recentEvents.length > 0 ? (
                                <ol className="list-none pl-0">
                                    {summary.recentEvents.map((event, index) => (
                                        <HAIEventTimelineCard
                                            key={event.id}
                                            event={event}
                                            isLast={index === (summary.recentEvents?.length ?? 0) - 1}
                                        />
                                    ))}
                                </ol>
                            ) : (
                                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No recent events for this unit.
                                </p>
                            )}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
