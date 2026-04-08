import type { LiveBedBoardSummary } from '../../types/liveBedBoard';
import { bedStatusIndicatorClass } from '../../lib/adtBedPicker';

interface LiveBedBoardSummaryBarProps {
    summary: LiveBedBoardSummary;
}

export function LiveBedBoardSummaryBar({ summary }: LiveBedBoardSummaryBarProps) {
    const { totalBeds, byStatus, withActiveEncounter, occupiedWithoutEncounter } = summary;
    const statusEntries = Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="space-y-3 rounded-xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white">Summary</span>
                <span className="text-gray-500 dark:text-gray-400">
                    {totalBeds} bed{totalBeds === 1 ? '' : 's'} total
                </span>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className="text-gray-600 dark:text-gray-300">
                    With active encounter: <strong className="font-semibold text-gray-900 dark:text-white">{withActiveEncounter}</strong>
                </span>
            </div>
            {statusEntries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {statusEntries.map(([label, count]) => (
                        <span
                            key={label}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/90 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200"
                        >
                            <span
                                className={`h-2 w-2 shrink-0 rounded-full ${bedStatusIndicatorClass(label)}`}
                                aria-hidden
                            />
                            <span className="capitalize">{label}</span>
                            <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{count}</span>
                        </span>
                    ))}
                </div>
            ) : null}
            {occupiedWithoutEncounter > 0 ? (
                <div
                    role="status"
                    className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100"
                >
                    <strong className="font-semibold">Data check:</strong> {occupiedWithoutEncounter} occupied bed
                    {occupiedWithoutEncounter === 1 ? '' : 's'} ha{occupiedWithoutEncounter === 1 ? 's' : 've'} no linked in-progress
                    encounter. Review ADT or bed status configuration.
                </div>
            ) : null}
        </div>
    );
}
