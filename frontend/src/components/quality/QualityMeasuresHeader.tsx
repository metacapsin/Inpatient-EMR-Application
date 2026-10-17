import { memo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Download, RefreshCw, ClipboardCheck, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComplianceSummaryChips } from '../../types/quality';
import { QM_STATUS_STYLES } from '../../constants/quality/theme';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { QualityFilterFields } from './QualityFilterFields';
import {
    qmChipClass,
    qmCommandRowClass,
    qmComplianceChipsClass,
    qmEyebrowClass,
    qmFilterStripClass,
    qmHeaderActionsBtnClass,
    qmHeaderIconClass,
    qmMetaLineClass,
    qmPageTitleClass,
    qmStickyShellClass,
} from '../../styles/qualityDashboardClasses';

type Props = {
    unitName: string;
    lastEvaluatedAt: string;
    complianceSummary: ComplianceSummaryChips | undefined;
    onRefresh: () => void;
    isRefreshing: boolean;
};

function formatEvaluated(iso: string): string {
    try {
        const d = parseISO(iso);
        if (!isValid(d)) return iso;
        return format(d, 'MMM d · h:mm a');
    } catch {
        return iso;
    }
}

const CHIP_CONFIG: { key: keyof ComplianceSummaryChips; label: string }[] = [
    { key: 'compliant', label: 'C' },
    { key: 'pending', label: 'P' },
    { key: 'deficient', label: 'D' },
    { key: 'na', label: 'N/A' },
];

const CHIP_FULL_LABEL: Record<keyof ComplianceSummaryChips, string> = {
    compliant: 'Compliant',
    pending: 'Pending',
    deficient: 'Deficient',
    na: 'Not applicable',
};

function QualityMeasuresHeaderInner({
    unitName,
    lastEvaluatedAt,
    complianceSummary,
    onRefresh,
    isRefreshing,
}: Props) {
    const setMobileFiltersOpen = useQualityMeasuresStore((s) => s.setMobileFiltersOpen);

    return (
        <header className={qmStickyShellClass}>
            <div className={qmCommandRowClass}>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <div className={qmHeaderIconClass} aria-hidden>
                        <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <span className={qmEyebrowClass}>Inpatient quality</span>
                            <h1 className={qmPageTitleClass}>Quality Measures</h1>
                        </div>
                        <p className={qmMetaLineClass}>
                            <span className="font-semibold text-emr-text/90 dark:text-gray-400">{unitName}</span>
                            <span className="mx-1 text-emr-border dark:text-white/20" aria-hidden>
                                ·
                            </span>
                            <time dateTime={lastEvaluatedAt}>Eval {formatEvaluated(lastEvaluatedAt)}</time>
                        </p>
                    </div>
                </div>

                {complianceSummary ? (
                    <div className={qmComplianceChipsClass} role="group" aria-label="Compliance summary">
                        {CHIP_CONFIG.map(({ key, label }) => {
                            const statusKey =
                                key === 'compliant'
                                    ? 'compliant'
                                    : key === 'pending'
                                      ? 'pending'
                                      : key === 'deficient'
                                        ? 'deficient'
                                        : 'na';
                            return (
                                <span
                                    key={key}
                                    className={cn(qmChipClass, QM_STATUS_STYLES[statusKey].badge)}
                                    title={`${CHIP_FULL_LABEL[key]}: ${complianceSummary[key]}`}
                                >
                                    <span className="sr-only">{CHIP_FULL_LABEL[key]} </span>
                                    <span aria-hidden>{label}</span>
                                    <span>{complianceSummary[key]}</span>
                                </span>
                            );
                        })}
                    </div>
                ) : null}

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        className={qmHeaderActionsBtnClass}
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        aria-label="Refresh dashboard"
                    >
                        <RefreshCw
                            className={cn('h-3 w-3', isRefreshing && 'animate-spin')}
                            aria-hidden
                        />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        type="button"
                        className={cn(qmHeaderActionsBtnClass, 'hidden md:inline-flex')}
                        aria-label="Export report (coming soon)"
                        onClick={() => undefined}
                    >
                        <Download className="h-3 w-3" aria-hidden />
                        Export
                    </button>
                    <button
                        type="button"
                        className={cn(qmHeaderActionsBtnClass, 'md:hidden')}
                        aria-label="Open filters"
                        onClick={() => setMobileFiltersOpen(true)}
                    >
                        <Filter className="h-3 w-3" aria-hidden />
                    </button>
                </div>
            </div>

            <div className={cn(qmFilterStripClass, 'hidden md:flex')}>
                <QualityFilterFields compact disabled={isRefreshing} />
            </div>
        </header>
    );
}

export const QualityMeasuresHeader = memo(QualityMeasuresHeaderInner);
