import React, { memo } from 'react';
import type { IpdBedRow } from '../../types/ipdDashboard';

type Props = {
    rows: IpdBedRow[];
    selectedId: string | null;
    onSelect: (row: IpdBedRow) => void;
    loading?: boolean;
};

function statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'occupied') return 'bg-primary/15 text-primary dark:bg-primary/25';
    if (s === 'available') return 'bg-success/15 text-success dark:bg-success/20';
    if (s === 'cleaning') return 'bg-warning/15 text-warning dark:bg-warning/20';
    return 'bg-gray-100 text-gray-700 dark:bg-dark dark:text-gray-300';
}

function IpdBedBoardTableInner({ rows, selectedId, onSelect, loading }: Props) {
    return (
        <div className="panel rounded-xl border border-white-light dark:border-dark shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="shrink-0 px-4 py-3 border-b border-white-light dark:border-dark">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Bed Board</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ward occupancy and assignments</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left text-sm table-fixed">
                    <thead className="sticky top-0 z-10 bg-[#faf8f6] dark:bg-[#1a1612] shadow-[0_1px_0_0] shadow-primary-200/40 dark:shadow-dark">
                        <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <th className="px-4 py-2.5 font-semibold w-[14%]">Ward</th>
                            <th className="px-4 py-2.5 font-semibold w-[12%]">Room</th>
                            <th className="px-4 py-2.5 font-semibold w-[10%]">Bed</th>
                            <th className="px-4 py-2.5 font-semibold w-[22%]">Patient Name</th>
                            <th className="px-4 py-2.5 font-semibold w-[14%]">Status</th>
                            <th className="px-4 py-2.5 font-semibold w-[28%]">Doctor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white-light dark:divide-dark">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 rounded bg-gray-100 dark:bg-dark animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                    No beds to display
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const isSel = selectedId === row.id;
                                return (
                                    <tr
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onSelect(row);
                                            }
                                        }}
                                        className={`cursor-pointer transition-colors ${
                                            isSel
                                                ? 'bg-primary/10 dark:bg-primary/15'
                                                : 'hover:bg-gray-50 dark:hover:bg-dark/80'
                                        }`}
                                    >
                                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 truncate" title={row.ward}>
                                            {row.ward}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 truncate" title={row.room}>
                                            {row.room}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 truncate" title={row.bed}>
                                            {row.bed}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium truncate" title={row.patientName || '—'}>
                                            {row.patientName || '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 truncate" title={row.doctor}>
                                            {row.doctor}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export const IpdBedBoardTable = memo(IpdBedBoardTableInner);
