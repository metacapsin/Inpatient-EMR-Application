import { memo, useMemo, useState } from 'react';
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';
import type { BundleKey, PatientComplianceRow } from '../../types/quality';
import { BUNDLE_COLUMNS, BUNDLE_LABELS } from '../../constants/quality/bundles';
import { ComplianceProgressBar } from './ComplianceProgressBar';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { TableRowSkeleton } from './QualitySkeletons';
import { overallScoreStatus, QM_STATUS_STYLES } from '../../constants/quality/theme';
import { cn } from '@/lib/utils';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import {
    qmModuleCardClass,
    qmModuleDescClass,
    qmModuleHeaderClass,
    qmModuleTitleClass,
    qmTableBodyCellClass,
    qmTableBodyRowClass,
    qmTableHeadCellClass,
    qmTableHeadRowClass,
    qmTableScrollClass,
} from '../../styles/qualityDashboardClasses';

type Props = {
    rows: PatientComplianceRow[];
    loading: boolean;
};

function BundleCell({
    score,
    status,
    overdueCount,
}: {
    score: number;
    status: PatientComplianceRow['bundles'][BundleKey]['status'];
    overdueCount: number;
}) {
    return (
        <div className="flex min-w-[4.5rem] flex-col gap-0.5">
            <ComplianceProgressBar score={score} status={status} dense />
            <div className="flex items-center justify-between gap-0.5">
                <ComplianceStatusBadge status={status} dense />
                {overdueCount > 0 && (
                    <span
                        className="text-[9px] font-bold leading-none text-emr-danger dark:text-red-400"
                        title={`${overdueCount} overdue`}
                    >
                        +{overdueCount}
                    </span>
                )}
            </div>
        </div>
    );
}

function QualityUnitTableInner({ rows, loading }: Props) {
    const openBundlePanel = useQualityMeasuresStore((s) => s.openBundlePanel);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'overall', desc: true }]);

    const columns = useMemo<ColumnDef<PatientComplianceRow>[]>(
        () => [
            {
                id: 'patient',
                accessorFn: (r) => r.patientName,
                header: 'Patient',
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <div className="min-w-[8.5rem] max-w-[11rem]">
                            <div className="flex items-center gap-1">
                                <p className="truncate text-xs font-semibold text-emr-text dark:text-white">
                                    {r.patientName}
                                </p>
                                {r.highRisk && (
                                    <AlertTriangle
                                        className="h-3 w-3 shrink-0 text-emr-danger"
                                        aria-label="High risk"
                                    />
                                )}
                            </div>
                            <p className="truncate text-[10px] text-emr-muted dark:text-gray-500">
                                {r.mrn} · {r.roomNumber}
                            </p>
                        </div>
                    );
                },
            },
            {
                id: 'los',
                accessorFn: (r) => r.losDays,
                header: 'LOS',
                cell: ({ getValue }) => (
                    <span className="text-xs font-semibold tabular-nums text-emr-text dark:text-gray-200">
                        {getValue<number>()}d
                    </span>
                ),
            },
            ...BUNDLE_COLUMNS.map(
                (col): ColumnDef<PatientComplianceRow> => ({
                    id: col.key,
                    accessorFn: (r) => r.bundles[col.key].score,
                    header: col.header,
                    cell: ({ row }) => {
                        const cell = row.original.bundles[col.key];
                        return (
                            <button
                                type="button"
                                className="w-full rounded px-0.5 text-left transition hover:bg-emr-hover/70 focus-visible:outline focus-visible:ring-1 focus-visible:ring-primary/40 dark:hover:bg-white/[0.05]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const r = row.original;
                                    openBundlePanel({
                                        encounterId: r.encounterId,
                                        measureId: r.measureId,
                                        bundleKey: col.key,
                                        bundleLabel: BUNDLE_LABELS[col.key],
                                        patientName: r.patientName,
                                        mrn: r.mrn,
                                        roomNumber: r.roomNumber,
                                    });
                                }}
                                aria-label={`${col.header} for ${row.original.patientName}`}
                                title={col.header}
                            >
                                <BundleCell
                                    score={cell.score}
                                    status={cell.status}
                                    overdueCount={cell.overdueCount}
                                />
                            </button>
                        );
                    },
                }),
            ),
            {
                id: 'overall',
                accessorFn: (r) => r.overall.score,
                header: 'Overall',
                cell: ({ row }) => {
                    const score = row.original.overall.score;
                    const status = overallScoreStatus(score);
                    return (
                        <span
                            className={cn(
                                'inline-flex rounded border px-1.5 py-px text-[11px] font-bold tabular-nums leading-tight',
                                QM_STATUS_STYLES[status].badge,
                            )}
                        >
                            {score}%
                        </span>
                    );
                },
            },
        ],
        [openBundlePanel],
    );

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div
            className={cn('hidden md:flex md:flex-col', qmModuleCardClass)}
            role="region"
            aria-label="Unit compliance overview"
        >
            <div className={qmModuleHeaderClass}>
                <h2 className={qmModuleTitleClass}>Unit compliance</h2>
                <p className={qmModuleDescClass}>Click cell for bundle detail · sorted by overall</p>
            </div>
            <div className={qmTableScrollClass}>
                <table className="w-full min-w-[1000px] border-collapse">
                    <thead className="sticky top-0 z-10">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id} className={qmTableHeadRowClass}>
                                {hg.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className={cn(
                                                qmTableHeadCellClass,
                                                'max-w-[5.5rem] whitespace-normal leading-tight',
                                                header.id === 'patient' && 'max-w-[8.5rem]',
                                                header.id === 'los' && 'w-10 max-w-none text-center',
                                                header.id === 'overall' && 'w-12 max-w-none text-right',
                                            )}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'inline-flex items-center gap-0.5 hover:text-emr-text dark:hover:text-white',
                                                        header.column.getCanSort() && 'cursor-pointer',
                                                    )}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext(),
                                                    )}
                                                    {header.column.getCanSort() && (
                                                        <ArrowUpDown
                                                            className="h-2.5 w-2.5 opacity-40"
                                                            aria-hidden
                                                        />
                                                    )}
                                                </button>
                                            )}
                                        </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading && rows.length === 0
                            ? Array.from({ length: 8 }).map((_, i) => (
                                  <TableRowSkeleton key={i} compact />
                              ))
                            : null}
                        <AnimatePresence mode="popLayout">
                            {table.getRowModel().rows.map((row) => (
                                <motion.tr
                                    key={row.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.12 }}
                                    className={cn(qmTableBodyRowClass, 'cursor-pointer')}
                                    onClick={() => {
                                        const r = row.original;
                                        openBundlePanel({
                                            encounterId: r.encounterId,
                                            measureId: r.measureId,
                                            bundleKey: 'sep1',
                                            bundleLabel: BUNDLE_LABELS.sep1,
                                            patientName: r.patientName,
                                            mrn: r.mrn,
                                            roomNumber: r.roomNumber,
                                        });
                                    }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className={cn(
                                                qmTableBodyCellClass,
                                                cell.column.id === 'overall' && 'text-right',
                                                cell.column.id === 'los' && 'text-center',
                                            )}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </td>
                                    ))}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
            {!loading && rows.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-emr-muted dark:text-gray-400">
                    No patients match your search.
                </p>
            )}
        </div>
    );
}

export const QualityUnitTable = memo(QualityUnitTableInner);
