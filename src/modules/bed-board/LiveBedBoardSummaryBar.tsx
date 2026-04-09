import type { LiveBedBoardSummary } from '../../types/liveBedBoard';
import { bedStatusIndicatorClass } from '../../lib/adtBedPicker';

interface LiveBedBoardSummaryBarProps {
    summary: LiveBedBoardSummary;
}

export function LiveBedBoardSummaryBar({ summary }: LiveBedBoardSummaryBarProps) {
    const { totalBeds, byStatus, withActiveEncounter, occupiedWithoutEncounter } = summary;
    const statusEntries = Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="space-y-2 rounded-lg border border-gray-200/60 bg-gray-50/40 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300">Summary</span>
                <span className="text-gray-500 dark:text-gray-500">
                    {totalBeds} bed{totalBeds === 1 ? '' : 's'}
                </span>
                <span className="text-gray-300 dark:text-gray-600" aria-hidden>
                    ·
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                    Active encounter{' '}
                    <strong className="font-semibold tabular-nums text-gray-900 dark:text-white">{withActiveEncounter}</strong>
                </span>
            </div>
            {statusEntries.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {statusEntries.map(([label, count]) => (
                        <span
                            key={label}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200/70 bg-white/80 px-2 py-0.5 text-[11px] text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
                        >
                            <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${bedStatusIndicatorClass(label)}`}
                                aria-hidden
                            />
                            <span className="capitalize">{label}</span>
                            <span className="font-mono tabular-nums text-[10px] text-gray-500 dark:text-gray-400">{count}</span>
                        </span>
                    ))}
                </div>
            ) : null}
            {occupiedWithoutEncounter > 0 ? (
                <div
                    role="status"
                    className="rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100"
                >
                    <strong className="font-semibold">Data check:</strong> {occupiedWithoutEncounter} occupied bed
                    {occupiedWithoutEncounter === 1 ? '' : 's'} ha{occupiedWithoutEncounter === 1 ? 's' : 've'} no linked in-progress
                    encounter. Review ADT or bed status configuration.
                </div>
            ) : null}
        </div>
    );
}
