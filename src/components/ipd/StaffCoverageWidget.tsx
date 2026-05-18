import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCoverageSummary } from '../../services/staffScheduling.service';
import { getWards } from '../../services/rooms.service';
import type { CoverageSummary } from '../../types/staffScheduling.types';

export function StaffCoverageWidget() {
    const [summary, setSummary] = useState<CoverageSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const wards = await getWards();
                const wardNames: Record<string, string> = {};
                wards.forEach((w) => {
                    wardNames[String(w.id)] = w.name;
                });
                const today = new Date().toISOString().slice(0, 10);
                const data = await getCoverageSummary({ date: today, wardNames });
                if (!cancelled) setSummary(data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openCount = summary?.openShiftCount ?? 0;
    const gapCount = summary?.understaffedWards.length ?? 0;

    return (
        <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-gray-700/80 dark:bg-[#0c0a08]/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Today&apos;s coverage
                    </p>
                    {loading ? (
                        <p className="text-sm text-gray-500">Loading…</p>
                    ) : (
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {openCount > 0 || gapCount > 0
                                ? `${openCount} open · ${gapCount} understaffed ward${gapCount === 1 ? '' : 's'}`
                                : 'All wards meeting coverage targets'}
                        </p>
                    )}
                </div>
                <Link
                    to="/app/staff-scheduling?tab=open-shifts"
                    className="text-xs font-semibold text-primary hover:underline"
                >
                    Open staff scheduling
                </Link>
            </div>
        </div>
    );
}
