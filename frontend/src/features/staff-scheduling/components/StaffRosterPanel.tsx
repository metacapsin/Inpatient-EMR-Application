import { useEffect, useMemo, useState } from 'react';
import { listStaff } from '../../../services/staffScheduling.service';
import type { StaffMember } from '../../../types/staffScheduling.types';
import type { ScheduleFilters } from './ScheduleFiltersBar';

interface StaffRosterPanelProps {
    filters: ScheduleFilters;
    highlightStaffId: string | null;
    canManage: boolean;
    onHighlightStaff: (staffId: string | null) => void;
    onAddShiftForStaff: (staffId: string) => void;
}

export function StaffRosterPanel({
    filters,
    highlightStaffId,
    canManage,
    onHighlightStaff,
    onAddShiftForStaff,
}: StaffRosterPanelProps) {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        void listStaff(filters.role ? (filters.role as StaffMember['role']) : undefined)
            .then(setStaff)
            .finally(() => setLoading(false));
    }, [filters.role]);

    const filtered = useMemo(() => {
        const q = filters.staffSearch.trim().toLowerCase();
        if (!q) return staff;
        return staff.filter((s) => s.displayName.toLowerCase().includes(q));
    }, [staff, filters.staffSearch]);

    if (loading) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">Loading roster…</p>;
    }

    if (filtered.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No staff match your filters.
            </p>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-700/80">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                    <tr>
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((s) => {
                        const active = highlightStaffId === s.id;
                        return (
                            <tr
                                key={s.id}
                                className={
                                    active
                                        ? 'bg-primary/5 dark:bg-primary/10'
                                        : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.02]'
                                }
                            >
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                    {s.displayName}
                                    {s.credentials ? (
                                        <span className="ml-1 text-xs font-normal text-gray-500">{s.credentials}</span>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">
                                    {s.role.replace(/-/g, ' ')}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        className="text-xs font-semibold text-primary hover:underline"
                                        onClick={() => onHighlightStaff(active ? null : s.id)}
                                    >
                                        {active ? 'Clear highlight' : 'Show shifts'}
                                    </button>
                                    {canManage ? (
                                        <>
                                            <span className="mx-2 text-gray-300">|</span>
                                            <button
                                                type="button"
                                                className="text-xs font-semibold text-primary hover:underline"
                                                onClick={() => onAddShiftForStaff(s.id)}
                                            >
                                                Add shift
                                            </button>
                                        </>
                                    ) : null}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
