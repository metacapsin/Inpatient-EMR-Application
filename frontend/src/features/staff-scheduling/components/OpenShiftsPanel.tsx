import { useEffect, useState } from 'react';
import { listOpenShifts } from '../../../services/staffScheduling.service';
import type { OpenShiftRow } from '../../../types/staffScheduling.types';
import type { ScheduleFilters } from './ScheduleFiltersBar';

interface OpenShiftsPanelProps {
    filters: ScheduleFilters;
    wardNames: Record<string, string>;
    canManage: boolean;
    onAssign: (row: OpenShiftRow) => void;
    refreshKey: number;
}

export function OpenShiftsPanel({ filters, wardNames, canManage, onAssign, refreshKey }: OpenShiftsPanelProps) {
    const [rows, setRows] = useState<OpenShiftRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        void listOpenShifts({
            wardId: filters.wardId || undefined,
            from: filters.rangeStart || today,
            to: filters.rangeEnd || today,
            wardNames,
        })
            .then(setRows)
            .finally(() => setLoading(false));
    }, [filters.wardId, filters.rangeStart, filters.rangeEnd, wardNames, refreshKey]);

    if (loading) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">Loading open shifts…</p>;
    }

    if (rows.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No open shifts or coverage gaps for the selected filters.
            </p>
        );
    }

    return (
        <ul className="space-y-2">
            {rows.map((row) => {
                const start = new Date(row.shift.startAt);
                const label = start.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                return (
                    <li
                        key={`${row.shift.id}-${row.reason}`}
                        className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700/80 dark:bg-[#0c0a08]/40"
                    >
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {row.wardName} · {row.shiftTypeLabel}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {label} ·{' '}
                                {row.reason === 'unassigned' ? 'Unassigned shift' : 'Understaffed vs coverage rule'}
                            </p>
                        </div>
                        {canManage ? (
                            <button
                                type="button"
                                className="btn btn-primary btn-sm shrink-0"
                                onClick={() => onAssign(row)}
                            >
                                Assign
                            </button>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
