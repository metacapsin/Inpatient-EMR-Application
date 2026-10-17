import type { EvsQueueMetrics } from '../../types/evs';
import { formatQueueDuration } from './evsQueueUtils';

interface EVSMetricsBarProps {
    metrics: EvsQueueMetrics | undefined;
    loading?: boolean;
}

function MetricCard({
    title,
    value,
    loading,
    highlight,
}: {
    title: string;
    value: string;
    loading?: boolean;
    highlight?: boolean;
}) {
    const border = highlight
        ? 'border-red-200/80 bg-red-50/90 dark:border-red-900/35 dark:bg-red-950/25'
        : 'border-gray-200/70 bg-white dark:border-white/[0.08] dark:bg-[#1a1a1a]';

    return (
        <div className={`flex min-w-[9rem] flex-1 flex-col justify-center rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${border}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">{title}</p>
            {loading ? (
                <span className="mt-1.5 block h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" aria-hidden />
            ) : (
                <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
            )}
        </div>
    );
}

export function EVSMetricsBar({ metrics, loading }: EVSMetricsBarProps) {
    const avg = metrics ? formatQueueDuration(metrics.avgTurnaroundMinutesToday) : '—';
    const longest = metrics ? formatQueueDuration(metrics.longestWaitMinutes) : '—';
    const overdue = (metrics?.longestWaitMinutes ?? 0) > 120;

    return (
        <section className="sticky top-0 z-20 -mx-1 border-b border-gray-200/70 bg-gray-50/95 px-1 py-3 backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#141210]/95">
            <div className="flex flex-wrap gap-2">
                <MetricCard title="Avg turnaround today" value={avg} loading={loading} />
                <MetricCard title="Longest wait" value={longest} loading={loading} highlight={overdue} />
                <MetricCard title="Beds dirty" value={String(metrics?.bedsDirty ?? 0)} loading={loading} />
                <MetricCard title="Beds in cleaning" value={String(metrics?.bedsInCleaning ?? 0)} loading={loading} />
                <MetricCard title="Beds available" value={String(metrics?.bedsAvailable ?? 0)} loading={loading} />
            </div>
        </section>
    );
}
