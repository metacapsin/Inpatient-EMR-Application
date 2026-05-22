import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { PatientComplianceRow, BundleKey } from '../../types/quality';
import { BUNDLE_COLUMNS } from '../../constants/quality/bundles';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { ComplianceProgressBar } from './ComplianceProgressBar';
import { overallScoreStatus, QM_STATUS_STYLES } from '../../constants/quality/theme';
import { cn } from '@/lib/utils';

type Props = {
    row: PatientComplianceRow;
    onBundleClick: (bundleKey: BundleKey) => void;
};

function QualityPatientMobileCardInner({ row, onBundleClick }: Props) {
    const overallStatus = overallScoreStatus(row.overall.score);

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-emr-border bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#1a1816]/80"
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-xs font-semibold text-emr-text dark:text-white">{row.patientName}</h3>
                    <p className="text-[10px] text-emr-muted dark:text-gray-400">
                        {row.mrn} · Room {row.roomNumber} · LOS {row.losDays}d
                    </p>
                </div>
                <span
                    className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums',
                        QM_STATUS_STYLES[overallStatus].badge,
                    )}
                >
                    {row.overall.score}%
                </span>
            </div>
            {row.highRisk && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emr-danger dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    High risk
                </p>
            )}
            <ul className="mt-2 space-y-1" role="list">
                {BUNDLE_COLUMNS.map((col) => {
                    const cell = row.bundles[col.key];
                    return (
                        <li key={col.key}>
                            <button
                                type="button"
                                onClick={() => onBundleClick(col.key)}
                                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-1 py-1.5 text-left transition hover:border-emr-border hover:bg-emr-hover/50 dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
                            >
                                <span className="min-w-[5rem] text-xs font-medium text-emr-muted dark:text-gray-400">
                                    {col.shortLabel}
                                </span>
                                <ComplianceProgressBar
                                    score={cell.score}
                                    status={cell.status}
                                    className="flex-1"
                                />
                                <ComplianceStatusBadge status={cell.status} compact />
                                {cell.overdueCount > 0 && (
                                    <span className="text-[10px] font-semibold text-emr-danger" title="Overdue">
                                        +{cell.overdueCount}
                                    </span>
                                )}
                                <ChevronRight className="h-4 w-4 shrink-0 text-emr-muted" aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </motion.article>
    );
}

export const QualityPatientMobileCard = memo(QualityPatientMobileCardInner);
