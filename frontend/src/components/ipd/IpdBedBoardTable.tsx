import React, { memo } from 'react';
import { BedDouble, LayoutGrid } from 'lucide-react';
import { InfectionBedBoardIndicator } from '../infection/InfectionBedBoardIndicator';
import type { IpdBedRow } from '../../types/ipdDashboard';
import {
    ipdModuleCardClass,
    ipdModuleDescClass,
    ipdModuleHeaderClass,
    ipdModuleTitleClass,
} from '../../styles/ipdDashboardClasses';
import { cn } from '@/lib/utils';

type Props = {
    rows: IpdBedRow[];
    selectedId: string | null;
    onSelect: (row: IpdBedRow) => void;
    loading?: boolean;
};

function statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'occupied')
        return 'border border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/20 dark:text-primary-200';
    if (s === 'available')
        return 'border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/35 dark:text-emerald-300';
    if (s === 'cleaning')
        return 'border border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/35 dark:text-amber-200';
    return 'border border-emr-border bg-emr-hover text-emr-text dark:border-white/10 dark:bg-white/5 dark:text-gray-300';
}

function IpdBedBoardTableInner({ rows, selectedId, onSelect, loading }: Props) {
    const occupiedCount = rows.filter((r) => r.status.toLowerCase() === 'occupied').length;

    return (
        <div className={cn(ipdModuleCardClass, 'flex flex-col')}>
            <div className={ipdModuleHeaderClass}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200">
                            <LayoutGrid className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <h2 className={ipdModuleTitleClass}>Bed Board</h2>
                            <p className={ipdModuleDescClass}>Ward occupancy and assignments</p>
                        </div>
                    </div>
                    {!loading && rows.length > 0 ? (
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-emr-muted dark:text-gray-500">
                                Census
                            </span>
                            <span className="text-xs font-bold tabular-nums text-emr-text dark:text-white">
                                {occupiedCount}/{rows.length} occupied
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto scrollbar-hide">
                <table className="w-full table-fixed text-left text-[13px]">
                    <thead className="sticky top-0 z-10 border-b border-emr-border/90 bg-[#f7f5f2]/95 backdrop-blur-sm dark:border-white/10 dark:bg-[#1a1816]/95">
                        <tr className="text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted dark:text-gray-500">
                            <th className="w-[14%] px-3 py-2 font-semibold sm:px-3.5">Ward</th>
                            <th className="w-[11%] px-3 py-2 font-semibold sm:px-3.5">Room</th>
                            <th className="w-[9%] px-3 py-2 font-semibold sm:px-3.5">Bed</th>
                            <th className="w-[24%] px-3 py-2 font-semibold sm:px-3.5">Patient Name</th>
                            <th className="w-[13%] px-3 py-2 font-semibold sm:px-3.5">Status</th>
                            <th className="w-[29%] px-3 py-2 font-semibold sm:px-3.5">Doctor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-emr-border/70 dark:divide-white/[0.06]">
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 6 }).map((__, j) => (
                                        <td key={j} className="px-3.5 py-2.5 sm:px-4">
                                            <div className="h-3.5 rounded bg-emr-hover dark:bg-white/10" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 sm:py-12">
                                    <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                                        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emr-border/90 bg-emr-hover/80 text-emr-muted dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                                            <BedDouble className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                                        </span>
                                        <p className="text-sm font-semibold text-emr-text dark:text-gray-200">No beds to display</p>
                                        <p className="mt-1 text-xs text-emr-muted dark:text-gray-500">
                                            Bed assignments will appear here when census data is available.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => {
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
                                        className={cn(
                                            'cursor-pointer transition-colors duration-150',
                                            index % 2 === 1 && !isSel && 'bg-[#faf9f7]/60 dark:bg-white/[0.02]',
                                            isSel
                                                ? 'bg-emr-active/90 ring-1 ring-inset ring-emr-accent/20 dark:bg-primary/12 dark:ring-primary/25'
                                                : 'hover:bg-emr-hover/80 dark:hover:bg-white/[0.04]',
                                        )}
                                    >
                                        <td
                                            className={cn(
                                                'relative px-3 py-2 font-medium text-emr-text dark:text-gray-200 sm:px-3.5',
                                                isSel &&
                                                    'before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-r before:bg-emr-accent dark:before:bg-primary',
                                            )}
                                            title={row.ward}
                                        >
                                            <span className="block truncate">{row.ward}</span>
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-emr-text dark:text-gray-300 sm:px-3.5 truncate" title={row.room}>
                                            {row.room}
                                        </td>
                                        <td className="px-3 py-2 font-semibold tabular-nums text-emr-text dark:text-gray-200 sm:px-3.5 truncate" title={row.bed}>
                                            {row.bed}
                                        </td>
                                        <td className="px-3 py-2 sm:px-3.5" title={row.patientName || '—'}>
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <span
                                                    className={cn(
                                                        'truncate font-semibold',
                                                        row.patientName
                                                            ? 'text-emr-text dark:text-white'
                                                            : 'font-normal text-emr-muted dark:text-gray-500',
                                                    )}
                                                >
                                                    {row.patientName || '—'}
                                                </span>
                                                <InfectionBedBoardIndicator patientId={row.patientId} />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 sm:px-3.5">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                                    statusBadgeClass(row.status),
                                                )}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-emr-muted dark:text-gray-400 sm:px-3.5 truncate" title={row.doctor}>
                                            {row.doctor || '—'}
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
