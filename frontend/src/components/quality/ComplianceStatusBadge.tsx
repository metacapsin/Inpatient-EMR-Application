import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ComplianceStatus } from '../../types/quality';
import { QM_STATUS_ICON, QM_STATUS_STYLES } from '../../constants/quality/theme';

type Props = {
    status: ComplianceStatus;
    compact?: boolean;
    dense?: boolean;
    className?: string;
};

function ComplianceStatusBadgeInner({ status, compact, dense, className }: Props) {
    const styles = QM_STATUS_STYLES[status];
    const isDense = dense || compact;
    return (
        <span
            className={cn(
                'inline-flex items-center rounded border font-semibold tabular-nums',
                styles.badge,
                isDense ? 'gap-0 px-1 py-px text-[9px] leading-none' : 'gap-1 px-2 py-0.5 text-xs',
                compact && !dense && 'px-1.5 text-[10px]',
                className,
            )}
            role="status"
            aria-label={`Status: ${styles.label}`}
            title={styles.label}
        >
            <span aria-hidden>{QM_STATUS_ICON[status]}</span>
            {!isDense && !compact && <span>{styles.label}</span>}
        </span>
    );
}

export const ComplianceStatusBadge = memo(ComplianceStatusBadgeInner);
