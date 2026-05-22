import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ComplianceStatus } from '../../types/quality';
import { QM_STATUS_STYLES } from '../../constants/quality/theme';

type Props = {
    score: number;
    status: ComplianceStatus;
    showLabel?: boolean;
    dense?: boolean;
    className?: string;
};

function ComplianceProgressBarInner({ score, status, showLabel, dense, className }: Props) {
    const pct = status === 'na' ? 0 : Math.min(100, Math.max(0, score));
    const barClass = QM_STATUS_STYLES[status].bar;

    return (
        <div className={cn('flex min-w-[3.25rem] flex-col', dense ? 'gap-0' : 'gap-0.5', className)}>
            <div
                className={cn(
                    'w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10',
                    dense ? 'h-1' : 'h-1.5',
                )}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Compliance ${pct}%`}
            >
                <div
                    className={cn('h-full rounded-full transition-all duration-500', barClass)}
                    style={{ width: status === 'na' ? '0%' : `${pct}%` }}
                />
            </div>
            {showLabel && status !== 'na' && !dense && (
                <span className="text-[10px] font-medium tabular-nums text-emr-muted dark:text-gray-400">
                    {pct}%
                </span>
            )}
        </div>
    );
}

export const ComplianceProgressBar = memo(ComplianceProgressBarInner);
